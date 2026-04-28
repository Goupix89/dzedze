import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, MapPin, Building2, Trash2, Edit2, X,
  ChevronRight, CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { clsx } from 'clsx';

interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  site_type: string;
  surface_m2: number | null;
  description: string | null;
  is_active: boolean;
  manager_name: string | null;
  active_missions: number;
  checklist_template: { label: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  bureau: 'Bureau', entrepot: 'Entrepôt', hopital: 'Hôpital',
  école: 'École', commerce: 'Commerce', autre: 'Autre',
};

const TYPE_COLORS: Record<string, string> = {
  bureau: '#1E2D5A', entrepot: '#C1440E', hopital: '#2D6A4F',
  école: '#D4A017', commerce: '#C1440E', autre: '#4B5563',
};

// ── Site form (create / edit) ──────────────────────────────────
const EMPTY_FORM = {
  name: '', address: '', city: '', country: 'France',
  site_type: 'bureau', surface_m2: '', description: '', manager_id: '',
  checklist_template: [] as string[],
};

function SiteModal({ site, onClose }: { site?: Site; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(site ? {
      name: site.name, address: site.address, city: site.city,
      country: site.country, site_type: site.site_type,
      surface_m2: site.surface_m2?.toString() ?? '',
      description: site.description ?? '',
      checklist_template: site.checklist_template?.map(i => i.label) ?? [],
    } : {}),
  });
  const [newItem, setNewItem] = useState('');

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        ...data,
        surface_m2: data.surface_m2 ? parseInt(data.surface_m2) : null,
        checklist_template: form.checklist_template.map(label => ({ label })),
      };
      return site
        ? apiClient.put(`/sites/${site.id}`, payload)
        : apiClient.post('/sites', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); onClose(); },
  });

  function addChecklistItem() {
    if (!newItem.trim()) return;
    setForm(f => ({ ...f, checklist_template: [...f.checklist_template, newItem.trim()] }));
    setNewItem('');
  }

  function removeChecklistItem(i: number) {
    setForm(f => ({ ...f, checklist_template: f.checklist_template.filter((_, idx) => idx !== i) }));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-guin-card border border-guin-border rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />
        <div className="flex items-center justify-between px-6 py-4 border-b border-guin-border">
          <h2 className="text-guin-cream font-bold">{site ? 'Modifier le site' : 'Nouveau site'}</h2>
          <button onClick={onClose} className="text-guin-cream-dim hover:text-guin-cream"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="text-xs text-guin-cream-dim mb-1 block">Nom du site *</label>
            <input className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
              value={form.name} onChange={set('name')} placeholder="Ex: Bureau Central Dzedze" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Type</label>
              <select className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                value={form.site_type} onChange={set('site_type')}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Surface (m²)</label>
              <input type="number" className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                value={form.surface_m2} onChange={set('surface_m2')} placeholder="250" />
            </div>
          </div>

          <div>
            <label className="text-xs text-guin-cream-dim mb-1 block">Adresse *</label>
            <input className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
              value={form.address} onChange={set('address')} placeholder="12 rue de la Paix" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Ville *</label>
              <input className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                value={form.city} onChange={set('city')} placeholder="Lomé" />
            </div>
            <div>
              <label className="text-xs text-guin-cream-dim mb-1 block">Pays</label>
              <input className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold"
                value={form.country} onChange={set('country')} />
            </div>
          </div>

          <div>
            <label className="text-xs text-guin-cream-dim mb-1 block">Description</label>
            <textarea className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-guin-cream text-sm focus:outline-none focus:border-guin-gold resize-none"
              rows={2} value={form.description} onChange={set('description')} />
          </div>

          <div>
            <label className="text-xs text-guin-cream-dim mb-2 block">Checklist par défaut</label>
            <div className="space-y-1 mb-2">
              {form.checklist_template.map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-guin-dark px-3 py-1.5 rounded-lg">
                  <CheckCircle2 size={12} className="text-guin-green flex-shrink-0" />
                  <span className="text-guin-cream text-xs flex-1">{item}</span>
                  <button onClick={() => removeChecklistItem(i)} className="text-guin-cream-dim hover:text-guin-red">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-guin-dark border border-guin-border rounded-xl px-3 py-2 text-guin-cream text-xs focus:outline-none focus:border-guin-gold"
                placeholder="Ajouter une tâche…"
                value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
              />
              <button onClick={addChecklistItem}
                className="px-3 py-2 bg-guin-dark border border-guin-border rounded-xl text-guin-cream-dim hover:text-guin-gold transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-red-400 text-xs">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur'}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-guin-border">
          <button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || !form.address || !form.city || mutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-guin-terracotta text-guin-cream disabled:opacity-40 hover:bg-guin-terra-light transition-colors"
          >
            {mutation.isPending ? 'Enregistrement…' : site ? 'Enregistrer les modifications' : 'Créer le site'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function SitesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editSite, setEditSite] = useState<Site | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['sites', search],
    queryFn: () =>
      apiClient.get<{ data: Site[] }>(`/sites?limit=100${search ? `&search=${search}` : ''}`).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const sites = data ?? [];

  return (
    <>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-guin-cream font-bold text-2xl">Sites</h1>
            <p className="text-guin-cream-dim text-sm mt-0.5">{sites.length} site{sites.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setEditSite(undefined); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-guin-terracotta text-guin-cream rounded-xl text-sm font-semibold hover:bg-guin-terra-light transition-colors"
          >
            <Plus size={16} /> Nouveau site
          </button>
        </div>

        <div className="flex items-center gap-2 bg-guin-card border border-guin-border rounded-xl px-3 py-2 mb-4 max-w-sm">
          <Search size={14} className="text-guin-cream-dim" />
          <input
            className="bg-transparent text-guin-cream text-sm placeholder-guin-cream-dim outline-none w-full"
            placeholder="Rechercher un site…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-guin-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {sites.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-guin-card border border-guin-border rounded-xl overflow-hidden group hover:border-guin-gold/40 transition-all"
              >
                <div className="h-1" style={{ background: TYPE_COLORS[s.site_type] ?? '#4B5563' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs px-2 py-0.5 rounded-full mb-1 inline-block"
                        style={{ color: TYPE_COLORS[s.site_type], background: `${TYPE_COLORS[s.site_type]}22` }}>
                        {TYPE_LABELS[s.site_type] ?? s.site_type}
                      </span>
                      <h3 className="text-guin-cream font-semibold text-sm truncate">{s.name}</h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditSite(s); setShowModal(true); }}
                        className="p-1.5 text-guin-cream-dim hover:text-guin-gold transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(s.id)}
                        className="p-1.5 text-guin-cream-dim hover:text-guin-red transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-guin-cream-dim text-xs">
                      <MapPin size={11} />{s.address}, {s.city}
                    </p>
                    {s.surface_m2 && (
                      <p className="flex items-center gap-1.5 text-guin-cream-dim text-xs">
                        <Building2 size={11} />{s.surface_m2} m²
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-guin-border">
                    <span className={clsx(
                      'text-xs font-medium',
                      s.active_missions > 0 ? 'text-guin-green' : 'text-guin-cream-dim',
                    )}>
                      {s.active_missions > 0 ? `${s.active_missions} mission${s.active_missions > 1 ? 's' : ''} active${s.active_missions > 1 ? 's' : ''}` : 'Aucune mission active'}
                    </span>
                    {s.checklist_template?.length > 0 && (
                      <span className="text-guin-cream-dim text-xs">{s.checklist_template.length} tâches</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showModal && <SiteModal site={editSite} onClose={() => { setShowModal(false); setEditSite(undefined); }} />}
      </AnimatePresence>
    </>
  );
}
