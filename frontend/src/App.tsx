import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import MissionsPage from './pages/MissionsPage';
import SitesPage from './pages/SitesPage';
import UsersPage from './pages/UsersPage';
import AuditPage from './pages/AuditPage';
import SubscriptionPage from './pages/SubscriptionPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<AppLayout><DashboardPage /></AppLayout>} />
        <Route path="/missions" element={<AppLayout><MissionsPage /></AppLayout>} />
        <Route path="/sites" element={<AppLayout><SitesPage /></AppLayout>} />
        <Route path="/users" element={<AppLayout><UsersPage /></AppLayout>} />
        <Route path="/audit" element={<AppLayout><AuditPage /></AppLayout>} />
        <Route path="/subscription" element={<AppLayout><SubscriptionPage /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
