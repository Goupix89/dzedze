import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Search, Filter, TrendingUp, Activity, Users, FileText } from 'lucide-react';
import { apiClient } from '../services/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────
interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface AuditStats {
  topActions: { action: string; count: string }[];
  topUsers: { first_name: string; last_name: string; role: string; actions: string }[];
  byResource: { resource_type: string; count: string }[];
  periodDays: number;
}

// ── Helpers ───────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  LOGIN:           'bg-green-900/50 text-green-300 border border-green-800',
  LOGOUT:          'bg-gray-700/50 text-gray-400 border border-gray-600',
  MEDIA_ACCESS:    'bg-blue-900/50 text-blue-300 border border-blue-800',
  MEDIA_UPLOAD:    'bg-purple-900/50 text-purple-300 border border-purple-800',
  MEDIA_DELETE:    'bg-red-900/50 text-red-300 border border-red-800',
  MISSION_START:   'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  MISSION_COMPLETE:'bg-emerald-900/50 text-emerald-300 border border-emerald-800',
};
const actionColor = (a: string) =>
  ACTION_COLOR[a] ?? 'bg-guin-card text-guin-muted border border-guin-border';

const RESOURCE_ICON: Record<string, React.ReactNode> = {
  mission: <FileText size={13} />,
  media:   <Activity size={13} />,
  user:    <Users size={13} />,
};
const resourceIcon = (r: string) => RESOURCE_ICON[r] ?? <Shield size={13} />;

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-guin-card border border-guin-border rounded-xl p-4 flex items-center gap-4">
      <div className="p-2 bg-guin-dark rounded-lg text-guin-gold">{icon}</div>
      <div>
        <p className="text-guin-muted text-xs">{label}</p>
        <p className="text-white font-bold text-xl">{value}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AuditPage() {
  const [search, setSearch]     = useState('');
  const [resourceType, setResourceType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const [statDays, setStatDays] = useState('7');

  const logsQuery = useQuery({
    queryKey: ['audit', search, resourceType, dateFrom, dateTo, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '50' };
      if (search)       params.action        = search;
      if (resourceType) params.resource_type = resourceType;
      if (dateFrom)     params.from          = dateFrom;
      if (dateTo)       params.to            = dateTo;
      const res = await apiClient.get('/audit', { params });
      return res.data as { data: AuditLog[]; pagination: { total: number; pages: number } };
    },
  });

  const statsQuery = useQuery({
    queryKey: ['audit-stats', statDays],
    queryFn: async () => {
      const res = await apiClient.get('/audit/stats', { params: { days: statDays } });
      return res.data.data as AuditStats;
    },
  });

  const logs  = logsQuery.data?.data ?? [];
  const stats = statsQuery.data;
  const pagination = logsQuery.data?.pagination;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-guin-terracotta" size={24} />
          <h1 className="text-xl font-bold text-white">Journal d'audit</h1>
        </div>
        <select
          value={statDays}
          onChange={e => setStatDays(e.target.value)}
          className="bg-guin-card border border-guin-border rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </select>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Actions totales"
            value={stats.topActions.reduce((s, a) => s + parseInt(a.count), 0)}
            icon={<Activity size={18} />}
          />
          <StatCard
            label="Action la + fréquente"
            value={stats.topActions[0]?.action ?? '—'}
            icon={<TrendingUp size={18} />}
          />
          <StatCard
            label="Utilisateur le + actif"
            value={stats.topUsers[0] ? `${stats.topUsers[0].first_name} ${stats.topUsers[0].last_name}` : '—'}
            icon={<Users size={18} />}
          />
          <StatCard
            label="Types de ressources"
            value={stats.byResource.length}
            icon={<FileText size={18} />}
          />
        </div>
      )}

      {/* Top actions + top users */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-guin-card border border-guin-border rounded-xl p-4">
            <p className="text-guin-muted text-xs font-semibold uppercase mb-3">Top actions</p>
            <div className="space-y-2">
              {stats.topActions.slice(0, 6).map((a) => {
                const max = parseInt(stats.topActions[0]?.count ?? '1');
                const pct = Math.round(parseInt(a.count) / max * 100);
                return (
                  <div key={a.action} className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${actionColor(a.action)}`}>{a.action}</span>
                    <div className="flex-1 bg-guin-dark rounded-full h-1.5">
                      <div className="bg-guin-gold h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-guin-muted text-xs w-8 text-right">{a.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-guin-card border border-guin-border rounded-xl p-4">
            <p className="text-guin-muted text-xs font-semibold uppercase mb-3">Utilisateurs les plus actifs</p>
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-guin-dark flex items-center justify-center text-xs font-bold text-guin-gold">
                      {u.first_name?.[0]}{u.last_name?.[0]}
                    </div>
                    <span className="text-white text-sm">{u.first_name} {u.last_name}</span>
                    <span className="text-guin-muted text-xs">({u.role})</span>
                  </div>
                  <span className="text-guin-gold font-semibold text-sm">{u.actions} actes</span>
                </div>
              ))}
              {stats.topUsers.length === 0 && (
                <p className="text-guin-muted text-sm">Aucune activité sur la période.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-guin-card border border-guin-border rounded-xl p-4">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-guin-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Filtrer par action…"
            className="w-full bg-guin-dark border border-guin-border rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-guin-muted"
          />
        </div>
        <select
          value={resourceType}
          onChange={e => { setResourceType(e.target.value); setPage(1); }}
          className="bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Toutes les ressources</option>
          <option value="mission">Mission</option>
          <option value="media">Média</option>
          <option value="user">Utilisateur</option>
          <option value="site">Site</option>
          <option value="auth">Authentification</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-sm text-white"
        />
      </div>

      {/* Table */}
      <div className="bg-guin-card border border-guin-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-guin-border text-guin-muted text-xs uppercase">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Ressource</th>
              <th className="text-left px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logsQuery.isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-b border-guin-border/30">
                  {[...Array(5)].map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-guin-border rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-guin-muted">
                  Aucun log sur cette période.
                </td>
              </tr>
            ) : logs.map((log, i) => (
              <motion.tr
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-guin-border/30 hover:bg-guin-dark/40 transition-colors"
              >
                <td className="px-4 py-3 text-guin-muted whitespace-nowrap">
                  {format(parseISO(log.created_at), 'dd/MM HH:mm:ss', { locale: fr })}
                </td>
                <td className="px-4 py-3 text-white">
                  {log.first_name ? (
                    <span>{log.first_name} {log.last_name} <span className="text-guin-muted text-xs">({log.role})</span></span>
                  ) : (
                    <span className="text-guin-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-guin-muted">
                    {resourceIcon(log.resource_type)}
                    <span>{log.resource_type}</span>
                    {log.resource_id && (
                      <span className="text-xs text-guin-border font-mono">{log.resource_id.slice(0, 8)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-guin-muted font-mono text-xs">
                  {log.ip_address ?? '—'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-guin-border">
            <span className="text-guin-muted text-xs">{pagination.total} entrées</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm bg-guin-dark border border-guin-border rounded-lg text-white disabled:opacity-30"
              >Préc.</button>
              <span className="px-3 py-1 text-sm text-guin-muted">
                {page} / {pagination.pages}
              </span>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm bg-guin-dark border border-guin-border rounded-lg text-white disabled:opacity-30"
              >Suiv.</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
