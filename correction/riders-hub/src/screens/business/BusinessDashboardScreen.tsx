import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Store } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card, Badge } from '../../components/ui/Primitives';
import { EmptyState } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { PlaceMarker } from '../../components/map/Markers';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notifications/notificationService';
import type { Business } from '../../types';

export function BusinessDashboardScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [myBusinesses, setMyBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listBusinesses().then((all) => setMyBusinesses(all.filter((b) => b.ownerId === user.id)));
  }, [user]);

  const toggleOpen = async (b: Business) => {
    const updated = await api.updateBusiness(b.id, { isOpenNow: !b.isOpenNow });
    setMyBusinesses((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
  };

  const addOffer = async (b: Business) => {
    const offer = prompt('New offer for riders:');
    if (!offer) return;
    const updated = await api.updateBusiness(b.id, { offers: [...(b.offers ?? []), offer] });
    setMyBusinesses((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
    notificationService.toast('Offer added', offer, 'success');
  };

  return (
    <div className="rise-fade">
      <Header />
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display font-bold text-xl">Business Dashboard</h1>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/business/register')}>
            Add Business
          </Button>
        </div>

        {myBusinesses.length === 0 ? (
          <EmptyState
            icon={<Store size={26} />}
            title="No businesses registered"
            body="Register your fuel stop, workshop, or restaurant so riders can find you on the map."
            action={
              <Button onClick={() => navigate('/business/register')} className="mt-2">
                Register Business
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {myBusinesses.map((b) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-asphalt-700 flex items-center justify-center">
                    <PlaceMarker category={b.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{b.name}</p>
                    <p className="text-xs text-asphalt-400 truncate">{b.address}</p>
                  </div>
                  <Badge variant={b.isOpenNow ? 'gps' : 'neutral'}>{b.isOpenNow ? 'Open' : 'Closed'}</Badge>
                </div>
                {b.offers && b.offers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {b.offers.map((o, i) => (
                      <Badge key={i} variant="ember">
                        {o}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-asphalt-700">
                  <Button size="sm" variant="secondary" onClick={() => toggleOpen(b)}>
                    Mark {b.isOpenNow ? 'Closed' : 'Open'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => addOffer(b)}>
                    Add Offer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
