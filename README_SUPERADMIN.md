# 🎯 Résumé Exécutif: Accès Superadmin aux Tenants

## Le Problème

Le superadmin (développeur) doit pouvoir:
- ✅ Accéder aux données de **n'importe quel tenant** pour fournir du support
- ✅ Visualiser les données d'un tenant **isolé** (pas d'accès croisé)
- ✅ Effectuer des actions de support/debug pour ce tenant
- ✅ Garder une **trace complète** de tous les accès (audit)

## La Solution

Une architecture **multi-tenant contextuelle** où:

1. **Backend** utilise un header `X-Org-Id` pour scoper les données
2. **Frontend** propose un sélecteur d'organisation au superadmin
3. **Chaque requête SQL** filtre par `organization_id`
4. **Audit logging** trace chaque accès superadmin

```
Superadmin Login → Pas d'orgId dans JWT → DOIT sélectionner org → X-Org-Id defini → Données filtrées → Isolation garantie
```

---

## 📊 État de l'Implémentation

### ✅ Déjà Implémenté (80%)

| Composant | État | Fichiers |
|-----------|------|---------|
| **Backend - Contexte org** | ✅ Complet | `auth.middleware.ts` - `getOrgContext()` |
| **Backend - Filtrage SQL** | ✅ Complet | `user.controller.ts`, `mission.controller.ts` |
| **Frontend - Header X-Org-Id** | ✅ Complet | `api.ts` - axios interceptor |
| **Frontend - Store selectedOrgId** | ✅ Complet | `auth.store.ts` |
| **Frontend - Sélecteur org** | ✅ Complet | `DashboardPage.tsx` - `SuperadminOrgBanner` |

### ⚠️ À Renforcer (20%)

| Composant | État | Priorité |
|-----------|------|----------|
| **Middleware: requireOrgContext** | ⚠️ Manquant | 🔴 Critique |
| **Validation org existe** | ⚠️ Partiel | 🟡 Haute |
| **Audit trail enrichi** | ⚠️ Basique | 🟡 Haute |
| **Page Admin dédiée** | ⚠️ Manquant | 🟡 Haute |
| **Tests sécurité** | ⚠️ Manquant | 🟢 Moyenne |

---

## 🚀 Plan de Déploiement (3 Phases)

### Phase 1: Renforcement Backend (Jour 1-2) 🔴 CRITIQUE
**Durée estimée:** 2-3 heures

1. Ajouter `requireOrgContext` middleware
2. Ajouter `validateOrgExists` middleware
3. Enrichir audit logs
4. Intégrer dans routes sensibles

**Fichiers:** [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md)

### Phase 2: Interface Superadmin (Jour 3-4) 🟡 HAUTE
**Durée estimée:** 4-6 heures

1. Créer page `/admin`
2. Composant sélecteur org amélioré
3. Vue d'ensemble tenants
4. Protection routes

**Fichiers:** [PHASE2_FRONTEND.md](./PHASE2_FRONTEND.md)

### Phase 3: Support & Compliance (Semaine 2) 🟢 MOYENNE
**Durée estimée:** 2-3 jours

1. Module support tickets
2. Impersonation mode
3. Dashboard audit
4. Conformité RGPD

**Status:** À planifier

---

## 🔐 Points de Sécurité Clés

| Point | Mesure | Statut |
|-------|--------|--------|
| **Isolation org** | Chaque query: WHERE organization_id = $X | ✅ Implémenté |
| **Superadmin par défaut: pas d'org** | JWT sans orgId + requireOrgContext | ⚠️ À compléter |
| **Validation org existe** | Vérifier vs DB avant utilisation | ⚠️ À compléter |
| **Audit trail** | Log chaque accès superadmin | ⚠️ À enrichir |
| **Rate limiting** | /org/all limité à X req/min | ❓ À implémenter |
| **Token isolation** | Agent token ne peut pas bypasser | ✅ Implémenté |

---

## 📁 Fichiers de Référence

```
/home/user/cleaning-supervision/
├── SUPERADMIN_TENANT_ACCESS.md      ← Vue d'ensemble complète
├── PHASE1_IMPLEMENTATION.md          ← Backend renforcement
├── PHASE2_FRONTEND.md                ← UI superadmin
├── SECURITY_TESTING.md               ← Tests & sécurité
└── README.md                         ← Ce fichier

Backend code:
├── backend/src/middleware/
│   ├── auth.middleware.ts            ← getOrgContext()
│   ├── orgValidator.middleware.ts    ← À créer
│   └── auditSuperadmin.middleware.ts ← À créer
├── backend/src/controllers/
│   ├── organization.controller.ts    ← listAllOrganizations()
│   ├── user.controller.ts            ← listUsers() filtre org
│   └── mission.controller.ts         ← getDashboardStats() filtre org
└── backend/src/services/
    └── audit.service.ts              ← À enrichir

Frontend code:
├── frontend/src/services/api.ts      ← X-Org-Id header ✅
├── frontend/src/store/auth.store.ts  ← selectedOrgId ✅
├── frontend/src/pages/
│   ├── DashboardPage.tsx             ← SuperadminOrgBanner ✅
│   └── AdminPage.tsx                 ← À créer
└── frontend/src/components/admin/    ← À créer
    ├── SuperadminOrgSelector.tsx
    ├── TenantsOverview.tsx
    └── SupportTickets.tsx
```

---

## 💡 Flux Opérationnel Superadmin

### Scénario d'Utilisation Réelle

```
1️⃣ SUPPORT REÇOIT TICKET
   "Nos agents ne voient pas les missions sur Android"
   → Ticket: Org = "DZEDZE Demo Agency"

2️⃣ SUPERADMIN OUVRE ADMIN PAGE
   GET https://app.dzedze.com/admin
   → Page `/admin` s'affiche
   → Liste de tous les tenants visible

3️⃣ SUPERADMIN SÉLECTIONNE TENANT
   Click: "DZEDZE Demo Agency"
   → localStorage.selectedOrgId = "550e8400-..."
   → X-Org-Id injected dans toutes requêtes

4️⃣ SUPERADMIN VOIT DONNÉES DU TENANT
   Dashboard affiche:
   • Agents: 12 (SEULEMENT ceux de cette org)
   • Missions: 150 (SEULEMENT de cette org)
   • Dernières actions: Filtrées par org
   → Pas d'accès croisé possible

5️⃣ SUPERADMIN INVESTIGUE
   • Voit que agent "Ahmed" est "hors_ligne" depuis 3j
   • Voir ses missions: toutes de l'org sélectionnée
   • Effectue action: "Réinitialiser session agent"
   → Audit log: "SUPERADMIN_ACTION" + userId + orgId

6️⃣ SUPERADMIN RETOURNE À VUE GLOBALE
   Click: "Retour à vue complète"
   → localStorage cleared
   → Aucune org sélectionnée
   → Retour au listing de tous les tenants
   → Pas d'accès aux données jusqu'à nouvelle sélection

7️⃣ SUPPORT FERME TICKET
   Tenant signale: "Problème résolu! Merci 🙏"
```

### Sécurité à Chaque Étape

```
1️⃣ Superadmin sans org
   ✗ Requête: GET /api/v1/users
   ✓ Réponse: 400 "Sélectionnez une organisation d'abord"

2️⃣ Org invalide
   ✗ Requête: X-Org-Id: 00000000...
   ✓ Réponse: 404 "Organisation introuvable"

3️⃣ Org sélectionnée
   ✓ Requête: X-Org-Id: 550e8400-...
   ✓ Backend: WHERE users.organization_id = '550e8400-...'
   ✓ Réponse: Données de cette org SEULEMENT

4️⃣ Audit trail
   ✓ DB Log: superadmin_id | SUPERADMIN_ORG_SELECTED | org_id | timestamp
   ✓ Query: "Superadmin XXX accessed org YYY at ZZZ"
```

---

## 📈 Métriques & KPIs

### À Suivre en Production

```sql
-- 1. Fréquence d'accès superadmin
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_accesses,
  COUNT(DISTINCT user_id) as unique_superadmins,
  COUNT(DISTINCT organization_id) as orgs_accessed
FROM audit_logs
WHERE action = 'SUPERADMIN_ORG_SELECTED'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 2. Temps moyen d'accès
SELECT 
  PERCENTILE_CONT(0.5) WITHIN GROUP(ORDER BY response_time_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP(ORDER BY response_time_ms) as p95,
  MAX(response_time_ms) as max_time
FROM api_logs
WHERE path = '/api/v1/users' AND user_role = 'superadmin';

-- 3. Erreurs d'accès
SELECT 
  error_message,
  COUNT(*) as count
FROM api_logs
WHERE path LIKE '/api/v1/%' 
  AND user_role = 'superadmin'
  AND status_code >= 400
GROUP BY error_message
ORDER BY count DESC;
```

---

## ❓ FAQ

### Q: Que se passe-t-il si le superadmin sélectionne une org, puis elle est supprimée?
**A:** Le middleware `validateOrgExists` rejettera la requête avec 404. Frontend clearera localStorage. Superadmin sera redirigé au sélecteur.

### Q: Peut-on avoir 2 superadmins accédant simultanément à différentes orgs?
**A:** Oui! Chacun a son propre `localStorage.selectedOrgId`, donc contextes indépendants.

### Q: Qu'est-ce qui empêche un agent de customiser son X-Org-Id?
**A:** Le middleware `getOrgContext` ignore le header pour les agents. Leur `organization_id` vient du JWT.

### Q: Les données historiques du superadmin (avant l'audit) sont-elles tracées?
**A:** Non, audit_logs commence maintenant. Penser à archiver les anciens logs régulièrement.

### Q: Comment fonctionne l'impersonation (login as agent)?
**A:** À implémenter phase 3. Sera un endpoint `/admin/impersonate/:userId` qui génère un token temporaire pour cet agent.

---

## 🎓 Ressources Complémentaires

- [OWASP: Multi-Tenant Application Security](https://cheatsheetseries.owasp.org/cheatsheets/Multi-Tenant_SaaS_Security.html)
- [Auth0: Role-Based Access Control (RBAC)](https://auth0.com/blog/role-based-access-control-rbac-what-you-need-to-know/)
- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

---

## 📞 Support & Escalade

### Si vous rencontrez des problèmes:

1. **Données visibles d'autre org?**
   - Vérifier: `grep -r "WHERE organization_id" backend/src/`
   - Fichier: [SECURITY_TESTING.md](./SECURITY_TESTING.md#test-suite-1-isolation-de-lorg)

2. **Audit trail manquant?**
   - Vérifier: Table audit_logs a colonne `organization_id`?
   - Middleware `auditSuperadminContext` appliqué?
   - Fichier: [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md#3-audit-log-pour-superadmin)

3. **Frontend localStorage persiste après delete?**
   - Implémenter validation API au load
   - Fichier: [PHASE2_FRONTEND.md](./PHASE2_FRONTEND.md#3-frontend-protection-contre-la-perte-de-contexte)

4. **Performances lentes avec /org/all?**
   - Ajouter pagination
   - Ajouter rate limiting
   - Implémenter caching Redis
   - Fichier: [SECURITY_TESTING.md](./SECURITY_TESTING.md#test-suite-5-rate-limiting)

---

## ✅ Checklist Final

Avant de déployer en production:

- [ ] Phase 1 implémentée (Backend renforcement)
- [ ] Phase 2 implémentée (Frontend UI)
- [ ] Tests de sécurité passés (sql injection, isolation org, etc)
- [ ] Audit trail testé et validé
- [ ] Rate limiting configuré
- [ ] Équipe support formée et documentée
- [ ] Monitoring/alertes en place pour accès superadmin
- [ ] Backups DB configurés
- [ ] Documentation mise à jour pour la production

---

**Dernière mise à jour:** 30 Avril 2026  
**Version:** 1.0  
**Auteur:** Architecture DZEDZE  
**Status:** 🟡 À compléter Phase 1 & 2

