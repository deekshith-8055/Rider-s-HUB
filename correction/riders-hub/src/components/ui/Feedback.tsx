import React from 'react';
import { WifiOff, Wifi, AlertTriangle, Inbox, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ToastPayload } from '../../services/notifications/notificationService';

export function ToastStack({ toasts, onDismiss }: { toasts: ToastPayload[]; onDismiss: (id: string) => void }) {
  const icon = {
    info: <Info size={16} className="text-gps-400" />,
    success: <CheckCircle2 size={16} className="text-signal-green" />,
    warning: <AlertTriangle size={16} className="text-signal-amber" />,
    danger: <XCircle size={16} className="text-signal-red" />,
  };
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[92%] max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="glass border border-asphalt-600 rounded-xl px-4 py-3 rise-fade cursor-pointer shadow-lg"
        >
          <div className="flex items-start gap-2">
            {icon[t.variant]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-asphalt-100">{t.title}</p>
              {t.body && <p className="text-xs text-asphalt-300 mt-0.5">{t.body}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OfflineBanner({ state }: { state: 'offline' | 'online_returning' }) {
  if (state === 'online_returning') {
    return (
      <div className="flex items-center gap-2 justify-center bg-signal-green/15 text-signal-green text-xs font-semibold py-1.5 rise-fade">
        <Wifi size={13} /> BACK ONLINE — SYNCING
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 justify-center bg-signal-amber/15 text-signal-amber text-xs font-semibold py-1.5">
      <WifiOff size={13} /> OFFLINE MODE — DATA WILL SYNC WHEN RECONNECTED
    </div>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-16 rounded-xl" />
      ))}
      <p className="text-center text-xs text-asphalt-400 font-mono">{label}…</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6 gap-3">
      <div className="w-16 h-16 rounded-2xl bg-asphalt-800 border border-asphalt-600 flex items-center justify-center text-asphalt-400">
        {icon ?? <Inbox size={26} />}
      </div>
      <p className="font-display font-semibold text-base text-asphalt-100">{title}</p>
      {body && <p className="text-sm text-asphalt-400 max-w-xs">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6 gap-2">
      <AlertTriangle className="text-signal-red" size={28} />
      <p className="font-display font-semibold text-asphalt-100">{title}</p>
      {body && <p className="text-sm text-asphalt-400">{body}</p>}
    </div>
  );
}
