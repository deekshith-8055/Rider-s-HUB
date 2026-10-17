import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { AppUser, NetworkState } from '../types';
import { api } from '../services/api';
import { offlineSyncService } from '../services/offline/offlineSyncService';
import { notificationService, type ToastPayload } from '../services/notifications/notificationService';

interface AppContextValue {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
  loading: boolean;
  networkState: NetworkState;
  toasts: ToastPayload[];
  dismissToast: (id: string) => void;
  offlineQueueSize: number;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkState, setNetworkState] = useState<NetworkState>(navigator.onLine ? 'online' : 'offline');
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);

  const refreshUser = useCallback(async () => {
    const u = await api.getCurrentUser();
    setUser(u);
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));

    const goOnline = () => setNetworkState('online');
    const goOffline = () => setNetworkState('offline');
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const unsubToast = notificationService.onToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4200);
    });
    const unsubQueue = offlineSyncService.onChange((q) => setOfflineQueueSize(q.length));

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubToast();
      unsubQueue();
    };
  }, [refreshUser]);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <AppContext.Provider
      value={{ user, setUser, loading, networkState, toasts, dismissToast, offlineQueueSize, refreshUser }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
