import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcuts';
import { useNavigationShortcuts } from '@/hooks/useKeyboardShortcuts';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Trades from '@/pages/Trades';
import Logs from '@/pages/Logs';

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Enable g+key navigation shortcuts
  useNavigationShortcuts();

  return (
    <>
      <div className="flex h-screen">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 overflow-auto pt-14 lg:pt-0">
          <div className="p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/logs" element={<Logs />} />
            </Routes>
          </div>
        </main>
      </div>
      <KeyboardShortcutsDialog />
      <Toaster position="bottom-right" richColors />
    </>
  );
}

function App() {
  return (
    <WebSocketProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </WebSocketProvider>
  );
}

export default App;
