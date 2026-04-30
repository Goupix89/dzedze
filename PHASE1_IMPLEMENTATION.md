# Implémentation Phase 1: Renforcement de l'Accès Superadmin

## 1. Middleware: `requireOrgContext`

Ajouter à `backend/src/middleware/auth.middleware.ts`:

```typescript
// ─── Org Context Guard ────────────────────────────────────────
// Superadmin must have selected an org; regular users always have one from JWT
export function requireOrgContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  const orgId = getOrgContext(req);
  
  // Superadmin MUST have selected an org via X-Org-Id header
  if (user.role === 'superadmin' && !orgId) {
    return next(new AppError('Sélectionnez une organisation d\'abord (header X-Org-Id manquant)', 400));
  }
  
  // Regular users must always have an org
  if (user.role !== 'superadmin' && !orgId) {
    return next(new AppError('Organisation manquante', 401));
  }
  
  next();
}
```

## 2. Valider que l'Org existe

Créer `backend/src/middleware/orgValidator.middleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AppError } from '../utils/AppError';
import { getOrgContext } from './auth.middleware';

export async function validateOrgExists(req: Request, _res: Response, next: NextFunction) {
  try {
    const orgId = getOrgContext(req);
    if (!orgId) {
      return next();  // Will be caught by requireOrgContext middleware
    }

    const { rows } = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) {
      return next(new AppError('Organisation introuvable ou désactivée', 404));
    }

    next();
  } catch (err) {
    next(err);
  }
}
```

## 3. Audit Log pour Superadmin

Enrichir `backend/src/services/audit.service.ts`:

```typescript
import { db } from '../config/database';
import { logger } from '../utils/logger';
import { Request } from 'express';

interface AuditEntry {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;  // ← Ajouter
}

export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, action, resource_type, resource_id, details, ip_address, user_agent, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.userId ?? null,
          entry.action,
          entry.resourceType,
          entry.resourceId ?? null,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          entry.organizationId ?? null,  // ← Ajouter
        ]
      );
    } catch (err) {
      logger.error('Failed to write audit log:', err);
    }
  }

  // ─── Log Superadmin Access ────────────────────────────────────
  static async logSuperadminAccess(req: Request, orgId: string | null) {
    const user = (req as any).user;
    if (user?.role === 'superadmin') {
      await this.log({
        userId: user.userId,
        action: orgId ? 'SUPERADMIN_ORG_SELECTED' : 'SUPERADMIN_NO_ORG',
        resourceType: 'superadmin_access',
        details: { method: req.method, path: req.path, orgId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        organizationId: orgId ?? undefined,
      });
    }
  }
}
```

Ajouter colonne DB si nécessaire:
```sql
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
```

## 4. Ajouter Middleware d'Audit

Créer `backend/src/middleware/auditSuperadmin.middleware.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { getOrgContext } from './auth.middleware';
import { AuditService } from '../services/audit.service';

export async function auditSuperadminContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (user?.role === 'superadmin') {
    const orgId = getOrgContext(req);
    // Log immédiatement (non-bloquant)
    AuditService.logSuperadminAccess(req, orgId).catch(err => 
      console.error('Audit log failed:', err)
    );
  }
  
  next();
}
```

## 5. Intégrer dans Routes

Modifier `backend/src/routes/index.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireOrgContext } from '../middleware/auth.middleware';
import { validateOrgExists } from '../middleware/orgValidator.middleware';
import { auditSuperadminContext } from '../middleware/auditSuperadmin.middleware';

// Import routes
import missionRoutes from './mission.routes';
import userRoutes from './user.routes';
import siteRoutes from './site.routes';
import mediaRoutes from './media.routes';
// ... autres routes

const router = Router();

// ─── Global Middleware ─────────────────────────────────────
router.use(authenticate);
router.use(validateOrgExists);
router.use(auditSuperadminContext);
router.use(requireOrgContext);  // IMPORTANT: après validate

// ─── Routes ───────────────────────────────────────────────
router.use('/missions', missionRoutes);
router.use('/users', userRoutes);
router.use('/sites', siteRoutes);
router.use('/media', mediaRoutes);
// ... autres routes

// Public routes (before authenticate)
router.get('/org/plans', getOrgPlans);

export default router;
```

**OU**, si vous préférez une approche moins intrusive:

```typescript
// N'appliquer que sur certaines routes
router.use('/missions', authenticate, validateOrgExists, requireOrgContext, auditSuperadminContext, missionRoutes);
router.use('/users', authenticate, validateOrgExists, requireOrgContext, auditSuperadminContext, userRoutes);
```

## 6. Endpoint Superadmin: Valider Org

Ajouter endpoint pour que le frontend valide l'org:

```typescript
// backend/src/routes/organization.routes.ts

export async function validateOrgSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgId } = req.body;
    if (!orgId) throw new AppError('orgId requis', 400);

    const { rows } = await db.query(
      'SELECT id, name FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) throw new AppError('Organisation introuvable', 404);

    res.json({
      success: true,
      data: { id: rows[0].id, name: rows[0].name },
    });
  } catch (err) { next(err); }
}

// Dans le router:
router.post('/validate-selection', authenticate, requireSuperadmin, validateOrgSelection);
```

## 7. Frontend: Protection localStorage

Mettre à jour `frontend/src/store/auth.store.ts`:

```typescript
export const useAuthStore = create<AuthState>((set) => ({
  // ... existing code ...
  
  selectOrg: (orgId, orgName) => {
    if (orgId) {
      // Valider que l'org est en cache avant de sauvegarder
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedOrgName', orgName || '');
    } else {
      localStorage.removeItem('selectedOrgId');
      localStorage.removeItem('selectedOrgName');
    }
    set({ selectedOrgId: orgId, selectedOrgName: orgName });
  },

  // Nouveau: Charger org depuis localStorage au démarrage
  loadOrgFromStorage: () => {
    const orgId = localStorage.getItem('selectedOrgId');
    const orgName = localStorage.getItem('selectedOrgName');
    if (orgId) set({ selectedOrgId: orgId, selectedOrgName: orgName });
  },
}));

// Dans App.tsx ou un effet global:
useEffect(() => {
  const { loadOrgFromStorage, user } = useAuthStore.getState();
  if (user?.role === 'superadmin') {
    loadOrgFromStorage();
  }
}, []);
```

## 8. Frontend: Validation API au changement

Mettre à jour `frontend/src/pages/DashboardPage.tsx`:

```typescript
function pick(id: string, name: string) {
  // Valider côté backend avant de persister
  apiClient.post('/org/validate-selection', { orgId: id })
    .then(() => {
      selectOrg(id, name);
      setOpen(false);
      qc.invalidateQueries();
    })
    .catch(() => {
      alert('Cette organisation n\'est plus accessible');
      selectOrg(null, null);
    });
}
```

---

## ✅ Résumé des Modifications

| Fichier | Changement | Priorité |
|---------|-----------|----------|
| `auth.middleware.ts` | Ajouter `requireOrgContext` | 🔴 Critique |
| `orgValidator.middleware.ts` | Créer (nouveau) | 🟡 Haute |
| `audit.service.ts` | Enrichir `log()` + `logSuperadminAccess()` | 🟡 Haute |
| `auditSuperadmin.middleware.ts` | Créer (nouveau) | 🟡 Haute |
| `routes/index.ts` | Intégrer middlewares | 🔴 Critique |
| `routes/organization.routes.ts` | Ajouter `validateOrgSelection` | 🟢 Moyenne |
| `auth.store.ts` | Ajouter `loadOrgFromStorage()` | 🟡 Haute |
| `DashboardPage.tsx` | Valider avant `pick()` | 🟢 Moyenne |
| Database | ALTER TABLE audit_logs | 🟡 Haute |

---

## 🧪 Tests Phase 1

### Test 1: Superadmin sans org sélectionnée
```bash
# Devrait échouer (400)
curl -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  http://localhost:3000/api/v1/users

# Réponse attendue: "Sélectionnez une organisation d'abord"
```

### Test 2: Avec org sélectionnée
```bash
# Devrait fonctionner
curl -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  -H "X-Org-Id: ORG_UUID" \
  http://localhost:3000/api/v1/users

# Réponse: Liste des utilisateurs de ORG_UUID
```

### Test 3: Audit trail
```sql
SELECT * FROM audit_logs 
WHERE user_id = 'SUPERADMIN_UUID' 
AND action = 'SUPERADMIN_ORG_SELECTED'
ORDER BY created_at DESC;
```

### Test 4: Org introuvable
```bash
curl -H "Authorization: Bearer SUPERADMIN_TOKEN" \
  -H "X-Org-Id: INVALID_UUID" \
  http://localhost:3000/api/v1/users

# Réponse attendue: "Organisation introuvable (404)"
```

