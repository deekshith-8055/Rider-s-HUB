import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NotificationCard } from '../../components/ride/Cards';
import { EmptyState } from '../../components/ui/Feedback';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { AppNotification } from '../../types';

export function NotificationsScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (user) api.listNotifications(user.id).then(setNotifs);
  }, [user]);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="px-4 md:px-6 py-4 max-w-lg mx-auto rise-fade">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Notifications</h1>
      </div>

      {notifs.length === 0 ? (
        <EmptyState title="You're all caught up" body="Ride invites and alerts will show up here." />
      ) : (
        <div className="space-y-2.5">
          {notifs.map((n) => (
            <NotificationCard key={n.id} notif={n} onClick={() => markRead(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
