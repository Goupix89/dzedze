import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'agent';
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
  setAuth: (payload: { user: User; accessToken?: string; organization?: Organization | null }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  organization: null,
  setAuth: ({ user, accessToken, organization }) => {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    set({ user, accessToken: accessToken ?? localStorage.getItem('accessToken'), organization: organization ?? null });
  },
  clearAuth: () => {
    localStorage.removeItem('accessToken');
    set({ user: null, accessToken: null, organization: null });
  },
}));
