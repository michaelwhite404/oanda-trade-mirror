import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcuts';
import { useNavigationShortcuts } from '@/hooks/useKeyboardShortcuts';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Trades from '@/pages/Trades';
import Logs from '@/pages/Logs';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Users from '@/pages/Users';
import Account from '@/pages/Account';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ProtectedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Enable g+key navigation shortcuts
  useNavigationShortcuts();

  return (
    <ProtectedRoute>
      <div className="flex h-screen">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 overflow-auto pt-14 lg:pt-0">
          <div className="p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/logs" element={<Logs />} />
              <Route
                path="/users"
                element={
                  <AdminRoute>
                    <Users />
                  </AdminRoute>
                }
              />
              <Route path="/account" element={<Account />} />
            </Routes>
          </div>
        </main>
      </div>
      <KeyboardShortcutsDialog />
    </ProtectedRoute>
  );
}

const isStaging = window.location.hostname.includes('staging') || window.location.hostname.startsWith('stage.');

function StagingBadge() {
  if (!isStaging) return null;
  return (
    <div className="fixed bottom-3 right-3 z-[100] select-none rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black shadow-lg opacity-70 hover:opacity-100 transition-opacity">
      STAGING
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/register/:token" element={<Register />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
          <Toaster position="bottom-right" richColors />
          <StagingBadge />
        </BrowserRouter>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
