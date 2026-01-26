import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/ui/sonner';
import { WebSocketProvider } from '@/context/WebSocketContext';
import Dashboard from '@/pages/Dashboard';
import Accounts from '@/pages/Accounts';
import Trades from '@/pages/Trades';
import Logs from '@/pages/Logs';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WebSocketProvider>
      <BrowserRouter>
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
        <Toaster position="bottom-right" richColors />
      </BrowserRouter>
    </WebSocketProvider>
  );
}

export default App;
