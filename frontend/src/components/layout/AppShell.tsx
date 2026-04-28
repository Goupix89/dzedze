import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, MapPin, Users,
  LogOut, ChevronLeft, ChevronRight, Shield,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { clsx } from 'clsx';

function KenteBar({ vertical = false }: { vertical?: boolean }) {
  const grad = 'repeating-linear-gradient(90deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)';
  const gradV = 'repeating-linear-gradient(180deg,#C1440E 0,#C1440E 12px,#D4A017 12px,#D4A017 24px,#2D6A4F 24px,#2D6A4F 36px,#D4A017 36px,#D4A017 48px)';
  return (
    <div style={{ background: vertical ? gradV : grad, [vertical ? 'width' : 'height']: 4, flexShrink: 0 }} />
  );
}

function DzedzeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="#D4A017" strokeWidth="2" fill="#0E1621" />
      <polygon points="20,6 26,14 34,14 28,20 30,28 20,23 10,28 12,20 6,14 14,14" fill="#D4A017" opacity="0.15" />
      <circle cx="20" cy="20" r="5" fill="#D4A017" />
      <line x1="20" y1="10" x2="20" y2="15" stroke="#C1440E" strokeWidth="1.5" />
      <line x1="20" y1="25" x2="20" y2="30" stroke="#C1440E" strokeWidth="1.5" />
      <line x1="10" y1="20" x2="15" y2="20" stroke="#C1440E" strokeWidth="1.5" />
      <line x1="25" y1="20" x2="30" y2="20" stroke="#C1440E" strokeWidth="1.5" />
    </svg>
  );
}

const NAV = [
  { to: '/',        label: 'Tableau de bord', Icon: LayoutDashboard },
  { to: '/missions', label: 'Missions',       Icon: ClipboardList  },
  { to: '/sites',    label: 'Sites',          Icon: MapPin         },
  { to: '/users',    label: 'Agents',         Icon: Users          },
  { to: '/audit',    label: 'Audit',          Icon: Shield         },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  function logout() { clearAuth(); navigate('/login'); }

  return (
    <div className="flex h-screen bg-guin-dark overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 220 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex flex-col bg-guin-card border-r border-guin-border flex-shrink-0 overflow-hidden"
      >
        <KenteBar />

        {/* Logo */}
        <div className={clsx('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-0')}>
          <DzedzeMark size={32} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="text-guin-gold font-bold text-lg tracking-widest whitespace-nowrap"
              >
                DZEDZE
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-guin-terracotta/20 text-guin-terracotta border border-guin-terracotta/40'
                  : 'text-guin-cream-dim hover:bg-white/5 hover:text-guin-cream',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* User + collapse */}
        <div className="p-3 border-t border-guin-border space-y-2">
          {!collapsed && user && (
            <div className="px-2 py-1">
              <p className="text-guin-cream text-xs font-semibold truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-guin-cream-dim text-xs capitalize">{user.role}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-guin-cream-dim hover:text-guin-red hover:bg-guin-red/10 transition-all',
              collapsed && 'justify-center',
            )}
          >
            <LogOut size={15} />
            {!collapsed && 'Déconnexion'}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-guin-cream-dim hover:bg-white/5 transition-all',
              collapsed && 'justify-center',
            )}
          >
            {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Réduire</span></>}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <KenteBar />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
