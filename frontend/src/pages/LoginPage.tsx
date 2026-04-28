import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { apiClient } from '../services/api';

// ── Kente SVG pattern ─────────────────────────────────────────
function KentePanel() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0">
      <defs>
        <pattern id="kente" x="0" y="0" width="64" height="64" patternUnits="userSpaceOnUse">
          {/* Base stripe rows */}
          <rect width="64" height="16" fill="#C1440E" />
          <rect y="16" width="64" height="8"  fill="#D4A017" />
          <rect y="24" width="64" height="16" fill="#2D6A4F" />
          <rect y="40" width="64" height="8"  fill="#D4A017" />
          <rect y="48" width="64" height="16" fill="#C1440E" />
          {/* Vertical dark separators */}
          <rect x="0"  width="4" height="64" fill="rgba(12,8,5,0.55)" />
          <rect x="30" width="4" height="64" fill="rgba(12,8,5,0.35)" />
          {/* Diamonds */}
          <polygon points="32,0  40,8  32,16 24,8"  fill="#F5ECD7" opacity="0.25" />
          <polygon points="32,24 40,32 32,40 24,32" fill="#F5ECD7" opacity="0.20" />
          <polygon points="32,48 40,56 32,64 24,56" fill="#F5ECD7" opacity="0.25" />
          {/* Small gold squares */}
          <rect x="14" y="14" width="4" height="4" fill="#D4A017" opacity="0.8" />
          <rect x="46" y="14" width="4" height="4" fill="#D4A017" opacity="0.8" />
          <rect x="14" y="46" width="4" height="4" fill="#D4A017" opacity="0.8" />
          <rect x="46" y="46" width="4" height="4" fill="#D4A017" opacity="0.8" />
        </pattern>
        {/* Radial dark vignette overlay */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="rgba(12,8,5,0)"   />
          <stop offset="100%" stopColor="rgba(12,8,5,0.72)" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
      <rect width="100%" height="100%" fill="url(#vignette)" />
    </svg>
  );
}

// ── Dzedze logomark ───────────────────────────────────────────
function DzedzeMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer diamond */}
      <polygon points="28,2 54,28 28,54 2,28" stroke="#D4A017" strokeWidth="2.5" fill="none" />
      {/* Inner diamond */}
      <polygon points="28,12 44,28 28,44 12,28" fill="#C1440E" opacity="0.9" />
      {/* Center cross */}
      <line x1="28" y1="18" x2="28" y2="38" stroke="#F5ECD7" strokeWidth="2" />
      <line x1="18" y1="28" x2="38" y2="28" stroke="#F5ECD7" strokeWidth="2" />
      {/* Corner dots */}
      <circle cx="28" cy="2"  r="2.5" fill="#D4A017" />
      <circle cx="54" cy="28" r="2.5" fill="#D4A017" />
      <circle cx="28" cy="54" r="2.5" fill="#D4A017" />
      <circle cx="2"  cy="28" r="2.5" fill="#D4A017" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      localStorage.setItem('accessToken', accessToken);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-guin-dark">

      {/* ── Left decorative panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center">
        <KentePanel />
        <div className="relative z-10 flex flex-col items-center text-center px-12 select-none">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <DzedzeMark size={88} />
          </motion.div>

          <motion.h1
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-6 font-display text-6xl font-bold tracking-widest text-guin-gold"
            style={{ textShadow: '0 2px 24px rgba(212,160,23,0.4)' }}
          >
            DZEDZE
          </motion.h1>

          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-3 text-guin-cream text-lg tracking-[0.3em] uppercase font-light"
          >
            Propreté · Qualité · Confiance
          </motion.p>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-6 h-0.5 w-40 bg-gradient-to-r from-transparent via-guin-gold to-transparent"
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-guin-cream/60 text-sm leading-relaxed max-w-xs"
          >
            Plateforme de supervision des missions de nettoyage avec intelligence artificielle.
          </motion.p>

          {/* Kente accent bar at bottom */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-10 h-2 w-64 rounded-full overflow-hidden"
            style={{
              background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)'
            }}
          />
        </div>
      </div>

      {/* ── Right form panel ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-guin-card lg:bg-guin-dark/80">

        {/* Mobile logo */}
        <div className="flex lg:hidden flex-col items-center mb-10">
          <DzedzeMark size={56} />
          <h1 className="mt-3 font-display text-4xl font-bold tracking-widest text-guin-gold">DZEDZE</h1>
          <p className="text-guin-cream/50 text-xs tracking-widest mt-1">PROPRETÉ · QUALITÉ · CONFIANCE</p>
        </div>

        <motion.div
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Top kente accent */}
          <div className="h-1 w-full rounded-t-sm mb-8 overflow-hidden" style={{
            background: 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 10px,#D4A017 10px,#D4A017 20px,#2D6A4F 20px,#2D6A4F 30px,#D4A017 30px,#D4A017 40px)'
          }} />

          <h2 className="text-2xl font-semibold text-guin-cream mb-1">Connexion</h2>
          <p className="text-guin-cream-dim text-sm mb-8">Bienvenue. Veuillez vous identifier.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-guin-gold tracking-widest uppercase mb-2">
                Adresse e-mail
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-4 py-3 text-guin-cream placeholder-guin-cream/30 focus:outline-none focus:border-guin-gold focus:ring-1 focus:ring-guin-gold transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-guin-gold tracking-widest uppercase mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-guin-dark border border-guin-border rounded-lg px-4 py-3 pr-12 text-guin-cream placeholder-guin-cream/30 focus:outline-none focus:border-guin-gold focus:ring-1 focus:ring-guin-gold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-guin-cream-dim hover:text-guin-cream transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2"
              >
                {error}
              </motion.p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-guin-terracotta hover:bg-guin-terra-light disabled:opacity-60 text-guin-cream font-semibold py-3 rounded-lg transition-colors tracking-wide"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          {/* Bottom accent + branding */}
          <div className="mt-10 pt-6 border-t border-guin-border text-center">
            <p className="text-guin-cream/30 text-xs tracking-widest">
              DZEDZE · Supervision Nettoyage · v1.0
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
