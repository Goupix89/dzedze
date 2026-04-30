import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'agent';
}

export interface Organization {
  id: string;
  name: string;
  plan: string;
  planName: string;
  priceFcfa: number;
  features: string[];
  platforms: string[];
  agentLimit: number;
  siteLimit: number;
  trialEndsAt: string | null;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  organization: Organization | null;
  // Superadmin: organisation sélectionnée pour voir ses données
  selectedOrgId: string | null;
  selectedOrgName: string | null;
  setAuth: (payload: { user: User; accessToken?: string; organization?: Organization | null }) => void;
  clearAuth: () => void;
  selectOrg: (orgId: string | null, orgName: string | null) => void;
  loadOrgFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  organization: null,
  selectedOrgId: null,
  selectedOrgName: null,
  setAuth: ({ user, accessToken, organization }) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    set({ user, accessToken: accessToken ?? localStorage.getItem('accessToken'), organization: organization ?? null });
  },
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('selectedOrgId');
    localStorage.removeItem('selectedOrgName');
    set({ user: null, accessToken: null, organization: null, selectedOrgId: null, selectedOrgName: null });
  },
  selectOrg: (orgId, orgName) => {
    if (orgId) {
      localStorage.setItem('selectedOrgId', orgId);
      localStorage.setItem('selectedOrgName', orgName || '');
    } else {
      localStorage.removeItem('selectedOrgId');
      localStorage.removeItem('selectedOrgName');
    }
    set({ selectedOrgId: orgId, selectedOrgName: orgName });
  },
  loadOrgFromStorage: () => {
    const orgId = localStorage.getItem('selectedOrgId');
    const orgName = localStorage.getItem('selectedOrgName');
    if (orgId) {
      set({ selectedOrgId: orgId, selectedOrgName: orgName });
    }
  },
}));
