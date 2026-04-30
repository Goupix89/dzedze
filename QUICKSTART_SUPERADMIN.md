# 🚀 Quick Start: Implémenter Accès Superadmin

**Durée estimée:** 2-3 heures

## 1. Vérifier l'Existant ✅

```bash
# Vérifier que getOrgContext existe
grep -n "export function getOrgContext" backend/src/middleware/auth.middleware.ts

# Vérifier que selectedOrgId est dans le store
grep -n "selectedOrgId" frontend/src/store/auth.store.ts

# Vérifier que X-Org-Id est injecté
grep -n "X-Org-Id" frontend/src/services/api.ts
```

## 2. Ajouter Middleware (Backend)

### 2.1 Créer `backend/src/middleware/orgValidator.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AppError } from '../utils/AppError';
import { getOrgContext } from './auth.middleware';

export async function validateOrgExists(req: Request, _res: Response, next: NextFunction) {
  try {
    const orgId = getOrgContext(req);
    if (!orgId) return next();

    const { rows } = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) {
      return next(new AppError('Organisation introuvable ou désactivée', 404));
    }

    next();
  } catch (err) { next(err); }
}
```

### 2.2 Ajouter `requireOrgContext` à `auth.middleware.ts`

```typescript
// Ajouter après requireSuperadmin:

export function requireOrgContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  const orgId = getOrgContext(req);
  
  if (user.role === 'superadmin' && !orgId) {
    return next(new AppError('Sélectionnez une organisation d\'abord (header X-Org-Id manquant)', 400));
  }
  
  if (user.role !== 'superadmin' && !orgId) {
    return next(new AppError('Organisation manquante', 401));
  }
  
  next();
}
```

### 2.3 Intégrer dans `backend/src/routes/index.ts`

```typescript
import { authenticate, requireOrgContext } from '../middleware/auth.middleware';
import { validateOrgExists } from '../middleware/orgValidator.middleware';

const router = Router();

// Routes publiques (avant authenticate)
router.get('/org/plans', listPlans);

// Middleware global
router.use(authenticate);
router.use(validateOrgExists);
router.use(requireOrgContext);

// Routes protégées
router.use('/missions', missionRoutes);
router.use('/users', userRoutes);
router.use('/sites', siteRoutes);
router.use('/media', mediaRoutes);
router.use('/organization', organizationRoutes);

export default router;
```

**ou** si vous préférez une approche moins intrusive (appliquer seulement sur routes sensibles):

```typescript
// N'appliquer que sur certaines routes
router.use('/users', authenticate, validateOrgExists, requireOrgContext, userRoutes);
router.use('/missions', authenticate, validateOrgExists, requireOrgContext, missionRoutes);
```

## 3. Enrichir Audit Logs

### 3.1 Modifier `backend/src/services/audit.service.ts`

```typescript
// À la place du fichier existing, remplacer la classe:

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
          entry.organizationId ?? null,
        ]
      );
    } catch (err) {
      logger.error('Failed to write audit log:', err);
    }
  }

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

### 3.2 Database Migration

```sql
-- Run this in your DB (one-time)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
```

## 4. Valider au Frontend

### 4.1 Endpoint de validation

Ajouter à `backend/src/controllers/organization.controller.ts`:

```typescript
export async function validateOrgSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgId } = req.body;
    if (!orgId) throw new AppError('orgId requis', 400);

    const { rows } = await db.query(
      'SELECT id, name FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) throw new AppError('Organisation introuvable', 404);

    res.json({ success: true, data: { id: rows[0].id, name: rows[0].name } });
  } catch (err) { next(err); }
}
```

### 4.2 Ajouter route

Ajouter à `backend/src/routes/organization.routes.ts`:

```typescript
router.post('/validate-selection', authenticate, requireSuperadmin, validateOrgSelection);
```

## 5. Frontend: Protection localStorage

### 5.1 Mettre à jour `frontend/src/pages/DashboardPage.tsx`

Remplacer la fonction `pick()`:

```typescript
async function pick(id: string, name: string) {
  try {
    const res = await apiClient.post('/org/validate-selection', { orgId: id });
    selectOrg(id, name);
    setOpen(false);
    qc.invalidateQueries();
  } catch (err: any) {
    alert('Erreur: Organisation inaccessible\n' + (err.response?.data?.message || ''));
    selectOrg(null, null);
  }
}
```

## 6. Tests Rapides

### 6.1 Backend Test

```bash
# Terminal 1: Démarrer le serveur
cd backend && npm start

# Terminal 2: Tester

# 1. Get superadmin token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dzedze.app","password":"password"}' | jq -r '.data.accessToken')

# 2. Test sans X-Org-Id (devrait échouer)
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN"

# ✓ Résultat attendu: 400 "Sélectionnez une organisation"

# 3. Test avec org valide
ORG_ID="550e8400-e29b-41d4-a716-446655440000"
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID"

# ✓ Résultat attendu: 200 + liste des users
```

### 6.2 Frontend Test

```typescript
// Dans DevTools Console:

// 1. Avant sélection
localStorage.getItem('selectedOrgId')  // null

// 2. Vérifier que X-Org-Id n'est pas envoyé
// Ouvrir Network tab, faire une requête → Pas de X-Org-Id header

// 3. Sélectionner une org
const store = useAuthStore.getState();
store.selectOrg('550e8400-e29b-41d4-a716-446655440000', 'Test Org');

// 4. Après sélection
localStorage.getItem('selectedOrgId')  // "550e8400-..."

// 5. Faire une requête → X-Org-Id header présent ✓
```

## 7. Vérifier en DB

```sql
-- Vérifier les logs
SELECT user_id, action, organization_id, created_at 
FROM audit_logs 
WHERE action LIKE 'SUPERADMIN%'
ORDER BY created_at DESC
LIMIT 10;

-- Vérifier que users sont liés à orgs
SELECT 
  o.name,
  COUNT(*) as users_count
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id
GROUP BY o.id, o.name;
```

## 8. Déployer en Staging

```bash
# 1. Commit les changements
git add .
git commit -m "feat: Superadmin tenant isolation with org context"

# 2. Push vers staging
git push origin staging

# 3. CI/CD pipeline s'exécute automatiquement
# (Tests, build, deploy)

# 4. Vérifier que tout fonctionne en staging
curl https://staging-api.dzedze.com/api/v1/users \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "X-Org-Id: $ORG_ID"

# 5. Passer les tests E2E
npm run test:e2e

# 6. Approuver pour production
# → via GitHub PR review
```

---

## ✅ Résultat Final

```
✓ Superadmin sans org = 400 Error
✓ Superadmin avec org = Données filtrées
✓ Frontend localStorage persiste
✓ Audit logs traçables
✓ Pas d'accès croisé possible
✓ Prêt pour production!
```

---

## 🐛 Troubleshooting

| Problème | Solution |
|----------|----------|
| **\"organizationId not in audit_logs\"** | Exécuter migration SQL |
| **\"X-Org-Id not injected\"** | Vérifier api.ts interceptor |
| **\"org/all returns nothing\"** | Vérifier que organizations existent en BD |
| **\"localStorage cleared randomly\"** | Implémenter validation API au changement |
| **\"Agent peut voir org B\"** | Vérifier que getOrgContext ignore X-Org-Id pour agents |

---

**Besoin d'aide?** Consulter [SECURITY_TESTING.md](./SECURITY_TESTING.md) ou [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md)

