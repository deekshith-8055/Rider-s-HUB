import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fuel, Wrench, UtensilsCrossed, Coffee, Hospital, Zap, CircleDot, Hotel, ShoppingBag, Navigation, Store, Users } from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { BottomSheet } from '../../components/ui/Overlays';
import { Badge } from '../../components/ui/Primitives';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useRideSharing } from '../../context/RideSharingContext';
import { useRideLocations, useRideParticipants } from '../../hooks/useRideChannel';
import { useShareStatus } from '../../hooks/useShareStatus';
import { usePlannedRoute } from '../../hooks/usePlannedRoute';
import type { MapRiderInput } from '../../components/map/types';
import type { Business, BusinessCategory } from '../../types';

const CATEGORIES: { key: BusinessCategory | 'all'; label: string; icon: typeof Fuel }[] = [
  { key: 'all', label: 'All', icon: Navigation },
  { key: 'petrol', label: 'Petrol', icon: Fuel },
  { key: 'ev_charging', label: 'EV Charge', icon: Zap },
  { key: 'mechanic', label: 'Mechanic', icon: Wrench },
  { key: 'tyre_shop', label: 'Tyres', icon: CircleDot },
  { key: 'restaurant', label: 'Food', icon: UtensilsCrossed },
  { key: 'cafe', label: 'Cafe', icon: Coffee },
  { key: 'hotel', label: 'Hotel', icon: Hotel },
  { key: 'accessories', label: 'Gear', icon: ShoppingBag },
  { key: 'hospital', label: 'Hospital', icon: Hospital },
];

export function MapScreen() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filter, setFilter] = useState<BusinessCategory | 'all'>('all');
  const [selected, setSelected] = useState<Business | null>(null);
  const { user } = useApp();
  const navigate = useNavigate();
  const { activeRide, sharing, setSharing } = useRideSharing();

  useEffect(() => {
    api.listBusinesses().then(setBusinesses);
  }, []);

  const share = useShareStatus();
  const locations = useRideLocations(activeRide?.id);
  const participants = useRideParticipants(activeRide?.id);
  const { route: plannedRoute } = usePlannedRoute(activeRide?.origin, activeRide?.destination);

  // Every other rider on my ride who is sharing a location, each with their own pointer.
  const rideRiders: MapRiderInput[] = useMemo(
    () =>
      locations
        .filter((l) => l.userId !== user?.id)
        .map((loc) => {
          const p = participants.find((pp) => pp.userId === loc.userId);
          return {
            userId: loc.userId,
            name: p?.name ?? loc.name ?? loc.userId,
            photoUrl: p?.photoUrl,
            location: loc,
            isLeader: p?.role === 'leader' || loc.userId === activeRide?.leaderId,
            status: p?.status,
          };
        }),
    [locations, participants, user, activeRide]
  );

  const filtered = filter === 'all' ? businesses : businesses.filter((b) => b.category === filter);

  return (
    <div className="relative h-screen">
      <div className="absolute inset-0">
        <MapView
          places={filtered}
          riders={rideRiders}
          route={plannedRoute?.path}
          origin={activeRide?.origin}
          destination={activeRide?.destination}
          meetingPoint={activeRide?.meetingPoint}
          onRiderClick={() => activeRide && navigate(`/ride/live/${activeRide.id}`)}
          onPlaceClick={(id) => setSelected(businesses.find((b) => b.id === id) ?? null)} />
      </div>

      <div className="relative z-30 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border glass ${
                filter === key ? 'border-ember-500 text-ember-400' : 'border-asphalt-600 text-asphalt-300'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {activeRide && (
        <div className="relative z-30 px-4 mt-2">
          <button
            onClick={() => navigate(`/ride/live/${activeRide.id}`)}
            className="glass border border-asphalt-600 rounded-xl px-3.5 py-2 flex items-center gap-2 text-left w-full max-w-sm"
          >
            <Users size={15} className="text-gps-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold truncate">{activeRide.name}</span>
              <span className="block text-[0.65rem] text-asphalt-300">
                {participants.length} joined · {locations.length} sharing live location
              </span>
            </span>
            <Navigation size={14} className="text-asphalt-400" />
          </button>
          <button
            onClick={() => setSharing(!sharing)}
            className={`mt-1.5 text-[0.7rem] font-semibold rounded-full px-3 py-1 border ${
              sharing ? 'bg-gps-500/15 border-gps-500/50 text-gps-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-300'
            }`}
          >
            {sharing ? '● Sharing my location with the ride — tap to stop' : '○ Not sharing — tap to share my location'}
          </button>
          {sharing && (
            <p
              className={`mt-1 text-[0.65rem] leading-snug ${
                share.tone === 'ok' ? 'text-gps-400' : share.tone === 'error' ? 'text-signal-red' : 'text-signal-amber'
              }`}
            >
              {share.text}
            </p>
          )}
          <details className="mt-1.5 glass border border-asphalt-600 rounded-xl px-3 py-2 text-[0.68rem] text-asphalt-300 max-w-sm">
            <summary className="cursor-pointer font-semibold text-asphalt-200">Ride diagnostics</summary>
            <div className="mt-1.5 space-y-0.5 leading-snug">
              <p>Ride: {activeRide.name} · code {activeRide.code}</p>
              <p>You: {user?.name} (id …{user?.id.slice(-6)})</p>
              <p>
                Joined ({participants.length}):{' '}
                {participants.map((p) => `${p.userId === user?.id ? 'You' : p.name} (…${p.userId.slice(-6)})`).join(', ') || '—'}
              </p>
              <p>
                Locations received — realtime: {share.status.rtdbCount ?? 'n/a'}, backup: {share.status.firestoreCount ?? 'n/a'}
              </p>
              {participants.length <= 1 && (
                <p className="text-signal-amber">
                  Only you are on this ride. Your teammate must JOIN with this exact code ({activeRide.code}) using a DIFFERENT
                  account — two browsers logged in as the same account count as one rider.
                </p>
              )}
              {participants.length > 1 && locations.length <= 1 && (
                <p className="text-signal-amber">
                  Your teammate has joined but their location hasn't arrived. On their device check the status line above (GPS
                  permission / permission denied).
                </p>
              )}
              {share.status.rtdbError && <p className="text-signal-red">Realtime DB error: {share.status.rtdbError}</p>}
              {share.status.firestoreError && <p className="text-signal-red">Firestore error: {share.status.firestoreError}</p>}
              <p className="text-asphalt-400">Testing on one computer? Both riders sit at the same GPS spot, so their pointers overlap — zoom in or use two phones.</p>
            </div>
          </details>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {participants.map((p) => {
              const loc = locations.find((l) => l.userId === p.userId);
              const live = !!loc && Date.now() - loc.timestamp < 30000;
              return (
                <span key={p.userId} className="glass border border-asphalt-600 rounded-full px-2.5 py-0.5 text-[0.65rem] flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-gps-400' : loc ? 'bg-signal-amber' : 'bg-asphalt-500'}`} />
                  {p.userId === user?.id ? 'You' : p.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {!activeRide && (
        <div className="relative z-30 px-4 mt-2">
          <p className="glass border border-asphalt-600 rounded-xl px-3.5 py-2 text-xs text-asphalt-300 max-w-sm">
            You're not on a ride yet. Create or join a ride and everyone's live pointers will show here.
          </p>
        </div>
      )}

      {businesses.length === 0 && (
        <div className="absolute left-3 right-3 bottom-24 z-30 glass border border-asphalt-600 rounded-2xl px-4 py-3 flex items-center gap-2.5">
          <Store size={16} className="text-asphalt-400 shrink-0" />
          <p className="text-xs text-asphalt-300">
            No businesses registered near you yet — owners can add one from Business Dashboard.
          </p>
        </div>
      )}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={selected.isOpenNow ? 'gps' : 'neutral'}>{selected.isOpenNow ? 'Open now' : 'Closed'}</Badge>
              {selected.rating && <Badge variant="amber">★ {selected.rating}</Badge>}
            </div>
            <p className="text-sm text-asphalt-300">{selected.address}</p>
            {selected.description && <p className="text-sm text-asphalt-400 mt-2">{selected.description}</p>}
            {selected.offers && selected.offers.length > 0 && (
              <div className="mt-3 bg-ember-500/10 border border-ember-500/30 rounded-xl p-3">
                <p className="text-xs font-semibold text-ember-400">Current offer</p>
                <p className="text-sm text-asphalt-200 mt-0.5">{selected.offers[0]}</p>
              </div>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selected.location.lat},${selected.location.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-2 bg-ember-500 text-white font-semibold rounded-xl py-3 text-sm"
            >
              <Navigation size={15} /> Navigate
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
