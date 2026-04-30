# Guide de Sécurité & Tests - Accès Superadmin

## 🔐 Principes de Sécurité

### 1. **Principe du Moindre Privilège (Zero Trust)**

```
┌─────────────────────────────────────────────────────────────┐
│ DÉFAUT: Superadmin = Pas d'orgId                             │
├─────────────────────────────────────────────────────────────┤
│ Requête API sans X-Org-Id:                                  │
│ • Les requêtes échouent (400: "orgId manquant")             │
│ • Pas d'accès par défaut                                     │
│ • DOIT sélectionner une org                                  │
│                                                               │
│ Avec X-Org-Id valide:                                        │
│ • Vérification que l'org existe                             │
│ • Vérification que l'org est active                         │
│ • Audit log de l'accès                                       │
│ • Requête filtrée sur cette org SEULEMENT                   │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Isolation des Données par Tenant**

**Chaque requête SQL ajoute:**
```sql
WHERE organization_id = $X
```

**Aucune exception - vérifier:**
```bash
grep -r "getOrgContext" backend/src/controllers/
# Chaque controller doit l'utiliser
```

### 3. **Audit Trail Complète**

Chaque action superadmin est loggée:
```typescript
SUPERADMIN_ORG_SELECTED    // Changement d'org
SUPERADMIN_NO_ORG          // Tentative sans org
USER_UPDATED               // Mise à jour d'agent
MISSION_REVIEWED           // Revue de mission
```

---

## 🧪 Tests de Sécurité

### Test Suite 1: Isolation de l'Org

#### Test 1.1: Superadmin sans org
```bash
# Setup
SUPERADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
ORG_A="550e8400-e29b-41d4-a716-446655440001"
ORG_B="550e8400-e29b-41d4-a716-446655440002"

# Test: Accès sans X-Org-Id
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json"

# ✓ Résultat attendu: 
# {
#   "success": false,
#   "message": "Sélectionnez une organisation d'abord (header X-Org-Id manquant)",
#   "code": 400
# }
```

#### Test 1.2: Avec org valide
```bash
# Test: Accès avec org A
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "X-Org-Id: $ORG_A" \
  -H "Content-Type: application/json"

# ✓ Résultat attendu:
# {
#   "success": true,
#   "data": [
#     { "id": "agent1", "organization_id": "$ORG_A", ... },
#     { "id": "agent2", "organization_id": "$ORG_A", ... }
#   ]
# }
```

#### Test 1.3: Org invalide doit retourner 404
```bash
FAKE_ORG="00000000-0000-0000-0000-000000000000"

curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "X-Org-Id: $FAKE_ORG" \
  -H "Content-Type: application/json"

# ✓ Résultat attendu: 404 "Organisation introuvable"
```

#### Test 1.4: Vérifier que org A ne voit PAS les données d'org B
```bash
# Basculer vers ORG_B
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  -H "X-Org-Id: $ORG_B" \
  -H "Content-Type: application/json"

# ✓ Résultat attendu:
# Données UNIQUEMENT de ORG_B, jamais de ORG_A

# ✗ Problème si un agent de ORG_A apparaît ici
```

---

### Test Suite 2: Audit Trail

#### Test 2.1: Vérifier les logs
```sql
-- Admin vérifie les accès superadmin
SELECT 
  user_id,
  action,
  organization_id,
  created_at,
  ip_address
FROM audit_logs
WHERE user_id = 'SUPERADMIN_UUID'
  AND action IN ('SUPERADMIN_ORG_SELECTED', 'SUPERADMIN_NO_ORG')
ORDER BY created_at DESC
LIMIT 20;

-- ✓ Résultat attendu:
-- Rows avec timestamps des sélections d'org
-- IP addresses traçables
-- Actions claires
```

#### Test 2.2: Vérifier les modifications en contexte org
```sql
-- Chaque modification doit avoir l'orgId
SELECT 
  user_id,
  action,
  resource_type,
  resource_id,
  organization_id,
  created_at
FROM audit_logs
WHERE action IN ('USER_UPDATED', 'MISSION_REVIEWED')
  AND user_id = 'SUPERADMIN_UUID'
ORDER BY created_at DESC;

-- ✓ Vérifier que organization_id est TOUJOURS remplie
```

---

### Test Suite 3: Validation Frontend

#### Test 3.1: localStorage survit au refresh
```typescript
// Dans la console browser:

// 1. Avant login
localStorage.getItem('selectedOrgId') // null

// 2. Sélectionner une org
// (Click sur un tenant)

// 3. Après sélection
localStorage.getItem('selectedOrgId') // "550e8400..."
localStorage.getItem('selectedOrgName') // "DZEDZE Demo Agency"

// 4. Refresh la page (F5)

// 5. Après refresh
localStorage.getItem('selectedOrgId') // "550e8400..." ✓ Toujours là
localStorage.getItem('selectedOrgName') // "DZEDZE Demo Agency" ✓ Toujours là
```

#### Test 3.2: Org supprimée dans BD
```typescript
// 1. Superadmin sélectionne org A
// 2. Admin BD: DELETE FROM organizations WHERE id = 'ORG_A'
// 3. Superadmin F5 refresh
// ✓ Vérifier que localStorage est cleared
// ✓ Superadmin revient au sélecteur

// Code test:
async function testOrgDeletedRecovery() {
  // Sélectionner org
  selectOrg(orgId, orgName);
  
  // Vérifier qu'elle était sélectionnée
  expect(localStorage.getItem('selectedOrgId')).toBe(orgId);
  
  // Simuler l'org supprimée (mock API error 404)
  apiClient.get(`/org/${orgId}`).mockRejectedValueOnce(new Error('404'));
  
  // Tenter la validation
  await selectOrg(orgId, orgName);
  
  // ✓ Vérifier que localStorage est cleared
  expect(localStorage.getItem('selectedOrgId')).toBeNull();
}
```

---

### Test Suite 4: Injection & Bypass

#### Test 4.1: SQL Injection sur X-Org-Id
```bash
# Attaque possible: injection SQL dans header
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: ' OR '1'='1" \
  -H "Content-Type: application/json"

# ✓ Vérifier que:
# • Parameterized queries utilisées (= safe)
# • Validation UUID format
# • Aucune donnée ne fuite
```

#### Test 4.2: Bypass du middleware
```bash
# Tenter d'accéder sans middleware (direct DB)
# ✗ Impossible si architecture est bonne

# Vérifier: Chaque service accède via getOrgContext
grep -r "db.query.*WHERE" backend/src/services/
# ✓ Chaque query doit avoir organization_id dans WHERE

grep -r "organization_id" backend/src/services/
# ✓ Vérifier qu'il n'y a PAS de requête sans cette clause
```

#### Test 4.3: Token de l'agent normal ne fonctionne pas comme superadmin
```bash
# Token agent normal
AGENT_TOKEN="eyJ..."

curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $AGENT_TOKEN" \
  -H "X-Org-Id: $OTHER_ORG" \
  -H "Content-Type: application/json"

# ✓ Résultat attendu: 403 "Accès refusé"
# Le X-Org-Id est ignoré pour les agents
```

---

### Test Suite 5: Rate Limiting

#### Test 5.1: Vérifier rate limit sur /org/all
```bash
# Superadmin tente 100 requêtes en 1 seconde
for i in {1..100}; do
  curl http://localhost:3000/api/v1/org/all \
    -H "Authorization: Bearer $SUPERADMIN_TOKEN" &
done
wait

# ✓ Résultat attendu:
# Après X requêtes: 429 "Too Many Requests"
# Headers: Retry-After: 60
```

---

## 📋 Checklist de Déploiement

### Avant la production:

- [ ] **Base de données**
  - [ ] Migration `audit_logs.organization_id` appliquée
  - [ ] Index `idx_audit_org` créé
  - [ ] Backups configurés

- [ ] **Backend**
  - [ ] `requireOrgContext` middleware appliqué à toutes les routes sensibles
  - [ ] `validateOrgExists` middleware appliqué
  - [ ] `auditSuperadminContext` middleware actif
  - [ ] Tests unitaires passent (voir tests.md)
  - [ ] Aucune requête SQL sans `organization_id` filter
  - [ ] Rate limiting configuré sur `/org/all`

- [ ] **Frontend**
  - [ ] Page `/admin` accessible au superadmin uniquement
  - [ ] localStorage validation implémentée
  - [ ] Sélecteur d'org fully functional
  - [ ] Banner mode admin distinctif
  - [ ] Tests E2E passent

- [ ] **Monitoring**
  - [ ] Alertes sur accès superadmin configurées
  - [ ] Logs centralisés (ELK/DataDog/etc)
  - [ ] Dashboard "Superadmin Activities"

- [ ] **Documentation**
  - [ ] Équipe support formée
  - [ ] Runbook pour support incidents
  - [ ] Procédure escalade documentée

---

## 🔍 Requêtes de Vérification DB

### Vérifier l'intégrité des données

```sql
-- 1. Aucune donnée orpheline (sans org)
SELECT COUNT(*) FROM users WHERE organization_id IS NULL;
SELECT COUNT(*) FROM missions WHERE organization_id IS NULL;
SELECT COUNT(*) FROM sites WHERE organization_id IS NULL;

-- ✓ Résultat attendu: 0 pour tous

-- 2. Vérifier la distribution des données par org
SELECT 
  organization_id,
  COUNT(*) as agents,
  (SELECT COUNT(*) FROM missions m WHERE m.organization_id = u.organization_id) as missions
FROM users u
GROUP BY organization_id
ORDER BY agents DESC;

-- 3. Audit trail complet
SELECT COUNT(*) FROM audit_logs WHERE user_id = 'SUPERADMIN_UUID';

-- 4. Aucun doublon d'accès (même org deux fois en <1s)
SELECT 
  user_id, 
  organization_id, 
  COUNT(*) as cnt,
  MAX(created_at) as last_access
FROM audit_logs
WHERE action = 'SUPERADMIN_ORG_SELECTED'
GROUP BY user_id, organization_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;
```

---

## 📊 Exemple de Rapport d'Audit

```sql
SELECT 
  u.email,
  u.first_name || ' ' || u.last_name as superadmin_name,
  COUNT(*) as total_actions,
  COUNT(DISTINCT organization_id) as orgs_accessed,
  MAX(al.created_at) as last_action,
  ARRAY_AGG(DISTINCT o.name) as accessed_orgs
FROM audit_logs al
JOIN users u ON u.id = al.user_id
LEFT JOIN organizations o ON o.id = al.organization_id
WHERE u.role = 'superadmin'
  AND al.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.id, u.email, u.first_name, u.last_name
ORDER BY total_actions DESC;
```

**Résultat attendu:**
```
superadmin_name | total_actions | orgs_accessed | last_action         | accessed_orgs
─────────────────────────────────────────────────────────────────────────────────
John Dev        | 247          | 8             | 2024-04-30 14:32:15 | {DZEDZE Demo, Client A, Client B, ...}
```

---

## 🚨 Problèmes Courants & Solutions

| Problème | Symptôme | Solution |
|----------|----------|----------|
| **Org non sélectionnée** | Erreur 400 au chaque appel | Implémenter `requireOrgContext` + Frontend validation |
| **Données visibles d'autre org** | Superadmin voit agents d'org B en accédant org A | Vérifier TOUS les queries ont WHERE organization_id |
| **localStorage persist après delete** | Data d'org supprimée toujours en cache | Implémenter validation API au load |
| **Audit log manquant** | Pas de traces d'accès superadmin | Vérifier middleware `auditSuperadminContext` appliqué |
| **Rate limit bypass** | Superadmin peut spam `/org/all` | Appliquer rate limiting sur endpoints sensibles |

