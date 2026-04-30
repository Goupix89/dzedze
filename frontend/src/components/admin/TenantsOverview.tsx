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

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value,
  color 
}: StatCardProps) {
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
