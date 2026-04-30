# Diagrammes d'Architecture - Accès Superadmin

## Flux Général: Superadmin Access Flow

```mermaid
sequenceDiagram
    participant SA as Superadmin
    participant Frontend as Frontend<br/>(React)
    participant API as Backend<br/>(Node.js)
    participant DB as PostgreSQL
    participant Audit as Audit Logs

    SA->>Frontend: 1. Login avec credentials
    Frontend->>API: POST /auth/login
    API->>DB: Vérifier credentials
    DB-->>API: user.role = "superadmin", pas d'orgId
    API-->>Frontend: accessToken (sans orgId)
    Frontend->>Frontend: 2. Store token<br/>Afficher page Admin

    SA->>Frontend: 3. Sélectionner "Client ABC" org
    Frontend->>API: POST /org/validate-selection
    API->>DB: SELECT * FROM organizations WHERE id=?
    DB-->>API: ✓ Organization trouvée
    API-->>Frontend: ✓ Validation réussie
    Frontend->>Frontend: localStorage.setItem('selectedOrgId')<br/>X-Org-Id injected

    SA->>Frontend: 4. Consulter les agents
    Frontend->>API: GET /users<br/>Header: X-Org-Id=ABC
    API->>API: 5. Middleware: getOrgContext()<br/>Récupère X-Org-Id
    API->>API: 6. Middleware: validateOrgExists()<br/>Vérifie org existe
    API->>DB: 7. Query: SELECT * FROM users<br/>WHERE organization_id = 'ABC'
    DB-->>API: Agents de Client ABC (12)
    API->>Audit: Log: SUPERADMIN_ORG_SELECTED | orgId=ABC
    API-->>Frontend: Agents data
    Frontend-->>SA: Affiche dashboard Client ABC

    SA->>Frontend: 5. Retour vue globale
    Frontend->>Frontend: localStorage.removeItem('selectedOrgId')
    Frontend-->>SA: Retour au sélecteur (tous les tenants)
```

---

## Architecture Base de Données

```mermaid
erDiagram
    USERS ||--o{ ORGANIZATIONS : "organization_id"
    MISSIONS ||--o{ ORGANIZATIONS : "organization_id"
    SITES ||--o{ ORGANIZATIONS : "organization_id"
    MEDIA ||--o{ ORGANIZATIONS : "organization_id"
    USERS ||--o{ MISSIONS : "agent_id"
    AUDIT_LOGS ||--o{ ORGANIZATIONS : "organization_id (optional)"
    USERS ||--o{ AUDIT_LOGS : "user_id"

    USERS {
        UUID id PK
        string email
        string password_hash
        string role "superadmin|admin|manager|agent"
        UUID organization_id FK "NULL pour superadmin"
    }

    ORGANIZATIONS {
        UUID id PK
        string name
        string plan
        boolean is_active
        timestamp created_at
    }

    MISSIONS {
        UUID id PK
        UUID site_id FK
        UUID agent_id FK
        UUID organization_id FK "← Clé d'isolation"
    }

    SITES {
        UUID id PK
        UUID organization_id FK "← Clé d'isolation"
    }

    MEDIA {
        UUID id PK
        UUID organization_id FK "← Clé d'isolation"
    }

    AUDIT_LOGS {
        UUID id PK
        UUID user_id FK
        string action "SUPERADMIN_ORG_SELECTED"
        UUID organization_id FK "← Tracer contexte accès"
    }
```

---

## Middleware Chain Request

```mermaid
flowchart TD
    A["1️⃣ Requête reçue<br/>GET /api/v1/users<br/>Header: X-Org-Id = ABC"]
    B["2️⃣ Middleware: authenticate<br/>Vérifie JWT valide<br/>Récupère user.role"]
    C{"3️⃣ Middleware: validateOrgExists<br/>L'org ABC existe?"}
    D["❌ 404: Organisation<br/>introuvable"]
    E["4️⃣ Middleware: requireOrgContext<br/>Superadmin a sélectionné une org?"]
    F["❌ 400: X-Org-Id<br/>manquant"]
    G["5️⃣ Middleware: auditSuperadminContext<br/>Log l'accès"]
    H["6️⃣ Controller: listUsers<br/>getOrgContext() → ABC<br/>Query: WHERE org_id = ABC"]
    I["7️⃣ DB Retour<br/>Utilisateurs d'org ABC"]
    J["8️⃣ Response 200<br/>Data filtré"]

    A --> B
    B --> C
    C -->|Non| D
    C -->|Oui| E
    E -->|Superadmin + pas de X-Org-Id| F
    E -->|OK| G
    G --> H
    H --> I
    I --> J

    style A fill:#e1f5ff
    style D fill:#ffcdd2
    style F fill:#ffcdd2
    style J fill:#c8e6c9
    style H fill:#fff3e0
```

---

## Isolation Tenant - Garantie SQL

```mermaid
flowchart LR
    A["SELECT * FROM users<br/>WHERE organization_id = X"]
    B["Données Org A:<br/>- Agent 1<br/>- Agent 2"]
    C["Données Org B:<br/>- Agent 3<br/>- Agent 4"]
    D["Base de Données"]
    E["Superadmin accède Org A<br/>X-Org-Id = A"]
    F["Superadmin voit<br/>SEULEMENT Org A"]
    G["Pas d'accès Org B"]

    E --> A
    D --> B
    D --> C
    A --> F
    F --> G
    
    style E fill:#e1f5ff
    style F fill:#c8e6c9
    style G fill:#ffcdd2
    style A fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    linkStyle 4 stroke:#00b050,stroke-width:3px
    linkStyle 5 stroke:#c00000,stroke-width:3px
```

---

## Frontend: State Management Flow

```mermaid
flowchart TD
    A["Superadmin Login<br/>JWT sans orgId"]
    B["useAuthStore.setAuth()"]
    C["state: selectedOrgId = null<br/>selectedOrgName = null"]
    D["Page Admin chargée<br/>Affiche sélecteur orgs"]
    E["User click: 'DZEDZE Demo'"]
    F["handleSelectOrg()"]
    G["Validation API<br/>POST /org/validate"]
    H{"Org existe<br/>et active?"}
    I["❌ Alert error<br/>localStorage cleared"]
    J["✓ selectOrg()"]
    K["localStorage.setItem<br/>selectedOrgId = ABC<br/>selectedOrgName = DZEDZE"]
    L["state: selectedOrgId = ABC"]
    M["API Interceptor<br/>X-Org-Id injected"]
    N["Requête vers backend<br/>avec contexte org"]
    O["Dashboard affiche<br/>données org ABC"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H -->|Non| I
    H -->|Oui| J
    J --> K
    K --> L
    L --> M
    M --> N
    N --> O

    style A fill:#e1f5ff
    style L fill:#c8e6c9
    style O fill:#c8e6c9
    style I fill:#ffcdd2
    style M fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
```

---

## Security Layers - Defense in Depth

```mermaid
flowchart LR
    A["Attaque:<br/>X-Org-Id: null"]
    B["Layer 1: requireOrgContext<br/>400 Error"]
    C["Rejet"]
    
    D["Attaque:<br/>X-Org-Id: invalid-uuid"]
    E["Layer 2: validateOrgExists<br/>DB check"]
    F["404 Error"]
    
    G["Attaque:<br/>X-Org-Id: org-C<br/>Token: superadmin"]
    H["Layer 3: Controller Query<br/>WHERE org_id = C<br/>+ audit log"]
    I["✓ Données Org C<br/>seulement"]
    
    J["Attaque:<br/>X-Org-Id: org-D<br/>Token: agent-org-A"]
    K["Layer 4: getOrgContext<br/>Ignores header<br/>Uses JWT orgId"]
    L["✓ Données Org A<br/>seulement"]

    A --> B --> C
    D --> E --> F
    G --> H --> I
    J --> K --> L

    style C fill:#ffcdd2
    style F fill:#ffcdd2
    style I fill:#c8e6c9
    style L fill:#c8e6c9
    style B fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style E fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style H fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
    style K fill:#fff3e0,stroke:#ff6f00,stroke-width:2px
```

---

## Audit Trail - Superadmin Actions

```mermaid
timeline
    title Superadmin Session Audit Log
    
    14:05:00 : superadmin_1 : SUPERADMIN_NO_ORG : GET /users : 400
    14:05:15 : superadmin_1 : SUPERADMIN_ORG_SELECTED : org_id=ABC : IP=192.168.1.100
    14:05:20 : superadmin_1 : USER_LISTED : org_id=ABC : Consulted 12 agents
    14:06:00 : superadmin_1 : USER_UPDATED : org_id=ABC : Agent reset session
    14:06:05 : superadmin_1 : SUPERADMIN_NO_ORG : localStorage cleared : Retour vue globale
    14:06:10 : superadmin_1 : SUPERADMIN_ORG_SELECTED : org_id=XYZ : IP=192.168.1.100
    14:06:45 : superadmin_1 : SUPERADMIN_NO_ORG : Logout
```

---

## Implementation Phases Timeline

```mermaid
gantt
    title Implementation Timeline - 3 Phases
    dateFormat YYYY-MM-DD
    
    section Phase 1
    Backend Middleware        :phase1a, 2024-04-30, 3h
    Audit Logs               :phase1b, after phase1a, 2h
    Integration              :phase1c, after phase1b, 2h
    Tests                    :phase1d, after phase1c, 3h
    
    section Phase 2
    Page /admin              :phase2a, after phase1d, 4h
    Components               :phase2b, after phase2a, 3h
    Frontend Integration     :phase2c, after phase2b, 2h
    
    section Phase 3
    Support Tickets          :phase3a, after phase2c, 6h
    Impersonation            :phase3b, after phase3a, 4h
    Compliance               :phase3c, after phase3b, 3h
    Documentation            :phase3d, after phase3c, 2h
```

---

## State Diagram: Superadmin Access States

```mermaid
stateDiagram-v2
    [*] --> LoginPage: Non authentifié
    LoginPage --> Unauthenticated: Login échoue
    LoginPage --> NoOrgSelected: ✓ Login réussi<br/>JWT sans orgId
    
    Unauthenticated --> LoginPage: Retry
    
    NoOrgSelected --> OrgSelector: Accès /admin
    NoOrgSelected --> BlockedAccess: Tentative /users<br/>sans X-Org-Id
    
    OrgSelector --> SelectingOrg: Affiche liste orgs
    SelectingOrg --> OrgValidation: User click org
    OrgValidation --> OrgSelectedError: ❌ Org inexistante
    OrgValidation --> OrgSelected: ✓ Validation réussie
    OrgSelectedError --> OrgSelector: Affiche error
    OrgSelectedError --> NoOrgSelected: localStorage cleared
    
    BlockedAccess --> NoOrgSelected: 400 Error + retry
    
    OrgSelected --> DashboardOrgData: X-Org-Id injected
    DashboardOrgData --> DashboardOrgData: Navigation intra-org
    
    OrgSelected --> SelectingOrg: Changer org
    
    OrgSelected --> NoOrgSelected: Click "Retour"
    OrgSelected --> [*]: Logout
    
    style OrgSelected fill:#c8e6c9
    style OrgSelectedError fill:#ffcdd2
    style BlockedAccess fill:#ffcdd2
    style DashboardOrgData fill:#c8e6c9
```

---

## API Endpoints - Superadmin Operations

```mermaid
graph TD
    Admin["🔐 Superadmin Endpoints"]
    
    Admin -->|Public| Login["POST /auth/login<br/>→ JWT sans orgId"]
    Admin -->|Auth Required| Validate["POST /org/validate-selection<br/>body: orgId<br/>→ Valide org existe"]
    Admin -->|Data Access| AllOrgs["GET /org/all<br/>header: Authorization<br/>→ Liste ALL orgs"]
    
    Admin -->|Scoped by Org| Users["GET /users<br/>header: X-Org-Id=ABC<br/>→ Users d'org ABC"]
    Admin -->|Scoped by Org| Missions["GET /missions<br/>header: X-Org-Id=ABC<br/>→ Missions d'org ABC"]
    Admin -->|Scoped by Org| Sites["GET /sites<br/>header: X-Org-Id=ABC<br/>→ Sites d'org ABC"]
    
    Admin -->|Audit| AuditLogs["GET /admin/audit-logs<br/>header: Authorization<br/>→ Accès superadmin history"]
    
    style Login fill:#e1f5ff
    style Validate fill:#e1f5ff
    style AllOrgs fill:#fff3e0
    style Users fill:#fff3e0
    style Missions fill:#fff3e0
    style Sites fill:#fff3e0
    style AuditLogs fill:#f3e5f5
    style Admin fill:#fff9c4,stroke:#333,stroke-width:3px
```

