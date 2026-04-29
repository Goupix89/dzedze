import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Loader2, AlertCircle, Users, MapPin, TrendingUp } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { clsx } from 'clsx';

// ── Types ─────────────────────────────────────────────────────
interface OrgData {
  id: string;
  name: string;
  plan: string;
  planName: string;
  priceFcfa: number;
  agentLimit: number;
  siteLimit: number;
  trialEndsAt: string | null;
  isActive: boolean;
  usage: { agentsUsed: number; sitesUsed: number; missionsThisMonth: number };
  subscriptions: Array<{
    id: string; plan: string; price_fcfa: number;
    status: string; starts_at: string; ends_at: string | null; payment_ref: string | null;
  }>;
}

interface PlanInfo {
  id: string; name: string; priceFcfa: number;
  agentLimit: number; siteLimit: number;
  features: string[]; platforms: string[];
}

// ── Plan colors ───────────────────────────────────────────────
const PLAN_COLOR: Record<string, string> = {
  trial:      '#6B7280',
  essential:  '#D4A017',
  business:   '#2D6A4F',
  enterprise: '#C1440E',
};

// ── Progress bar ──────────────────────────────────────────────
function UsageBar({ label, used, limit, icon: Icon, color }: {
  label: string; used: number; limit: number; icon: React.ElementType; color: string;
}) {
  const unlimited = limit < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const warn = !unlimited && pct >= 80;
  return (
    <div className="bg-guin-dark rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-guin-cream">
          <Icon size={15} style={{ color }} />
          {label}
        </div>
        <span className="text-xs text-guin-muted">
          {used} / {unlimited ? '∞' : limit}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 bg-guin-border rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: warn ? '#EF4444' : color }}
          />
        </div>
      )}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({
  plan, current, onUpgrade, loading,
}: {
  plan: PlanInfo; current: string; onUpgrade: (id: string) => void; loading: string | null;
}) {
  const isCurrent = plan.id === current;
  const color = PLAN_COLOR[plan.id] ?? '#6B7280';
  const canUpgrade = plan.id !== 'trial' && !isCurrent;

  return (
    <div className={clsx(
      'relative rounded-2xl border-2 p-5 transition-all',
      isCurrent ? 'bg-white/5' : 'bg-guin-dark border-guin-border',
    )} style={{ borderColor: isCurrent ? color : undefined }}>
      {isCurrent && (
        <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-bold text-white rounded-full"
          style={{ backgroundColor: color }}>
          Plan actuel
        </span>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-white">{plan.name}</p>
          <p className="text-xs text-guin-muted">
            {plan.agentLimit < 0 ? 'Illimité' : plan.agentLimit} agents ·{' '}
            {plan.siteLimit < 0 ? 'Illimité' : plan.siteLimit} sites
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg" style={{ color }}>
            {plan.priceFcfa === 0 ? 'Gratuit' : `${plan.priceFcfa.toLocaleString('fr')} FCFA`}
          </p>
          {plan.priceFcfa > 0 && <p className="text-xs text-guin-muted">/ mois</p>}
        </div>
      </div>

      <ul className="space-y-1 mb-4">
        {plan.features.slice(0, 5).map(f => (
          <li key={f} className="flex items-center gap-1.5 text-xs text-guin-cream">
            <Check size={11} style={{ color }} className="flex-shrink-0" />
            {f}
          </li>
        ))}
        {plan.features.length > 5 && (
          <li className="text-xs text-guin-muted pl-[19px]">+ {plan.features.length - 5} autres</li>
        )}
      </ul>

      {canUpgrade && (
        <button
          onClick={() => onUpgrade(plan.id)}
          disabled={loading === plan.id}
          className="w-full py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-1"
          style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {loading === plan.id ? (
            <><Loader2 size={12} className="animate-spin" /> Traitement…</>
          ) : (
            <><Zap size={12} /> Passer à ce plan</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function SubscriptionPage() {
  const { organization, setAuth, user } = useAuthStore();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/org/me'),
      apiClient.get('/org/plans'),
    ]).then(([orgRes, plansRes]) => {
      setOrg(orgRes.data.data);
      setPlans(plansRes.data.data);
    }).catch(() => setError('Impossible de charger les données.')).finally(() => setLoadingOrg(false));
  }, []);

  async function handleUpgrade(planId: string) {
    setUpgradeLoading(planId);
    setError(null); setSuccess(null);
    try {
      const res = await apiClient.post('/org/upgrade', { plan: planId });
      setSuccess(res.data.message);
      // Refresh org
      const orgRes = await apiClient.get('/org/me');
      const updatedOrg = orgRes.data.data;
      setOrg(updatedOrg);
      if (user) {
        setAuth({
          user,
          organization: {
            id: updatedOrg.id, name: updatedOrg.name, plan: updatedOrg.plan,
            planName: updatedOrg.planName, priceFcfa: updatedOrg.priceFcfa,
            features: updatedOrg.features, platforms: updatedOrg.platforms,
            agentLimit: updatedOrg.agentLimit, siteLimit: updatedOrg.siteLimit,
            trialEndsAt: updatedOrg.trialEndsAt, isActive: updatedOrg.isActive,
          },
        });
      }
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors du changement de plan.');
    } finally {
      setUpgradeLoading(null);
    }
  }

  if (loadingOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-guin-gold" />
      </div>
    );
  }

  const currentPlan = org?.plan ?? organization?.plan ?? 'trial';
  const planColor = PLAN_COLOR[currentPlan] ?? '#6B7280';

  const trialDays = org?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Abonnement</h1>
        <p className="text-guin-muted text-sm mt-1">Gérez votre plan et suivez votre utilisation</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800 rounded-xl">
          <AlertCircle size={15} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-green-900/20 border border-green-800 rounded-xl">
          <Check size={15} className="text-green-400 mt-0.5 flex-shrink-0" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {/* Current plan summary */}
      {org && (
        <div className="bg-guin-card border border-guin-border rounded-2xl overflow-hidden">
          <div className="h-1" style={{ backgroundColor: planColor }} />
          <div className="p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-guin-muted text-xs uppercase tracking-widest mb-1">Plan actuel</p>
                <p className="text-2xl font-bold text-white">{org.planName}</p>
                {trialDays !== null && (
                  <p className="text-xs mt-1" style={{ color: trialDays <= 3 ? '#EF4444' : planColor }}>
                    {trialDays > 0 ? `Essai gratuit · ${trialDays} jour${trialDays > 1 ? 's' : ''} restant${trialDays > 1 ? 's' : ''}` : 'Essai expiré'}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: planColor }}>
                  {org.priceFcfa === 0 ? 'Gratuit' : `${org.priceFcfa.toLocaleString('fr')} FCFA`}
                </p>
                {org.priceFcfa > 0 && <p className="text-xs text-guin-muted">/ mois</p>}
              </div>
            </div>

            {/* Usage bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <UsageBar
                label="Agents" used={org.usage.agentsUsed} limit={org.agentLimit}
                icon={Users} color={planColor}
              />
              <UsageBar
                label="Sites" used={org.usage.sitesUsed} limit={org.siteLimit}
                icon={MapPin} color={planColor}
              />
              <div className="bg-guin-dark rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1 text-sm text-guin-cream">
                  <TrendingUp size={15} style={{ color: planColor }} />
                  Missions ce mois
                </div>
                <p className="text-2xl font-bold" style={{ color: planColor }}>
                  {org.usage.missionsThisMonth}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans comparison */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Changer de plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={currentPlan}
              onUpgrade={handleUpgrade}
              loading={upgradeLoading}
            />
          ))}
        </div>
        <p className="text-xs text-guin-muted mt-3">
          Pour les paiements, contactez notre équipe ou utilisez Mobile Money. Référence de paiement requise.
        </p>
      </div>

      {/* Subscription history */}
      {org?.subscriptions && org.subscriptions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Historique des abonnements</h2>
          <div className="bg-guin-card border border-guin-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-guin-border">
                  <th className="text-left px-4 py-3 text-xs text-guin-muted font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-xs text-guin-muted font-medium">Montant</th>
                  <th className="text-left px-4 py-3 text-xs text-guin-muted font-medium">Statut</th>
                  <th className="text-left px-4 py-3 text-xs text-guin-muted font-medium">Début</th>
                  <th className="text-left px-4 py-3 text-xs text-guin-muted font-medium">Réf. paiement</th>
                </tr>
              </thead>
              <tbody>
                {org.subscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-guin-border/50 hover:bg-white/2">
                    <td className="px-4 py-3 text-guin-cream capitalize">{sub.plan}</td>
                    <td className="px-4 py-3 text-guin-cream">
                      {sub.price_fcfa === 0 ? 'Gratuit' : `${sub.price_fcfa.toLocaleString('fr')} FCFA`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        sub.status === 'active' && 'bg-green-900/30 text-green-400',
                        sub.status === 'trial'  && 'bg-yellow-900/30 text-yellow-400',
                        sub.status === 'cancelled' && 'bg-gray-700 text-gray-400',
                        sub.status === 'expired' && 'bg-red-900/30 text-red-400',
                      )}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-guin-muted text-xs">
                      {new Date(sub.starts_at).toLocaleDateString('fr')}
                    </td>
                    <td className="px-4 py-3 text-guin-muted text-xs font-mono">
                      {sub.payment_ref ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
