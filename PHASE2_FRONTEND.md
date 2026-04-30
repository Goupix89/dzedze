# Phase 2: Interface Superadmin Dédiée

## 1. Créer une Page Admin Complète

Créer `frontend/src/pages/AdminPage.tsx`:

```typescript
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, Activity, AlertTriangle, 
  LogOut, Clock, Shield, ChevronRight 
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { SuperadminOrgSelector } from '../components/admin/SuperadminOrgSelector';
import { TenantsOverview } from '../components/admin/TenantsOverview';
import { SupportTickets } from '../components/admin/SupportTickets';
import { clsx } from 'clsx';

// ── Banner spécial mode admin ──────────────────────────────────
function AdminModeBanner() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="bg-red-900/40 border-b-2 border-red-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-red-400" />
          <div>
            <p className="text-sm font-bold text-red-200">MODE SUPERADMIN</p>
            <p className="text-xs text-red-300">Bienvenue {user?.first_name} · Support client</p>
          </div>
        </div>
        <button
          onClick={() => {
            clearAuth();
            navigate('/login');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-700/50 hover:bg-red-700 rounded-lg text-red-100 text-sm transition-colors"
        >
          <LogOut size={14} />
          Déconnecter
        </button>
      </div>
    </div>
  );
}

// ── Tabs Navigation ────────────────────────────────────────────
interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

function AdminTabs({ 
  activeTab, 
  setActiveTab, 
  tabs 
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  tabs: TabConfig[];
}) {
  return (
    <div className="border-b border-guin-border">
      <div className="flex gap-1 px-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium',
                isActive
                  ? 'border-guin-gold text-guin-gold'
                  : 'border-transparent text-guin-cream-dim hover:text-guin-cream'
              )}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-2 py-0.5 bg-guin-muted/30 rounded text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('selector');
  const navigate = useNavigate();

  // Rediriger si pas superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-guin-cream mb-2">Accès Refusé</h2>
        <p className="text-guin-cream-dim">Cette page est réservée aux superadmins.</p>
      </div>
    );
  }

  const tabs: TabConfig[] = [
    { id: 'selector', label: 'Sélectionner Tenant', icon: Building2 },
    { id: 'overview', label: 'Vue d\'ensemble', icon: Activity },
    { id: 'support', label: 'Support Client', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-guin-bg flex flex-col">
      <AdminModeBanner />

      <div className="flex-1 flex flex-col">
        <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

        <div className="flex-1 overflow-auto">
          {activeTab === 'selector' && <SuperadminOrgSelector />}
          {activeTab === 'overview' && <TenantsOverview />}
          {activeTab === 'support' && <SupportTickets />}
        </div>
      </div>
    </div>
  );
}
```

---

## 2. Composant: Sélecteur d'Organisation Amélioré

Créer `frontend/src/components/admin/SuperadminOrgSelector.tsx`:

```typescript
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Search, Copy, CheckCircle2, AlertCircle, 
  Users, Activity, Calendar, TrendingUp 
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrgInfo {
  id: string;
  name: string;
  plan: string;
  is_active: boolean;
  created_at: string;
  users_count: number;
  missions_count: number;
  active_missions: number;
  owner_email: string;
  owner_name: string;
}

export function SuperadminOrgSelector() {
  const { selectOrg, selectedOrgId } = useAuthStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['all-orgs'],
    queryFn: () => apiClient.get('/org/all').then(r => r.data.data),
    refetchInterval: 30000,
  });

  const filteredOrgs = (orgs ?? []).filter((o: OrgInfo) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.owner_email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSelectOrg(orgId: string, orgName: string) {
    setLoading(true);
    try {
      // Valider auprès du backend
      await apiClient.post('/org/validate-selection', { orgId });
      selectOrg(orgId, orgName);
      qc.invalidateQueries();
    } catch (err) {
      alert('Erreur: Organisation inaccessible');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-guin-cream mb-2">
          Sélectionner un Tenant
        </h1>
        <p className="text-guin-cream-dim">
          Choisissez une agence pour accéder à ses données et fournir du support
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search size={18} className="absolute left-4 top-3.5 text-guin-muted" />
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-guin-card border border-guin-border rounded-lg pl-11 pr-4 py-3 text-guin-cream placeholder-guin-muted/50 focus:outline-none focus:border-guin-gold/50 transition-colors"
        />
      </div>

      {/* Orgs Grid */}
      <div className="grid gap-4">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="col-span-full py-12 text-center text-guin-muted">
              Chargement des tenants...
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="col-span-full py-12 text-center text-guin-muted">
              Aucun tenant trouvé
            </div>
          ) : (
            filteredOrgs.map((org: OrgInfo) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={clsx(
                  'border rounded-lg p-4 cursor-pointer transition-all hover:border-guin-gold/50',
                  selectedOrgId === org.id
                    ? 'bg-guin-gold/10 border-guin-gold'
                    : 'bg-guin-card border-guin-border hover:bg-guin-card/80'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-guin-cream">
                        {org.name}
                      </h3>
                      <span className={clsx(
                        'px-2 py-1 text-xs rounded font-medium',
                        org.is_active
                          ? 'bg-guin-green-light/20 text-guin-green-light'
                          : 'bg-red-500/20 text-red-300'
                      )}>
                        {org.is_active ? 'Actif' : 'Inactif'}
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-guin-indigo/30 text-guin-indigo-light font-medium">
                        {org.plan}
                      </span>
                    </div>
                    <p className="text-sm text-guin-cream-dim mt-1">
                      Manager: {org.owner_name} ({org.owner_email})
                    </p>
                  </div>

                  <button
                    onClick={() => handleSelectOrg(org.id, org.name)}
                    disabled={loading || !org.is_active}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                      selectedOrgId === org.id
                        ? 'bg-guin-gold text-guin-bg'
                        : 'bg-guin-indigo/30 text-guin-indigo-light hover:bg-guin-indigo/50'
                    )}
                  >
                    {selectedOrgId === org.id ? (
                      <>
                        <CheckCircle2 size={16} />
                        Sélectionné
                      </>
                    ) : (
                      <>
                        <Activity size={16} />
                        Accéder
                      </>
                    )}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                  <div className="flex items-center gap-2 text-guin-cream-dim">
                    <Users size={14} />
                    <span>{org.users_count} agents</span>
                  </div>
                  <div className="flex items-center gap-2 text-guin-cream-dim">
                    <Activity size={14} />
                    <span>{org.missions_count} missions</span>
                  </div>
                  <div className="flex items-center gap-2 text-guin-cream-dim">
                    <TrendingUp size={14} />
                    <span>{org.active_missions} en cours</span>
                  </div>
                  <div className="flex items-center gap-2 text-guin-cream-dim">
                    <Calendar size={14} />
                    <span>{format(new Date(org.created_at), 'd MMM yyyy', { locale: fr })}</span>
                  </div>
                </div>

                {/* ID Copy */}
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-guin-bg/50 px-2 py-1 rounded text-guin-gold font-mono">
                    {org.id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(org.id)}
                    className="text-guin-muted hover:text-guin-cream transition-colors"
                    title="Copier l'ID"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

---

## 3. Composant: Vue d'Ensemble des Tenants

Créer `frontend/src/components/admin/TenantsOverview.tsx`:

```typescript
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, Users, Zap, AlertCircle, 
  Calendar, DollarSign 
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface OrgStats {
  id: string;
  name: string;
  plan: string;
  users_count: number;
  missions_count: number;
  active_missions: number;
  trial_ends_at: string | null;
  sub_status: string;
}

export function TenantsOverview() {
  const { selectedOrgId, selectedOrgName } = useAuthStore();

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['all-orgs'],
    queryFn: () => apiClient.get('/org/all').then(r => r.data.data),
  });

  if (!selectedOrgId) {
    return (
      <div className="p-6 text-center text-guin-cream-dim">
        Sélectionnez un tenant pour voir ses détails
      </div>
    );
  }

  const selectedOrg = orgs?.find((o: OrgStats) => o.id === selectedOrgId);

  if (isLoading) {
    return <div className="p-6 text-center text-guin-muted">Chargement...</div>;
  }

  if (!selectedOrg) {
    return (
      <div className="p-6 text-center text-red-400">
        Tenant introuvable
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-guin-cream">
          Vue d'Ensemble: {selectedOrgName}
        </h2>
        <p className="text-guin-cream-dim text-sm mt-1">
          ID: {selectedOrgId}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Agents"
          value={selectedOrg.users_count}
          color="#D4A017"
        />
        <StatCard
          icon={Calendar}
          label="Missions Total"
          value={selectedOrg.missions_count}
          color="#2D6A4F"
        />
        <StatCard
          icon={Zap}
          label="En Cours"
          value={selectedOrg.active_missions}
          color="#C1440E"
        />
        <StatCard
          icon={TrendingUp}
          label="Plan"
          value={selectedOrg.plan.toUpperCase()}
          color="#1E2D5A"
        />
      </div>

      <div className="bg-guin-card border border-guin-border rounded-lg p-6">
        <h3 className="text-lg font-bold text-guin-cream mb-4">
          Informations d'Abonnement
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-guin-cream-dim text-sm mb-1">Statut</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium
              ${selectedOrg.sub_status === 'active' 
                ? 'bg-guin-green-light/20 text-guin-green-light'
                : 'bg-red-500/20 text-red-300'
              }`}>
              {selectedOrg.sub_status}
            </span>
          </div>
          {selectedOrg.trial_ends_at && (
            <div>
              <p className="text-guin-cream-dim text-sm mb-1">Essai jusqu'au</p>
              <p className="text-guin-cream">
                {format(new Date(selectedOrg.trial_ends_at), 'd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-guin-card border border-guin-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div style={{ backgroundColor: `${color}22` }} className="p-2 rounded-lg">
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <p className="text-guin-cream-dim text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-guin-cream">{value}</p>
    </div>
  );
}
```

---

## 4. Composant: Support Tickets (Placeholder)

Créer `frontend/src/components/admin/SupportTickets.tsx`:

```typescript
import React from 'react';
import { AlertCircle } from 'lucide-react';

export function SupportTickets() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-guin-card border border-guin-border rounded-lg p-12 text-center">
        <AlertCircle size={48} className="mx-auto text-guin-muted mb-4" />
        <h3 className="text-lg font-bold text-guin-cream mb-2">
          Module Support Tickets
        </h3>
        <p className="text-guin-cream-dim">
          À développer: Système de tickets d'aide pour les tenants
        </p>
      </div>
    </div>
  );
}
```

---

## 5. Protéger la Route Admin

Ajouter à `frontend/src/App.tsx`:

```typescript
import AdminPage from './pages/AdminPage';
import { useAuthStore } from './store/auth.store';

export default function App() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Routes protégées */}
      <Route 
        path="/dashboard" 
        element={user ? <DashboardPage /> : <Navigate to="/login" />} 
      />

      {/* Route Admin - Superadmin seulement */}
      <Route 
        path="/admin" 
        element={user?.role === 'superadmin' ? <AdminPage /> : <Navigate to="/dashboard" />} 
      />

      {/* Autres routes... */}
    </Routes>
  );
}
```

---

## 6. Navigation: Ajouter lien Admin

Mettre à jour layout pour afficher un lien Admin si superadmin:

```typescript
// frontend/src/components/layout/Navigation.tsx
import { Shield } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { Link } from 'react-router-dom';

export function Navigation() {
  const { user } = useAuthStore();

  return (
    <nav>
      {/* ... existing nav items ... */}
      
      {user?.role === 'superadmin' && (
        <Link
          to="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700/20 text-red-300 hover:bg-red-700/30 transition-colors"
        >
          <Shield size={16} />
          Console Admin
        </Link>
      )}
    </nav>
  );
}
```

---

## ✅ Résumé Phase 2

- ✅ Page `/admin` dédiée au superadmin
- ✅ Sélecteur d'org visuel avec stats
- ✅ Vue d'ensemble du tenant sélectionné
- ✅ Bannière mode admin rouge distinctive
- ✅ Validation backend au changement d'org
- ✅ Protection des routes

