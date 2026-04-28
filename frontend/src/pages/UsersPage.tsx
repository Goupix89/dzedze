import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Search, Shield, UserCheck, Wifi, WifiOff, Star, X, ChevronDown } from 'lucide-react';
import { apiClient } from '../services/api';
import { clsx } from 'clsx';
import { useAuthStore } from '../store/auth.store';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'agent';
  phone: string | null;
  status: 'disponible' | 'en_mission' | 'hors_ligne' | 'conge';
  is_active: boolean;
  quality_score: number;
  missions_completed: number;
  missions_active: number;
  last_login: string | null;
  avatar_url: string | null;
}

const ROLE_META = {
  admin:   { label: 'Admin',   color: '#C1440E' },
  manager: { label: 'Manager', color: '#D4A017' },
  agent:   { label: 'Agent',   color: '#2D6A4F' },
};

const STATUS_META = {
  disponible: { label: 'Disponible',  color: '#2D6A4F', Icon: UserCheck },
  en_mission: { label: 'En mission',  color: '#D4A017', Icon: Wifi      },
  hors_ligne: { label: 'Hors ligne',  color: '#4B5563', Icon: WifiOff   },
  conge:      { label: 'En congé',    color: '#1E2D5A', Icon: WifiOff   },
};

function Avatar({ user }: { user: User }) {
  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  if (user.avatar_url) {
    return <img src={user.avatar_url} className="w-10 h-10 rounded-full object-cover" alt={initials} />;
  }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-guin-cream text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg,#C1440E,#D4A017)' }}>
      {initials}
    </div>
  );
}

function QualityBar({ score: rawScore }: { score: number | string }) {
  const score = parseFloat(String(rawScore));
  const pct = Math.min(100, (score / 10) * 100);
  const color = score >= 7 ? '#2D6A4F' : score >= 5 ? '#D4A017' : '#C1440E';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-guin-dark rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-7 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ── Role change dropdown ───────────────────────────────────────
function RoleSelect({ user }: { user: User }) {
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const [open, setOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: (role: string) => apiClient.put(`/users/${user.id}`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setOpen(false); },
  });

  if (me?.role !== 'admin') {
    const m = ROLE_META[user.role];
    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: m.color, background: `${m.color}22` }}>{m.label}</span>;
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors"
        style={{ color: ROLE_META[user.role].color, borderColor: `${ROLE_META[user.role].color}44`, background: `${ROLE_META[user.role].color}22` }}>
        {ROLE_META[user.role].label}
        <ChevronDown size={10} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute top-6 left-0 z-10 bg-guin-card border border-guin-border rounded-xl overflow-hidden shadow-lg">
            {Object.entries(ROLE_META).map(([k, { label, color }]) => (
              <button key={k} onClick={() => mutation.mutate(k)}
                className="block w-full px-4 py-2 text-xs text-left hover:bg-white/5 transition-colors"
                style={{ color }}>
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      return apiClient.get<{ data: User[] }>(`/users?${params}`).then(r => r.data.data);
    },
    refetchInterval: 60_000,
  });

  const users = (data ?? []).filter(u =>
    !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  const agents    = users.filter(u => u.role === 'agent');
  const available = agents.filter(u => u.status === 'disponible').length;
  const onMission = agents.filter(u => u.status === 'en_mission').length;

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-guin-cream font-bold text-2xl">Agents & Utilisateurs</h1>
          <p className="text-guin-cream-dim text-sm mt-0.5">
            {available} disponible{available !== 1 ? 's' : ''} · {onMission} en mission
          </p>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          { label: 'Total', value: users.length, color: '#D4A017' },
          { label: 'Agents', value: agents.length, color: '#2D6A4F' },
          { label: 'Disponibles', value: available, color: '#2D6A4F' },
          { label: 'En mission', value: onMission, color: '#D4A017' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-guin-card border border-guin-border rounded-xl px-4 py-2">
            <p className="text-guin-cream-dim text-xs">{label}</p>
            <p className="font-bold text-lg" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Role filter */}
        <div className="flex bg-guin-card border border-guin-border rounded-xl overflow-hidden">
          {[['all','Tous'],['agent','Agents'],['manager','Managers'],['admin','Admins']].map(([k,l]) => (
            <button key={k} onClick={() => setRoleFilter(k)}
              className={clsx('px-3 py-2 text-xs font-medium transition-colors',
                roleFilter === k ? 'bg-guin-terracotta text-guin-cream' : 'text-guin-cream-dim hover:text-guin-cream')}>
              {l}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex bg-guin-card border border-guin-border rounded-xl overflow-hidden">
          {[['all','Tous'],['disponible','Disponible'],['en_mission','En mission'],['hors_ligne','Hors ligne']].map(([k,l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              className={clsx('px-3 py-2 text-xs font-medium transition-colors',
                statusFilter === k ? 'bg-guin-indigo text-guin-cream' : 'text-guin-cream-dim hover:text-guin-cream')}>
              {l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-guin-card border border-guin-border rounded-xl px-3 py-2 flex-1 max-w-xs">
          <Search size={14} className="text-guin-cream-dim" />
          <input
            className="bg-transparent text-guin-cream text-sm placeholder-guin-cream-dim outline-none w-full"
            placeholder="Rechercher…"
            value={search} onChange={e => setSearch(e.target.value)}
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

        <AnimatePresence mode="popLayout">
          {users.map((u, i) => {
            const statusMeta = STATUS_META[u.status] ?? STATUS_META.hors_ligne;
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-guin-card border border-guin-border rounded-xl p-4 hover:border-guin-gold/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <Avatar user={u} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-guin-cream font-semibold text-sm">
                        {u.first_name} {u.last_name}
                      </span>
                      <RoleSelect user={u} />
                      <span className="flex items-center gap-1 text-xs"
                        style={{ color: statusMeta.color }}>
                        <statusMeta.Icon size={11} />{statusMeta.label}
                      </span>
                    </div>
                    <p className="text-guin-cream-dim text-xs">{u.email}</p>
                    {u.phone && <p className="text-guin-cream-dim text-xs">{u.phone}</p>}
                  </div>

                  {u.role === 'agent' && (
                    <div className="w-28 flex-shrink-0">
                      <p className="text-guin-cream-dim text-xs mb-1 flex items-center gap-1">
                        <Star size={10} />Qualité
                      </p>
                      <QualityBar score={u.quality_score} />
                    </div>
                  )}

                  <div className="text-right flex-shrink-0">
                    {u.role === 'agent' && (
                      <>
                        <p className="text-guin-cream text-sm font-bold">{u.missions_completed}</p>
                        <p className="text-guin-cream-dim text-xs">missions</p>
                      </>
                    )}
                    {u.last_login && (
                      <p className="text-guin-cream-dim text-xs mt-1">
                        Dernière co. {format(new Date(u.last_login), 'dd MMM', { locale: fr })}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
