import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { EventCard } from '../../components/ride/Cards';
import { EmptyState, LoadingState } from '../../components/ui/Feedback';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notifications/notificationService';
import type { RiderEvent } from '../../types';

export function EventsScreen() {
  const { user } = useApp();
  const [events, setEvents] = useState<RiderEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listEvents().then((e) => {
      setEvents(e);
      setLoading(false);
    });
  }, []);

  const join = async (event: RiderEvent) => {
    if (!user) return;
    await api.joinEvent(event.id, user.id);
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, attendeeIds: [...e.attendeeIds, user.id] } : e)));
    notificationService.toast('You\'re going!', event.name, 'success');
  };

  return (
    <div className="rise-fade">
      <Header />
      <div className="px-4 md:px-6">
        <h1 className="font-display font-bold text-xl mb-5">Rider Events</h1>
        {loading ? (
          <LoadingState />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={26} />}
            title="No events yet"
            body="Bike meets, safety workshops, and group rides will show up here once they're created."
          />
        ) : (
          <div className="space-y-3">
            {events.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                joined={user ? e.attendeeIds.includes(user.id) : false}
                onClick={() => join(e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
