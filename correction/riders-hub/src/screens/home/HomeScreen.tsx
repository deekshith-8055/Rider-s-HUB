import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogIn, Map as MapIcon, CalendarPlus, Store } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { SectionTitle } from '../../components/ui/Primitives';
import { StatCard } from '../../components/ui/Controls';
import { BusinessCard } from '../../components/ride/Cards';
import { EmptyState, LoadingState } from '../../components/ui/Feedback';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { AppNotification, Business, SavedRideSummary } from '../../types';
import { formatDistance, formatDuration } from '../../utils/format';

export function HomeScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [recentRides, setRecentRides] = useState<SavedRideSummary[]>([]);
  const [nearbyRiderCount, setNearbyRiderCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [biz, saved, nearby, notifs] = await Promise.all([
        api.listBusinesses(),
        user ? api.listSavedRides(user.id) : Promise.resolve([]),
        api.listNearbyRiders(),
        user ? api.listNotifications(user.id) : Promise.resolve([]),
      ]);
      setBusinesses(biz.slice(0, 4));
      setRecentRides(saved.slice(0, 3));
      setNearbyRiderCount(nearby.length);
      setNotifications(notifs);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingState label="Loading your hub" />;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="rise-fade">
      <Header unreadCount={unreadCount} />

      <div className="px-4 md:px-6 space-y-7">
        <div>
          <h1 className="font-display font-bold text-2xl text-asphalt-100">Ready for the next ride?</h1>
          <p className="text-sm text-asphalt-400 mt-1">Start a ride or explore what's around you.</p>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <QuickAction icon={<Zap size={18} />} label="Start Ride" accent onClick={() => navigate('/ride/start')} />
            <QuickAction icon={<LogIn size={18} />} label="Join Ride" onClick={() => navigate('/ride/join')} />
            <QuickAction icon={<CalendarPlus size={18} />} label="Plan Ride" onClick={() => navigate('/ride/start')} />
            <QuickAction icon={<MapIcon size={18} />} label="Explore Map" onClick={() => navigate('/map')} />
          </div>
        </div>

        <div>
          <SectionTitle>Your stats</SectionTitle>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
            <StatCard label="Total rides" value={String(user?.stats.totalRides ?? 0)} />
            <StatCard label="Distance" value={formatDistance(user?.stats.totalDistanceKm ?? 0)} />
            <StatCard label="Riding time" value={formatDuration(user?.stats.totalRidingMinutes ?? 0)} />
            <StatCard label="Riders connected" value={String(user?.stats.ridersConnected ?? 0)} sub={`${nearbyRiderCount} nearby now`} />
          </div>
        </div>

        <div>
          <SectionTitle action={<button onClick={() => navigate('/map')} className="text-xs text-ember-500 font-semibold">See all</button>}>
            Nearby for riders
          </SectionTitle>
          {businesses.length === 0 ? (
            <EmptyState
              icon={<Store size={26} />}
              title="No businesses nearby yet"
              body="Registered petrol stations, mechanics, and rider stops will show up here."
            />
          ) : (
            <div className="space-y-2.5">
              {businesses.map((b) => (
                <BusinessCard key={b.id} business={b} onClick={() => navigate('/map')} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle action={<button onClick={() => navigate('/profile')} className="text-xs text-ember-500 font-semibold">View all</button>}>
            Recent rides
          </SectionTitle>
          {recentRides.length === 0 ? (
            <EmptyState title="No rides yet" body="Start or join a ride to see your history here." />
          ) : (
            <div className="space-y-2.5">
              {recentRides.map((r) => (
                <div
                  key={r.id}
                  className="bg-asphalt-800 border border-asphalt-600 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-semibold text-sm text-asphalt-100">{r.name}</p>
                    <p className="text-xs text-asphalt-400 mt-0.5">
                      {r.origin} → {r.destination} · {r.riderCount} riders
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-sm text-ember-400">{formatDistance(r.distanceKm)}</p>
                    <p className="text-xs text-asphalt-400">{formatDuration(r.durationMinutes)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-2xl px-4 py-3.5 border font-semibold text-sm transition-transform active:scale-[0.98] ${
        accent
          ? 'bg-ember-500 border-ember-500 text-white shadow-[0_8px_24px_-8px_rgba(255,77,28,0.6)]'
          : 'bg-asphalt-800 border-asphalt-600 text-asphalt-100'
      }`}
    >
      {icon} {label}
    </button>
  );
}
