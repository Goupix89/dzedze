import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Search, UserCheck, Wifi, WifiOff, Star, X, ChevronDown, UserPlus, AlertCircle, Loader2, Pencil, KeyRound } from 'lucide-react';
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

// ── Agent creation modal ───────────────────────────────────────
const SPECIALTIES_OPTIONS = [
  'Nettoyage standard', 'Nettoyage hôpital', 'Nettoyage industriel',
  'Nettoyage vitrerie', 'Nettoyage cuisine', 'Remise en état',
  'Désinfection', 'Nettoyage après chantier', 'Entretien des sols',
];

const EMPTY_AGENT = {
  firstName: '', lastName: '', email: '', phone: '', password: '',
  idCardNumber: '', birthDate: '', birthPlace: '',
  homeAddress: '', bloodType: '',
  emergencyContactName: '', emergencyContactPhone: '',
  contractType: 'cdd', hireDate: '',
  specialties: [] as string[],
  uniformSize: '', shoeSize: '', notes: '',
};

function CreateAgentModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_AGENT });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'identity' | 'contract' | 'equipment'>('identity');

  const set = (k: keyof typeof EMPTY_AGENT) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  function toggleSpecialty(s: string) {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s)
        ? f.specialties.filter(x => x !== s)
        : [...f.specialties, s],
    }));
  }

  const mutation = useMutation({
    mutationFn: () => apiClient.post('/auth/register', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Erreur lors de la création.'),
  });

  function submit() {
    setError(null);
    if (!form.firstName || !form.lastName || !form.email) {
      setError('Prénom, nom et email sont obligatoires.'); return;
    }
    mutation.mutate();
  }

  const inputClass = 'w-full bg-guin-dark border border-guin-border rounded-xl px-3 py-2 text-sm text-white placeholder-guin-border focus:outline-none focus:border-guin-gold';
  const labelClass = 'block text-xs text-guin-muted mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-guin-card border border-guin-border rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Kente header bar */}
        <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />

        {/* Title */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-guin-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-guin-gold" />
            <h2 className="text-guin-cream font-bold">Nouvel agent</h2>
          </div>
          <button onClick={onClose} className="text-guin-muted hover:text-guin-cream"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-guin-border flex-shrink-0">
          {(['identity', 'contract', 'equipment'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px',
                tab === t ? 'border-guin-gold text-guin-gold' : 'border-transparent text-guin-muted hover:text-guin-cream')}>
              {t === 'identity' ? 'Identité & Contact' : t === 'contract' ? 'Contrat & Spécialités' : 'Équipement & Notes'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Prénom *</label>
                  <input className={inputClass} value={form.firstName} onChange={set('firstName')} placeholder="Kofi" />
                </div>
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input className={inputClass} value={form.lastName} onChange={set('lastName')} placeholder="Mensah" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" className={inputClass} value={form.email} onChange={set('email')} placeholder="kofi@agence.com" />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input type="tel" className={inputClass} value={form.phone} onChange={set('phone')} placeholder="+228 90 00 00 00" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Mot de passe (laissez vide → Agent@123!)</label>
                <input type="password" className={inputClass} value={form.password} onChange={set('password')} placeholder="Min. 8 caractères" />
              </div>

              <div className="pt-2 border-t border-guin-border">
                <p className="text-xs font-semibold text-guin-muted uppercase mb-3">Pièce d'identité</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>N° CNI / Passeport</label>
                    <input className={inputClass} value={form.idCardNumber} onChange={set('idCardNumber')} placeholder="TG-1234567" />
                  </div>
                  <div>
                    <label className={labelClass}>Groupe sanguin</label>
                    <select className={inputClass} value={form.bloodType} onChange={set('bloodType')}>
                      <option value="">— Sélectionner —</option>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className={labelClass}>Date de naissance</label>
                    <input type="date" className={inputClass} value={form.birthDate} onChange={set('birthDate')} />
                  </div>
                  <div>
                    <label className={labelClass}>Lieu de naissance</label>
                    <input className={inputClass} value={form.birthPlace} onChange={set('birthPlace')} placeholder="Lomé" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelClass}>Adresse domicile</label>
                  <input className={inputClass} value={form.homeAddress} onChange={set('homeAddress')} placeholder="12 Rue des Fleurs, Lomé" />
                </div>
              </div>

              <div className="pt-2 border-t border-guin-border">
                <p className="text-xs font-semibold text-guin-muted uppercase mb-3">Contact en cas d'urgence</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom du contact</label>
                    <input className={inputClass} value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Ama Mensah" />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone du contact</label>
                    <input type="tel" className={inputClass} value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="+228 91 00 00 00" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'contract' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type de contrat</label>
                  <select className={inputClass} value={form.contractType} onChange={set('contractType')}>
                    <option value="cdd">CDD</option>
                    <option value="cdi">CDI</option>
                    <option value="interim">Intérim</option>
                    <option value="vacataire">Vacataire</option>
                    <option value="freelance">Freelance</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date d'embauche</label>
                  <input type="date" className={inputClass} value={form.hireDate} onChange={set('hireDate')} />
                </div>
              </div>

              <div className="pt-2 border-t border-guin-border">
                <p className="text-xs font-semibold text-guin-muted uppercase mb-3">Spécialités</p>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES_OPTIONS.map(s => (
                    <button key={s} type="button" onClick={() => toggleSpecialty(s)}
                      className={clsx('text-xs px-3 py-1.5 rounded-full border transition-all',
                        form.specialties.includes(s)
                          ? 'bg-guin-green/20 border-guin-green text-guin-green'
                          : 'border-guin-border text-guin-muted hover:border-gray-500')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'equipment' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Taille uniforme</label>
                  <select className={inputClass} value={form.uniformSize} onChange={set('uniformSize')}>
                    <option value="">— Sélectionner —</option>
                    {['XS','S','M','L','XL','XXL','3XL'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Pointure</label>
                  <input className={inputClass} value={form.shoeSize} onChange={set('shoeSize')} placeholder="42" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes internes</label>
                <textarea
                  className={clsx(inputClass, 'resize-none')} rows={5}
                  value={form.notes} onChange={set('notes')}
                  placeholder="Observations sur l'agent, certifications spéciales, restrictions médicales…"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-guin-border flex-shrink-0 space-y-3">
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-red-900/20 border border-red-800 rounded-xl">
              <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-300 text-xs">{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-sm border border-guin-border rounded-xl text-guin-muted hover:bg-guin-dark transition-colors">
              Annuler
            </button>
            <button onClick={submit} disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-bold bg-guin-gold text-guin-dark rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {mutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Création…</> : 'Créer l\'agent'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { user: me } = useAuthStore();
  const navigate = useNavigate();
  const canEdit = me?.role === 'admin' || me?.role === 'manager' || me?.role === 'superadmin';

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
        {(me?.role === 'admin' || me?.role === 'manager') && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-guin-gold text-guin-dark rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <UserPlus size={16} /> Nouvel agent
          </button>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

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
                    {canEdit && (
                      <div className="flex items-center gap-1 mt-2 justify-end">
                        <button
                          onClick={() => navigate(`/users/${u.id}/edit`)}
                          title="Modifier l'agent"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-guin-muted hover:text-guin-gold transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => navigate(`/users/${u.id}/password`)}
                          title="Changer le mot de passe"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-guin-muted hover:text-guin-terracotta transition-colors"
                        >
                          <KeyRound size={13} />
                        </button>
                      </div>
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
