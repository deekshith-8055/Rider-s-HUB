import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogIn } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { SectionTitle } from '../../components/ui/Primitives';
import { RideCard } from '../../components/ride/Cards';
import { EmptyState, LoadingState } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import type { Ride } from '../../types';

export function RidesScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'mine' | 'public'>('public');
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [publicRides, setPublicRides] = useState<Ride[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [mine, pub] = await Promise.all([api.listMyRides(user.id), api.listPublicRides()]);
      setMyRides(mine);
      setPublicRides(pub);
      const entries = await Promise.all(
        [...mine, ...pub].map(async (r) => [r.id, (await api.listParticipants(r.id)).length] as const)
      );
      setCounts(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, [user]);

  const list = tab === 'mine' ? myRides : publicRides;

  return (
    <div className="rise-fade">
      <Header />
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-bold text-xl">Rides</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<LogIn size={14} />} onClick={() => navigate('/ride/join')}>
              Join
            </Button>
            <Button size="sm" icon={<Zap size={14} />} onClick={() => navigate('/ride/start')}>
              Start
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          {(['public', 'mine'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                tab === t ? 'bg-ember-500/15 border-ember-500 text-ember-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-300'
              }`}
            >
              {t === 'public' ? 'Discover' : 'My Rides'}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState />
        ) : list.length === 0 ? (
          <EmptyState
            title={tab === 'mine' ? 'No rides yet' : 'Nothing scheduled nearby'}
            body="Start a new ride or join one with a Ride ID."
            action={
              <Button onClick={() => navigate('/ride/start')} className="mt-2">
                Start a Ride
              </Button>
            }
          />
        ) : (
          <SectionTitle>{tab === 'public' ? 'Public rides near you' : 'Rides you lead or joined'}</SectionTitle>
        )}

        <div className="space-y-2.5">
          {list.map((r) => (
            <RideCard key={r.id} ride={r} riderCount={counts[r.id]} onClick={() => navigate(`/ride/live/${r.id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}
