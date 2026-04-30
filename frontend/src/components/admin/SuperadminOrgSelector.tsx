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
      // Validate on backend first
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
