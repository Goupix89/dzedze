import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Star, Wifi, LogOut, Timer, BarChart2,
  Building2, ChevronDown, X,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { apiClient } from '../services/api';
import { MissionTimeline } from '../components/missions/MissionTimeline';
import { AgentCard } from '../components/dashboard/AgentCard';
import { useAuthStore } from '../store/auth.store';
import { clsx } from 'clsx';

// ── Superadmin org selector ────────────────────────────────────
function SuperadminOrgBanner() {
  const { selectedOrgId, selectedOrgName, selectOrg } = useAuthStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [validating, setValidating] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ['all-orgs'],
    queryFn: () => apiClient.get('/org/all').then(r => r.data.data),
  });

  async function pick(id: string, name: string) {
    setValidating(true);
    try {
      // Validate on backend first
      await apiClient.post('/org/validate-selection', { orgId: id });
      selectOrg(id, name);
      setOpen(false);
      qc.invalidateQueries();
    } catch (err: any) {
      alert('Erreur: Organisation inaccessible\n' + (err.response?.data?.message || ''));
      selectOrg(null, null);
    } finally {
      setValidating(false);
    }
  }

  function clearOrg() {
    selectOrg(null, null);
    qc.invalidateQueries();
  }

  return (
    <div className="bg-guin-indigo/20 border-b border-guin-indigo/40 px-6 py-2 flex items-center gap-3">
      <Building2 size={14} className="text-guin-indigo-light" />
      <span className="text-xs text-guin-indigo-light font-medium">Vue Superadmin ·</span>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={validating}
          className="flex items-center gap-1.5 text-xs bg-guin-card border border-guin-border rounded-lg px-3 py-1 text-guin-cream hover:border-guin-gold/50 transition-colors disabled:opacity-50"
        >
          {selectedOrgName ?? 'Toutes les agences'}
          <ChevronDown size={11} />
        </button>

        {open && (
          <div className="absolute top-8 left-0 z-50 bg-guin-card border border-guin-border rounded-xl shadow-xl w-64 overflow-hidden">
            <button
              onClick={() => { clearOrg(); setOpen(false); }}
              className="w-full px-4 py-2.5 text-xs text-left text-guin-cream-dim hover:bg-white/5 border-b border-guin-border"
            >
              Toutes les agences
            </button>
            <div className="max-h-60 overflow-y-auto">
              {(orgs ?? []).map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => pick(o.id, o.name)}
                  disabled={validating}
                  className={clsx(
                    'w-full px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-colors disabled:opacity-50',
                    selectedOrgId === o.id ? 'text-guin-gold' : 'text-guin-cream',
                  )}
                >
                  <p className="font-medium">{o.name}</p>
                  <p className="text-guin-muted">{o.plan} · {o.users_count} agents · {o.active_missions} en cours</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedOrgId && (
        <button onClick={clearOrg} className="ml-auto text-guin-muted hover:text-guin-cream transition-colors">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

const COLORS = ['#C1440E', '#D4A017', '#2D6A4F', '#1E2D5A'];

// ── Kente top bar ─────────────────────────────────────────────
function KenteBar({ height = 4 }: { height?: number }) {
  return (
    <div
      className="w-full"
      style={{
        height,
        background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)',
      }}
    />
  );
}

function StatCard({ icon: Icon, label, value, trend, accent }: {
  icon: React.ElementType; label: string; value: string | number;
  trend?: number; accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-guin-card border border-guin-border rounded-2xl overflow-hidden"
    >
      <KenteBar height={3} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-xl" style={{ backgroundColor: `${accent}22` }}>
            <Icon size={18} style={{ color: accent }} />
          </div>
          {trend !== undefined && (
            <span className={clsx('text-xs font-medium flex items-center gap-1',
              trend >= 0 ? 'text-guin-green-light' : 'text-red-400'
            )}>
              <TrendingUp size={12} className={trend < 0 ? 'rotate-180' : ''} />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="text-3xl font-bold text-guin-cream mb-1">{value}</div>
        <div className="text-guin-cream-dim text-xs tracking-wide">{label}</div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user, clearAuth, selectedOrgName } = useAuthStore();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiClient.get('/missions/stats').then(r => r.data.data),
    refetchInterval: 30000,
  });

  const { data: recentMissions } = useQuery({
    queryKey: ['recent-missions'],
    queryFn: () => apiClient.get('/missions?limit=5&status=in_progress').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiClient.get('/users?role=agent').then(r => r.data.data),
  });

  const { data: qualityData } = useQuery({
    queryKey: ['quality-trend'],
    queryFn: () => apiClient.get('/missions/quality-trend?days=14').then(r => r.data.data),
  });

  function logout() {
    clearAuth();
    localStorage.removeItem('accessToken');
    navigate('/login');
  }

  const weekRange = `${format(startOfWeek(new Date(), { locale: fr }), 'dd MMM', { locale: fr })} – ${format(endOfWeek(new Date(), { locale: fr }), 'dd MMM yyyy', { locale: fr })}`;

  return (
    <div className="min-h-screen bg-guin-dark text-guin-cream">
      <KenteBar height={4} />
      {user?.role === 'superadmin' && <SuperadminOrgBanner />}

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="bg-guin-card border-b border-guin-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mini logomark */}
          <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
            <polygon points="28,2 54,28 28,54 2,28" stroke="#D4A017" strokeWidth="2.5" fill="none" />
            <polygon points="28,12 44,28 28,44 12,28" fill="#C1440E" opacity="0.9" />
            <line x1="28" y1="18" x2="28" y2="38" stroke="#F5ECD7" strokeWidth="2" />
            <line x1="18" y1="28" x2="38" y2="28" stroke="#F5ECD7" strokeWidth="2" />
          </svg>
          <div>
            <span className="font-display text-xl font-bold tracking-widest text-guin-gold">DZEDZE</span>
            <p className="text-guin-cream-dim text-xs mt-0.5">
              {weekRange} · {
                user?.role === 'superadmin'
                  ? `Superadmin${selectedOrgName ? ` · ${selectedOrgName}` : ' · Toutes agences'}`
                  : user?.role === 'admin' ? 'Administrateur' : 'Manager'
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-guin-green/20 text-guin-green-light px-3 py-1.5 rounded-lg text-xs border border-guin-green/30">
            <Wifi size={12} />
            <span>Système opérationnel</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-guin-cream-dim hover:text-guin-cream px-3 py-1.5 rounded-lg hover:bg-guin-border/40 transition-colors text-xs"
          >
            <LogOut size={14} />
            Déconnexion
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={CheckCircle2} label="Missions aujourd'hui" value={stats?.todayMissions ?? '—'} trend={stats?.missionsTrend} accent="#2D6A4F" />
          <StatCard icon={Clock}        label="En cours"              value={stats?.inProgress ?? '—'}    accent="#D4A017" />
          <StatCard icon={Camera}       label="Médias capturés"       value={stats?.mediaToday ?? '—'}    trend={stats?.mediaTrend} accent="#C1440E" />
          <StatCard icon={Star}         label="Score qualité moyen"   value={stats?.avgQualityScore ? `${stats.avgQualityScore}/10` : '—'} trend={stats?.qualityTrend} accent="#D4A017" />
          <StatCard
            icon={Timer}
            label="Durée moyenne mission"
            value={stats?.avgDurationMinutes != null
              ? stats.avgDurationMinutes >= 60
                ? `${Math.floor(stats.avgDurationMinutes / 60)}h ${stats.avgDurationMinutes % 60}min`
                : `${stats.avgDurationMinutes} min`
              : '—'}
            accent="#6B7280"
          />
          <StatCard
            icon={BarChart2}
            label="Taux de complétion"
            value={stats?.completionRate != null ? `${stats.completionRate}%` : '—'}
            accent="#2D6A4F"
          />
        </div>

        {/* ── Charts row ────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-6">
          {/* Quality trend */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="col-span-12 lg:col-span-8 bg-guin-card border border-guin-border rounded-2xl overflow-hidden"
          >
            <KenteBar height={3} />
            <div className="p-6">
              <h2 className="text-base font-semibold text-guin-cream mb-1">Évolution de la qualité</h2>
              <p className="text-guin-cream-dim text-xs mb-5">14 derniers jours</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={qualityData || []}>
                  <defs>
                    <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C1440E" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#C1440E" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#D4A017" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D4A017" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3D2010" />
                  <XAxis dataKey="date"   stroke="#A08060" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} stroke="#A08060" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1008', border: '1px solid #3D2010', borderRadius: 8, color: '#F5ECD7' }} />
                  <Area type="monotone" dataKey="score"    stroke="#C1440E" fill="url(#qGrad)" strokeWidth={2} name="Score" />
                  <Area type="monotone" dataKey="anomalies" stroke="#D4A017" fill="url(#aGrad)" strokeWidth={1.5} strokeDasharray="4 2" name="Anomalies" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Status pie */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="col-span-12 lg:col-span-4 bg-guin-card border border-guin-border rounded-2xl overflow-hidden"
          >
            <KenteBar height={3} />
            <div className="p-6">
              <h2 className="text-base font-semibold text-guin-cream mb-1">Statut des missions</h2>
              <p className="text-guin-cream-dim text-xs mb-4">Vue d'ensemble</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={stats?.statusBreakdown || []} cx="50%" cy="50%" innerRadius={48} outerRadius={70} paddingAngle={3} dataKey="count">
                    {(stats?.statusBreakdown || []).map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1A1008', border: '1px solid #3D2010', borderRadius: 8, color: '#F5ECD7' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {(stats?.statusBreakdown || []).map((s: { status: string; label: string; count: number }, i: number) => (
                  <div key={s.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-guin-cream-dim capitalize">{s.label}</span>
                    </div>
                    <span className="text-guin-cream font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Bottom row ────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-6">
          {/* Mission timeline */}
          <div className="col-span-12 lg:col-span-8 bg-guin-card border border-guin-border rounded-2xl overflow-hidden">
            <KenteBar height={3} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-guin-cream">Missions en cours</h2>
                <span className="text-xs text-guin-cream-dim">{recentMissions?.length || 0} active(s)</span>
              </div>
              <MissionTimeline missions={recentMissions || []} />
            </div>
          </div>

          {/* Agents */}
          <div className="col-span-12 lg:col-span-4 bg-guin-card border border-guin-border rounded-2xl overflow-hidden">
            <KenteBar height={3} />
            <div className="p-6">
              <h2 className="text-base font-semibold text-guin-cream mb-4">Agents actifs</h2>
              <div className="space-y-2">
                {(agents || []).slice(0, 6).map((agent: { id: string; first_name: string; last_name: string; quality_score?: number; status?: string }) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgent === agent.id}
                    onSelect={() => setSelectedAgent(agent.id === selectedAgent ? null : agent.id)}
                  />
                ))}
                {(!agents || agents.length === 0) && (
                  <p className="text-guin-cream-dim text-sm text-center py-6">Aucun agent</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Anomaly alerts ────────────────────────────────── */}
        {stats?.recentAnomalies?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-guin-red/10 border border-guin-red/30 rounded-2xl overflow-hidden"
          >
            <KenteBar height={3} />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-red-400" />
                <h2 className="text-base font-semibold text-red-400">Anomalies détectées</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stats.recentAnomalies.map((a: { id: string; agentName: string; severity: string; description: string; siteName: string }) => (
                  <div key={a.id} className="bg-guin-card rounded-xl p-4 border border-guin-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-guin-cream">{a.agentName}</span>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full',
                        a.severity === 'high'   ? 'bg-red-500/20 text-red-400' :
                        a.severity === 'medium' ? 'bg-guin-gold/20 text-guin-gold' :
                                                  'bg-guin-green/20 text-guin-green-light'
                      )}>{a.severity}</span>
                    </div>
                    <p className="text-guin-cream-dim text-xs">{a.description}</p>
                    <p className="text-guin-cream/30 text-xs mt-1">{a.siteName}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer kente bar */}
      <KenteBar height={3} />
    </div>
  );
}
