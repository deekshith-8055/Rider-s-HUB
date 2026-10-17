type ToastListener = (toast: ToastPayload) => void;

export interface ToastPayload {
  id: string;
  title: string;
  body?: string;
  variant: 'info' | 'success' | 'warning' | 'danger';
}

class NotificationService {
  private listeners: ToastListener[] = [];

  onToast(cb: ToastListener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  toast(title: string, body?: string, variant: ToastPayload['variant'] = 'info') {
    const payload: ToastPayload = { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title, body, variant };
    this.listeners.forEach((cb) => cb(payload));
  }

  async requestBrowserPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  }

  notifyBrowser(title: string, body?: string) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
}

export const notificationService = new NotificationService();
