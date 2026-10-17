import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, MapPin, History } from 'lucide-react';
import { Avatar, Card, Badge } from '../../components/ui/Primitives';
import { StatCard } from '../../components/ui/Controls';
import { EmptyState } from '../../components/ui/Feedback';
import { AchievementBadge, ACHIEVEMENTS } from '../../components/profile/AchievementBadge';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { SavedRideSummary } from '../../types';
import { formatDistance, formatDuration } from '../../utils/format';

export function ProfileScreen() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [savedRides, setSavedRides] = useState<SavedRideSummary[]>([]);

  useEffect(() => {
    if (user) api.listSavedRides(user.id).then(setSavedRides);
  }, [user]);

  if (!user) return null;

  const signOut = async () => {
    await api.signOut();
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="px-4 md:px-6 py-4 rise-fade max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-xl">Profile</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('/settings')} className="w-10 h-10 rounded-xl bg-asphalt-800 border border-asphalt-600 flex items-center justify-center">
            <Settings size={16} />
          </button>
          <button onClick={signOut} className="w-10 h-10 rounded-xl bg-asphalt-800 border border-asphalt-600 flex items-center justify-center text-signal-red">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={user.name} photoUrl={user.photoUrl} size={72} ring />
        <div>
          <p className="font-display font-bold text-xl">{user.name}</p>
          <p className="text-sm text-asphalt-400">@{user.username}</p>
          <Badge variant="ember" className="mt-1.5 capitalize">
            {user.role.replace('_', ' ')}
          </Badge>
        </div>
      </div>
      {user.bio && <p className="text-sm text-asphalt-300 mt-4 leading-relaxed">{user.bio}</p>}

      {user.preferences?.ridingStyle && user.preferences.ridingStyle.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {user.preferences.ridingStyle.map((s) => (
            <Badge key={s} variant="gps">
              {s}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6">
        <StatCard label="Total rides" value={String(user.stats.totalRides)} />
        <StatCard label="Total distance" value={formatDistance(user.stats.totalDistanceKm)} />
        <StatCard label="Riding hours" value={formatDuration(user.stats.totalRidingMinutes)} />
        <StatCard label="Max speed" value={`${user.stats.maxSpeedKmh} km/h`} />
      </div>

      <h2 className="font-display font-semibold text-lg mt-8 mb-3">Achievements</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {ACHIEVEMENTS.map((a) => (
          <AchievementBadge key={a.id} {...a} locked={!user.achievements.includes(a.id)} />
        ))}
      </div>

      <h2 className="font-display font-semibold text-lg mt-8 mb-3">Ride history</h2>
      {savedRides.length === 0 ? (
        <EmptyState icon={<History size={26} />} title="No rides completed yet" body="Finish a ride to see it here." />
      ) : (
        <div className="space-y-2.5">
          {savedRides.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  <p className="text-xs text-asphalt-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {r.origin} → {r.destination}
                  </p>
                </div>
                <p className="font-display font-bold text-ember-400 text-sm">{formatDistance(r.distanceKm)}</p>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-asphalt-400">
                <span>{formatDuration(r.durationMinutes)}</span>
                <span>{r.riderCount} riders</span>
                <span>{new Date(r.startedAt).toLocaleDateString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
