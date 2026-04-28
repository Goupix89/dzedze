import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Plus, Search, Filter, Play, CheckCircle2, Clock,
  AlertCircle, XCircle, ChevronRight, X, MapPin, User, Calendar, Bot,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { clsx } from 'clsx';

// ── types ─────────────────────────────────────────────────────
interface Mission {
  id: string;
  title: string;
  status: 'planned' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  completed_at: string | null;
  quality_score: number | null;
  site_name: string;
  site_id: string;
  agent_name: string | null;
  agent_id: string | null;
  manager_name: string | null;
  media_count: number;
  notes: string | null;
  checklist: unknown[];
}

interface Site   { id: string; name: string; city: string }
interface Agent  { id: string; first_name: string; last_name: string; quality_score: number }

// ── helpers ───────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  planned:    { label: 'Planifiée',   color: '#D4A017', Icon: Clock        },
  in_progress:{ label: 'En cours',   color: '#2D6A4F', Icon: Play         },
  review:     { label: 'Révision',   color: '#1E2D5A', Icon: AlertCircle  },
  completed:  { label: 'Terminée',   color: '#C1440E', Icon: CheckCircle2 },
  cancelled:  { label: 'Annulée',    color: '#4B5563', Icon: XCircle      },
};

const ALL_STATUSES = ['planned', 'in_progress', 'review', 'completed', 'cancelled'];

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.planned;
  return (
    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: `${m.color}22`, border: `1px solid ${m.color}44` }}>
      <m.Icon size={11} />
      {m.label}
    </span>
  );
}

// ── Create mission modal ───────────────────────────────────────
function CreateMissionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', site_id: '', agent_id: '',
    scheduled_start: '', scheduled_end: '', notes: '',
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-list'],
    queryFn: () => apiClient.get<{ data: Site[] }>('/sites?limit=100').then(r => r.data.data),
  });
  const { data: agentsData } = useQuery({
    queryKey: ['agents-available'],
    queryFn: () => apiClient.get<{ data: Agent[] }>('/users/agents/available').then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/missions', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); onClose(); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-guin-card border border-guin-border rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-guin-cream font-bold text-lg">Nouvelle mission</h2>
            <button onClick={onClose} className="text-guin-cream-dim hover:text-guin-cream transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Titre *</label>
              <input
                className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                placeholder="Ex: Nettoyage quotidien bureau Est"
                value={form.title} onChange={set('title')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-guin-cream-dim mb-1 block">Site *</label>
                <select
                  className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                  value={form.site_id} onChange={set('site_id')}
                >
                  <option value="">Choisir…</option>
                  {sitesData?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-guin-cream-dim mb-1 block">Agent</label>
                <select
                  className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                  value={form.agent_id} onChange={set('agent_id')}
                >
                  <option value="">Non assigné</option>
                  {agentsData?.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.first_name} {a.last_name} ({a.quality_score}/10)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-guin-cream-dim mb-1 block">Début *</label>
                <input
                  type="datetime-local"
                  className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                  value={form.scheduled_start} onChange={set('scheduled_start')}
                />
              </div>
              <div>
                <label className="text-xs text-guin-cream-dim mb-1 block">Fin *</label>
                <input
                  type="datetime-local"
                  className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                  value={form.scheduled_end} onChange={set('scheduled_end')}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Notes</label>
              <textarea
                className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold resize-none"
                rows={3}
                placeholder="Instructions particulières…"
                value={form.notes} onChange={set('notes')}
              />
            </div>

            {createMutation.isError && (
              <p className="text-red-400 text-xs">
                {(createMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur lors de la création'}
              </p>
            )}

            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || !form.site_id || !form.scheduled_start || !form.scheduled_end || createMutation.isPending}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-guin-terracotta text-guin-cream disabled:opacity-40 hover:bg-guin-terra-light transition-colors"
            >
              {createMutation.isPending ? 'Création…' : 'Créer la mission'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Mission AI report modal ────────────────────────────────────
function MissionReportModal({ missionId, onClose }: { missionId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-report', missionId],
    queryFn: () => apiClient.get<{ data: any }>(`/ai/mission/${missionId}/report`).then(r => r.data.data),
  });

  const scoreColor = (s: number | null) =>
    s == null ? '#6B7280' : s >= 7 ? '#2D6A4F' : s >= 5 ? '#D4A017' : '#C1440E';

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-guin-card border border-guin-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-guin-border">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-guin-gold" />
            <h2 className="text-guin-cream font-bold">Rapport IA</h2>
          </div>
          <button onClick={onClose} className="text-guin-cream-dim hover:text-guin-cream"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-5">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-guin-dark rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {error && (
            <p className="text-red-400 text-sm">Erreur lors de la génération du rapport.</p>
          )}
          {data && (
            <>
              {/* Score global */}
              <div className="bg-guin-dark rounded-xl p-4 border border-guin-border text-center">
                <p className="text-guin-muted text-xs mb-1">Score de qualité global</p>
                <span
                  className="text-5xl font-extrabold"
                  style={{ color: scoreColor(data.overallScore) }}
                >
                  {data.overallScore != null ? data.overallScore.toFixed(1) : '—'}
                </span>
                <span className="text-guin-muted text-lg"> /10</span>
                <p className="text-guin-muted text-xs mt-1">{data.mediaCount} média{data.mediaCount !== 1 ? 's' : ''} analysé{data.mediaCount !== 1 ? 's' : ''}</p>
              </div>

              {/* Par phase */}
              {Object.keys(data.phases ?? {}).length > 0 && (
                <div>
                  <p className="text-guin-muted text-xs font-semibold uppercase mb-2">Par phase</p>
                  <div className="space-y-2">
                    {Object.entries(data.phases as Record<string, { count: number; avgScore: number; anomalies: any[] }>).map(([phase, p]) => (
                      <div key={phase} className="flex items-center justify-between bg-guin-dark rounded-lg px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-guin-cream text-sm capitalize">{phase}</span>
                          <span className="text-guin-muted text-xs">{p.count} fichier{p.count !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="font-bold text-sm" style={{ color: scoreColor(p.avgScore) }}>
                          {p.avgScore > 0 ? `${p.avgScore.toFixed(1)}/10` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {data.anomalies?.length > 0 && (
                <div>
                  <p className="text-guin-muted text-xs font-semibold uppercase mb-2">
                    Anomalies détectées ({data.anomalies.length})
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {data.anomalies.map((a: any, i: number) => (
                      <div key={i} className={clsx(
                        'text-xs px-3 py-2 rounded-lg border',
                        a.severity === 'high'   ? 'border-red-800 bg-red-900/20 text-red-300' :
                        a.severity === 'medium' ? 'border-yellow-800 bg-yellow-900/20 text-yellow-300' :
                                                  'border-gray-700 bg-gray-900/20 text-gray-400',
                      )}>
                        [{a.phase?.toUpperCase() ?? 'N/A'}] {a.description ?? a.type}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {data.issues?.length > 0 && (
                <div>
                  <p className="text-guin-muted text-xs font-semibold uppercase mb-2">Points d'attention</p>
                  <ul className="space-y-1">
                    {data.issues.map((iss: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-guin-cream">
                        <AlertCircle size={13} className="text-guin-gold mt-0.5 flex-shrink-0" />
                        {iss}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              <div className="bg-guin-green/10 border border-guin-green/30 rounded-xl px-4 py-3">
                <p className="text-guin-muted text-xs font-semibold uppercase mb-1">Recommandation</p>
                <p className="text-guin-cream text-sm">{data.recommendation}</p>
              </div>

              <p className="text-guin-border text-xs text-right">
                Généré le {data.generatedAt ? format(parseISO(data.generatedAt), 'dd/MM/yyyy HH:mm') : '—'}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Mission detail slide panel ─────────────────────────────────
function MissionPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [showReport, setShowReport] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['mission', id],
    queryFn: () => apiClient.get<{ data: Mission }>(`/missions/${id}`).then(r => r.data.data),
  });

  const lifecycle = useMutation({
    mutationFn: (action: string) => apiClient.post(`/missions/${id}/${action}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['missions'] }); qc.invalidateQueries({ queryKey: ['mission', id] }); },
  });

  const m = data;
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed right-0 top-0 h-full w-full max-w-md bg-guin-card border-l border-guin-border z-40 flex flex-col shadow-2xl"
    >
      <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />
      <div className="flex items-center justify-between px-6 py-4 border-b border-guin-border">
        <h2 className="text-guin-cream font-bold">Détail mission</h2>
        <button onClick={onClose} className="text-guin-cream-dim hover:text-guin-cream"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {isLoading && <p className="text-guin-cream-dim text-sm">Chargement…</p>}
        {m && (
          <>
            <div>
              <StatusBadge status={m.status} />
              <h3 className="text-guin-cream font-bold text-xl mt-2">{m.title}</h3>
            </div>

            <div className="space-y-2">
              <InfoRow Icon={MapPin}   label="Site"   value={m.site_name} />
              <InfoRow Icon={User}     label="Agent"  value={m.agent_name ?? 'Non assigné'} />
              <InfoRow Icon={Calendar} label="Début"  value={m.scheduled_start ? format(new Date(m.scheduled_start), 'dd MMM yyyy HH:mm', { locale: fr }) : '—'} />
              <InfoRow Icon={Calendar} label="Fin"    value={m.scheduled_end   ? format(new Date(m.scheduled_end),   'dd MMM yyyy HH:mm', { locale: fr }) : '—'} />
            </div>

            {m.quality_score != null && (
              <div className="bg-guin-dark rounded-xl p-4 border border-guin-border">
                <p className="text-guin-cream-dim text-xs mb-1">Score qualité</p>
                <div className="flex items-end gap-2">
                  {(() => { const qs = parseFloat(String(m.quality_score)); return (
                    <span className="text-3xl font-bold" style={{ color: qs >= 7 ? '#2D6A4F' : qs >= 5 ? '#D4A017' : '#C1440E' }}>
                      {qs.toFixed(1)}
                    </span>
                  ); })()}
                  <span className="text-guin-cream-dim text-sm mb-1">/10</span>
                </div>
              </div>
            )}

            {m.notes && (
              <div>
                <p className="text-guin-cream-dim text-xs mb-1">Notes</p>
                <p className="text-guin-cream text-sm">{m.notes}</p>
              </div>
            )}

            {Array.isArray(m.checklist) && m.checklist.length > 0 && (
              <div>
                <p className="text-guin-cream-dim text-xs mb-2">Checklist ({(m.checklist as { done?: boolean }[]).filter(i => i.done).length}/{m.checklist.length})</p>
                <div className="space-y-1">
                  {(m.checklist as { label?: string; task?: string; done?: boolean }[]).map((item, i) => (
                    <div key={i} className={clsx(
                      'flex items-center gap-2 text-sm px-3 py-2 rounded-lg',
                      item.done ? 'text-guin-green bg-guin-green/10' : 'text-guin-cream-dim bg-guin-dark',
                    )}>
                      <CheckCircle2 size={14} className={item.done ? 'text-guin-green' : 'text-guin-border'} />
                      {item.label ?? item.task ?? `Tâche ${i + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-guin-cream-dim">
              {m.media_count} média{m.media_count !== 1 ? 's' : ''} attaché{m.media_count !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {m && (
        <div className="p-4 border-t border-guin-border space-y-2">
          {m.status === 'planned' && (
            <button
              onClick={() => lifecycle.mutate('start')}
              disabled={lifecycle.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-guin-green text-guin-cream hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Démarrer la mission
            </button>
          )}
          {m.status === 'in_progress' && (
            <button
              onClick={() => lifecycle.mutate('complete')}
              disabled={lifecycle.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-guin-gold text-guin-dark hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Marquer terminée
            </button>
          )}
          <button
            onClick={() => setShowReport(true)}
            className="w-full py-2 rounded-xl text-sm font-semibold border border-guin-border text-guin-cream hover:bg-guin-dark transition-colors flex items-center justify-center gap-2"
          >
            <Bot size={15} /> Rapport IA
          </button>
        </div>
      )}
      <AnimatePresence>
        {showReport && <MissionReportModal missionId={id} onClose={() => setShowReport(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

function InfoRow({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={14} className="text-guin-cream-dim flex-shrink-0" />
      <span className="text-guin-cream-dim text-xs w-12">{label}</span>
      <span className="text-guin-cream text-sm">{value}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function MissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const statusParam = statusFilter === 'active'
    ? 'planned,in_progress,review'
    : statusFilter === 'all' ? ALL_STATUSES.join(',') : statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['missions', statusFilter, search],
    queryFn: () =>
      apiClient.get<{ data: Mission[] }>(`/missions?status=${statusParam}&limit=50`).then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const missions = (data ?? []).filter(m =>
    !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.site_name.toLowerCase().includes(search.toLowerCase()),
  );

  const TABS = [
    { key: 'active',    label: 'Actives' },
    { key: 'completed', label: 'Terminées' },
    { key: 'cancelled', label: 'Annulées' },
    { key: 'all',       label: 'Toutes' },
  ];

  return (
    <>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-guin-cream font-bold text-2xl">Missions</h1>
            <p className="text-guin-cream-dim text-sm mt-0.5">
              {missions.length} mission{missions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-guin-terracotta text-guin-cream rounded-xl text-sm font-semibold hover:bg-guin-terra-light transition-colors"
          >
            <Plus size={16} />
            Nouvelle mission
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex bg-guin-card border border-guin-border rounded-xl overflow-hidden">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={clsx(
                  'px-4 py-2 text-xs font-medium transition-colors',
                  statusFilter === t.key
                    ? 'bg-guin-terracotta text-guin-cream'
                    : 'text-guin-cream-dim hover:text-guin-cream',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-guin-card border border-guin-border rounded-xl px-3 py-2 flex-1 max-w-xs">
            <Search size={14} className="text-guin-cream-dim" />
            <input
              className="bg-transparent text-guin-cream text-sm placeholder-guin-cream-dim outline-none w-full"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-guin-gold border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isLoading && missions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-guin-cream-dim">
              <Filter size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Aucune mission trouvée</p>
            </div>
          )}
          <AnimatePresence mode="popLayout">
            {missions.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedId(m.id)}
                className="bg-guin-card border border-guin-border rounded-xl p-4 cursor-pointer hover:border-guin-gold/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={m.status} />
                      <span className="text-guin-cream-dim text-xs">
                        {m.scheduled_start ? format(new Date(m.scheduled_start), 'dd MMM · HH:mm', { locale: fr }) : '—'}
                      </span>
                    </div>
                    <p className="text-guin-cream font-semibold text-sm truncate">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-guin-cream-dim text-xs">
                        <MapPin size={11} />{m.site_name}
                      </span>
                      {m.agent_name && (
                        <span className="flex items-center gap-1 text-guin-cream-dim text-xs">
                          <User size={11} />{m.agent_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {m.quality_score != null && (
                      <span className="text-xs font-bold" style={{ color: parseFloat(String(m.quality_score)) >= 7 ? '#2D6A4F' : '#D4A017' }}>
                        {parseFloat(String(m.quality_score)).toFixed(1)}/10
                      </span>
                    )}
                    {m.media_count > 0 && (
                      <span className="text-guin-cream-dim text-xs">{m.media_count} 📷</span>
                    )}
                    <ChevronRight size={16} className="text-guin-cream-dim group-hover:text-guin-gold transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals / Panels */}
      <AnimatePresence>
        {showCreate && <CreateMissionModal onClose={() => setShowCreate(false)} />}
        {selectedId && <MissionPanel id={selectedId} onClose={() => setSelectedId(null)} />}
      </AnimatePresence>
    </>
  );
}
