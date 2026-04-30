# Guide: Accès Superadmin aux données des Tenants

## 🏗️ Architecture actuelle

Votre système multi-tenant est déjà structuré pour permettre au superadmin d'accéder aux données des tenants via **contexte organisationnel isolé**.

### 1. **Backend - Isolation par Header (`X-Org-Id`)**

#### Middleware Auth (`auth.middleware.ts`)
```typescript
export function getOrgContext(req: Request): string | null {
  const user = (req as any).user as AuthPayload;
  if (user.role === 'superadmin') {
    return (req.headers['x-org-id'] as string) || null;  // ← Récupère l'org sélectionnée
  }
  return user.orgId ?? null;  // ← Utilisateurs normaux: orgId depuis JWT
}
```

**Fonctionnement:**
- ✅ Les superadmins n'ont pas d'`orgId` dans leur JWT
- ✅ Ils sélectionnent une organisation via le header `X-Org-Id`
- ✅ Les autres utilisateurs sont toujours limités à leur propre `organization_id`

#### Controllers - Filtrage des données
Tous les endpoints utilisent `getOrgContext()`:

```typescript
// Exemple: GET /users
const orgId = getOrgContext(req);
if (orgId) { q += ` AND u.organization_id = $${p++}`; params.push(orgId); }
```

### 2. **Frontend - Sélecteur d'Organisation**

#### API Interceptor (`api.ts`)
```typescript
const selectedOrgId = localStorage.getItem('selectedOrgId');
if (selectedOrgId) config.headers['X-Org-Id'] = selectedOrgId;
```

#### Store Auth (`auth.store.ts`)
```typescript
interface AuthState {
  selectedOrgId: string | null;      // Org actuellement sélectionnée
  selectedOrgName: string | null;
  selectOrg: (orgId: string | null, orgName: string | null) => void;
}
```

#### Composant Banner (`DashboardPage.tsx`)
```typescript
function SuperadminOrgBanner() {
  const { data: orgs } = useQuery({
    queryKey: ['all-orgs'],
    queryFn: () => apiClient.get('/org/all').then(r => r.data.data),
  });
  // ... affiche dropdown pour sélectionner une org
}
```

---

## ✅ Fonctionnement Complet

### Flow de sélection:

```
1. Superadmin se connecte
   ↓
2. JWT reçu SANS orgId (role="superadmin")
   ↓
3. Dashboard affiche banner avec dropdown des organizations
   ↓
4. Superadmin sélectionne une org
   ↓
5. localStorage.setItem('selectedOrgId', orgId)
   ↓
6. Chaque requête API inclut header X-Org-Id: orgId
   ↓
7. Backend filtre TOUTES les données par organization_id
   ↓
8. Superadmin voit données d'1 seul tenant
```

### Sécurité:
- ✅ Superadmin sans `orgId` par défaut = accès à rien
- ✅ DOIT sélectionner une org = filtrage obligatoire
- ✅ Chaque query SQL ajoute `AND organization_id = $X`
- ✅ Audit log enregistre chaque action avec userId + action

---

## 🔧 Améliorations Recommandées

### 1. **Renforcer la validation côté Backend**

**Problème:** Un superadmin oublie de sélectionner une org → `X-Org-Id` vide

**Solution:** Forcer une `orgId` pour certaines routes:

```typescript
// Créer un middleware spécifique
export function requireOrgContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  const orgId = getOrgContext(req);
  
  // Superadmin DOIT avoir sélectionné une org pour ces routes
  if (user.role === 'superadmin' && !orgId) {
    return next(new AppError('Sélectionnez une organisation d\'abord', 400));
  }
  next();
}

// Ajouter au fichier routes/index.ts
router.use('/missions', authenticate, requireOrgContext, missionRoutes);
router.use('/users', authenticate, requireOrgContext, userRoutes);
```

### 2. **Tracer toutes les actions Superadmin**

Ajouter un audit log spécial:

```typescript
// Dans auth.middleware.ts
export function auditSuperadminContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  if (user.role === 'superadmin') {
    const orgId = getOrgContext(req);
    // Log chaque action superadmin avec l'org accédée
    console.log(`[SUPERADMIN] User ${user.userId} accessed org ${orgId} - ${req.method} ${req.path}`);
  }
  next();
}
```

### 3. **Frontend - Protection contre la perte de contexte**

```typescript
// Dans auth.store.ts - Recovery si org sélectionnée n'existe plus
export const useAuthStore = create<AuthState>((set) => ({
  // ...
  selectOrg: async (orgId, orgName) => {
    if (orgId) {
      // Valider que l'org existe avant de persister
      try {
        await apiClient.get(`/org/${orgId}`);
        localStorage.setItem('selectedOrgId', orgId);
        set({ selectedOrgId: orgId, selectedOrgName: orgName });
      } catch {
        // Org supprimée ou inaccessible
        localStorage.removeItem('selectedOrgId');
        set({ selectedOrgId: null, selectedOrgName: null });
      }
    } else {
      localStorage.removeItem('selectedOrgId');
      set({ selectedOrgId: null, selectedOrgName: null });
    }
  },
}));
```

### 4. **Créer une page Admin dédiée**

Actuellement c'est sur le Dashboard. Créer une route `/admin`:

```typescript
// frontend/src/pages/AdminPage.tsx
import { SuperadminOrgSelector } from '../components/admin/SuperadminOrgSelector';
import { TenantsOverview } from '../components/admin/TenantsOverview';

export default function AdminPage() {
  const { user } = useAuthStore();
  
  if (user?.role !== 'superadmin') return null;
  
  return (
    <div>
      <SuperadminOrgSelector />  {/* Sélecteur d'org */}
      <TenantsOverview />         {/* Vue d'ensemble tenants */}
      <SupportTickets />          {/* Tickets des clients */}
    </div>
  );
}
```

### 5. **Ajouter des endpoints spécifiques Superadmin**

```typescript
// Endpoint pour support technique
router.get('/admin/tenant/:orgId/users', requireSuperadmin, getTenantUsers);
router.get('/admin/tenant/:orgId/missions', requireSuperadmin, getTenantMissions);
router.post('/admin/tenant/:orgId/impersonate', requireSuperadmin, impersonateTenant);
router.get('/admin/audit-logs', requireSuperadmin, getSuperadminAuditLogs);
```

---

## 📋 Checklist d'Implémentation

### Phase 1: Renforcement (Immédiat)
- [ ] Ajouter middleware `requireOrgContext` pour routes sensibles
- [ ] Implémenter audit log pour accès superadmin
- [ ] Ajouter validation que `X-Org-Id` correspond à une org existante

### Phase 2: UX (Court terme)
- [ ] Créer page `/admin` dédiée au superadmin
- [ ] Ajouter indicateur visuel "Mode Support Tenant" vs "Mode Dashboard Normal"
- [ ] Implémenter protection localStorage (validation org existe)

### Phase 3: Support (Moyen terme)
- [ ] Ajouter module "Support Tickets" par tenant
- [ ] Implémenter "Impersonation" (login as tenant pour debug)
- [ ] Dashboard superadmin avec vue d'ensemble de tous les tenants

### Phase 4: Compliance (Long terme)
- [ ] Audit trail complet des actions superadmin
- [ ] Consentement/validation avant accès à org
- [ ] Timers/sessions : déconnexion auto après X minutes sans activité

---

## 🔐 Considérations de Sécurité

| Point | État | Recommandation |
|-------|------|-----------------|
| **Isolation org** | ✅ Implémentée | Ajouter tests unitaires |
| **Audit log** | ⚠️ Basique | Enrichir avec contexte d'accès |
| **Token superadmin** | ✅ Sans orgId | Bon design |
| **Validation Header** | ⚠️ À renforcer | Vérifier org existe |
| **Rate limiting** | ❓ À vérifier | Appliquer sur `/org/all` |
| **Session timeout** | ❓ À implémenter | Particulier pour support |

---

## 📞 Flux Opérationnel Superadmin

### Scénario: Support d'un Client

```
1. Client contacte support → ticket créé avec orgId
2. Superadmin voit ticket sur /admin
3. Clique "Accéder à ces données"
4. Organisation sélectionnée → X-Org-Id défini
5. Dashboard affiche données CLIENT SEULEMENT
6. Superadmin investigue les missions, utilisateurs
7. Effectue action corrective (ex: réinitialiser agent, valider mission)
8. Audit log: "Admin user XXX fixed mission YYY for org ZZZ"
9. Clique "Retour à vue complète" → orgId cleared
```

### Avantages:
✅ Isolation stricte par tenant  
✅ Traçabilité complète  
✅ Pas de risque d'accès croisé  
✅ Facile à auditer pour compliance  

---

## 🚀 Prochaines Étapes

1. **Implémenter les améliorations Phase 1** dans [backend-improvements.md](./BACKEND_IMPROVEMENTS.md)
2. **Créer composant Admin** dans `frontend/src/pages/AdminPage.tsx`
3. **Tester isolation** : Vérifier qu'on ne peut pas accéder à org B depuis org A
4. **Documenter accès support** pour l'équipe opérationnelle

