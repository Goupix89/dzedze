import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { clsx } from 'clsx';

// ── Plan data ─────────────────────────────────────────────────
const PLANS = [
  {
    id: 'trial',
    name: 'Essai gratuit',
    price: '0',
    period: '14 jours',
    highlight: false,
    color: '#6B7280',
    agents: '3 agents',
    sites: '1 site',
    platforms: 'Android + Web',
    features: [
      'Gestion des missions',
      'Checklist personnalisée',
      'Photo upload',
      'Dashboard & stats',
      'Score qualité manuel',
      'Push notifications',
      'Mode hors-ligne',
      'Export PDF basique',
    ],
    locked: [
      'Analyse IA des photos',
      'Capture vidéo',
      'Live stream',
      'Journal d\'audit',
    ],
  },
  {
    id: 'essential',
    name: 'Essentiel',
    price: '50 000',
    period: '/ mois',
    highlight: false,
    color: '#D4A017',
    agents: '20 agents',
    sites: '3 sites',
    platforms: 'Android uniquement',
    features: [
      'Toutes les fonctions Essai',
      'Jusqu\'à 20 agents',
      'Jusqu\'à 3 sites',
      'Support email',
    ],
    locked: [
      'Analyse IA des photos',
      'Live stream',
      'iOS & Web',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '100 000',
    period: '/ mois',
    highlight: true,
    color: '#2D6A4F',
    agents: '80 agents',
    sites: '15 sites',
    platforms: 'Android + iOS + Web',
    features: [
      'Toutes les 15 fonctionnalités',
      'Analyse IA des photos',
      'Capture vidéo & GoPro',
      'Live stream',
      'Journal d\'audit RGPD',
      'Rapport IA complet',
      'Support prioritaire',
    ],
    locked: [],
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: '200 000',
    period: '/ mois',
    highlight: false,
    color: '#C1440E',
    agents: 'Illimité',
    sites: 'Illimité',
    platforms: 'Android + iOS + Web + API',
    features: [
      'Tout Business inclus',
      'Agents & sites illimités',
      'API ouverte',
      'Personnalisation (logo, PDF)',
      'Domaine personnalisé',
      'Support dédié 24/7',
    ],
    locked: [],
  },
] as const;

type PlanId = typeof PLANS[number]['id'];

// ── Step 1 — Plan picker ──────────────────────────────────────
function PlanStep({ selected, onSelect }: { selected: PlanId; onSelect: (p: PlanId) => void }) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">Choisissez votre abonnement</h2>
        <p className="text-guin-muted text-sm mt-1">Commencez gratuitement, évoluez à votre rythme</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLANS.map((plan) => (
          <motion.button
            key={plan.id}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onSelect(plan.id)}
            className={clsx(
              'relative text-left p-4 rounded-2xl border-2 transition-all',
              selected === plan.id
                ? 'border-opacity-100 bg-white/5'
                : 'border-guin-border bg-guin-card hover:border-gray-500',
              plan.highlight && selected !== plan.id && 'border-guin-green/50',
            )}
            style={{ borderColor: selected === plan.id ? plan.color : undefined }}
          >
            {plan.highlight && (
              <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-xs font-bold text-white rounded-full"
                style={{ backgroundColor: plan.color }}>
                Populaire
              </span>
            )}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-white">{plan.name}</p>
                <p className="text-xs text-guin-muted">{plan.agents} · {plan.sites}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg" style={{ color: plan.color }}>{plan.price}</p>
                <p className="text-xs text-guin-muted">FCFA {plan.period}</p>
              </div>
            </div>
            <p className="text-xs text-guin-muted mb-2">{plan.platforms}</p>
            <ul className="space-y-1">
              {plan.features.slice(0, 3).map(f => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-guin-cream">
                  <Check size={11} className="flex-shrink-0" style={{ color: plan.color }} />
                  {f}
                </li>
              ))}
              {plan.features.length > 3 && (
                <li className="text-xs text-guin-muted pl-4">+ {plan.features.length - 3} autres…</li>
              )}
            </ul>
            {selected === plan.id && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: plan.color }}>
                <Check size={11} className="text-white" />
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2 — Account form ─────────────────────────────────────
function AccountStep({
  plan, values, onChange,
}: {
  plan: PlanId;
  values: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  const p = PLANS.find(x => x.id === plan)!;
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2"
          style={{ backgroundColor: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44` }}>
          Plan {p.name} — {p.price} FCFA{p.period !== '14 jours' ? ' /mois' : ' (gratuit)'}
        </span>
        <h2 className="text-xl font-bold text-white">Créez votre compte</h2>
      </div>

      {[
        { key: 'companyName', label: 'Nom de l\'agence *', placeholder: 'Propreté Excellence SARL', type: 'text' },
        { key: 'firstName',   label: 'Prénom *',           placeholder: 'Kofi',                    type: 'text' },
        { key: 'lastName',    label: 'Nom *',              placeholder: 'Mensah',                  type: 'text' },
        { key: 'phone',       label: 'Téléphone',          placeholder: '+228 90 00 00 00',        type: 'tel' },
        { key: 'email',       label: 'Email *',            placeholder: 'kofi@agence.com',         type: 'email' },
        { key: 'password',    label: 'Mot de passe *',     placeholder: 'Min. 8 caractères',       type: 'password' },
      ].map(({ key, label, placeholder, type }) => (
        <div key={key}>
          <label className="block text-xs text-guin-muted mb-1">{label}</label>
          <input
            type={type}
            value={values[key] ?? ''}
            onChange={e => onChange(key, e.target.value)}
            placeholder={placeholder}
            className="w-full bg-guin-dark border border-guin-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-guin-border focus:outline-none focus:border-guin-gold"
          />
        </div>
      ))}

      <p className="text-xs text-guin-muted pt-1">
        En créant un compte vous acceptez les{' '}
        <span className="text-guin-gold cursor-pointer hover:underline">CGU & politique de confidentialité</span>.
      </p>
    </div>
  );
}

// ── Main Signup Page ──────────────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep]     = useState<1 | 2>(1);
  const [plan, setPlan]     = useState<PlanId>('trial');
  const [form, setForm]     = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    const required = ['companyName','firstName','lastName','email','password'];
    for (const k of required) {
      if (!form[k]?.trim()) { setError('Veuillez remplir tous les champs obligatoires.'); return; }
    }
    if ((form.password ?? '').length < 8) { setError('Mot de passe trop court (8 caractères minimum).'); return; }

    setLoading(true); setError(null);
    try {
      const res = await apiClient.post('/auth/signup', { ...form, plan });
      const { data } = res.data;

      setAuth({
        user: {
          id: data.user.id, email: data.user.email,
          first_name: data.user.firstName, last_name: data.user.lastName,
          role: data.user.role,
        },
        accessToken: data.accessToken,
        organization: data.organization,
      });
      navigate('/');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors de la création du compte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-guin-dark flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-guin-gold font-bold text-2xl tracking-widest mb-1">DZEDZE</p>
          <p className="text-guin-muted text-sm">Plateforme de supervision nettoyage</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                step >= s ? 'bg-guin-gold text-guin-dark' : 'bg-guin-card text-guin-muted border border-guin-border',
              )}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 2 && <div className={clsx('h-0.5 w-16', step > s ? 'bg-guin-gold' : 'bg-guin-border')} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-guin-card border border-guin-border rounded-2xl overflow-hidden shadow-2xl">
          <div className="h-1" style={{ background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)' }} />
          <div className="p-6">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <PlanStep selected={plan} onSelect={setPlan} />
                </motion.div>
              ) : (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                  <AccountStep plan={plan} values={form} onChange={setField} />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-red-900/20 border border-red-800 rounded-xl">
                <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 px-4 py-2.5 border border-guin-border rounded-xl text-sm text-guin-cream hover:bg-guin-dark"
                >
                  <ChevronLeft size={16} /> Retour
                </button>
              )}
              <button
                onClick={step === 1 ? () => setStep(2) : submit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-guin-gold text-guin-dark hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Création du compte…</>
                ) : step === 1 ? (
                  <>Continuer <ChevronRight size={16} /></>
                ) : (
                  'Créer mon compte'
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-guin-muted text-sm mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-guin-gold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
