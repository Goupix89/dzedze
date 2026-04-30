import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, Activity, AlertTriangle, 
  LogOut, Clock, Shield, ChevronRight 
} from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { SuperadminOrgSelector } from '../components/admin/SuperadminOrgSelector';
import { TenantsOverview } from '../components/admin/TenantsOverview';
import { SupportTickets } from '../components/admin/SupportTickets';
import { clsx } from 'clsx';

// ── Banner spécial mode admin ──────────────────────────────────
function AdminModeBanner() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="bg-red-900/40 border-b-2 border-red-700 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-red-400" />
          <div>
            <p className="text-sm font-bold text-red-200">MODE SUPERADMIN</p>
            <p className="text-xs text-red-300">Bienvenue {user?.first_name} · Support client</p>
          </div>
        </div>
        <button
          onClick={() => {
            clearAuth();
            navigate('/login');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-700/50 hover:bg-red-700 rounded-lg text-red-100 text-sm transition-colors"
        >
          <LogOut size={14} />
          Déconnecter
        </button>
      </div>
    </div>
  );
}

// ── Tabs Navigation ────────────────────────────────────────────
interface TabConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  count?: number;
}

function AdminTabs({ 
  activeTab, 
  setActiveTab, 
  tabs 
}: { 
  activeTab: string; 
  setActiveTab: (tab: string) => void;
  tabs: TabConfig[];
}) {
  return (
    <div className="border-b border-guin-border">
      <div className="flex gap-1 px-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium',
                isActive
                  ? 'border-guin-gold text-guin-gold'
                  : 'border-transparent text-guin-cream-dim hover:text-guin-cream'
              )}
            >
              <Icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 px-2 py-0.5 bg-guin-muted/30 rounded text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('selector');
  const navigate = useNavigate();

  // Rediriger si pas superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="p-8 text-center">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-guin-cream mb-2">Accès Refusé</h2>
        <p className="text-guin-cream-dim">Cette page est réservée aux superadmins.</p>
      </div>
    );
  }

  const tabs: TabConfig[] = [
    { id: 'selector', label: 'Sélectionner Tenant', icon: Building2 },
    { id: 'overview', label: 'Vue d\'ensemble', icon: Activity },
    { id: 'support', label: 'Support Client', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-guin-bg flex flex-col">
      <AdminModeBanner />

      <div className="flex-1 flex flex-col">
        <AdminTabs activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

        <div className="flex-1 overflow-auto">
          {activeTab === 'selector' && <SuperadminOrgSelector />}
          {activeTab === 'overview' && <TenantsOverview />}
          {activeTab === 'support' && <SupportTickets />}
        </div>
      </div>
    </div>
  );
}
