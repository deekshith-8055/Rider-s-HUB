import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { OfflineBanner, ToastStack } from '../ui/Feedback';
import { useApp } from '../../context/AppContext';
import { useEffect, useState } from 'react';

export function AppShell() {
  const { networkState, toasts, dismissToast } = useApp();
  const [showReturning, setShowReturning] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (networkState === 'offline') setWasOffline(true);
    if (networkState === 'online' && wasOffline) {
      setShowReturning(true);
      setWasOffline(false);
      const t = setTimeout(() => setShowReturning(false), 3000);
      return () => clearTimeout(t);
    }
  }, [networkState, wasOffline]);

  return (
    <div className="min-h-screen flex bg-asphalt-950 text-asphalt-100">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        {networkState === 'offline' && <OfflineBanner state="offline" />}
        {showReturning && <OfflineBanner state="online_returning" />}
        <main className="flex-1 pb-24 md:pb-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
