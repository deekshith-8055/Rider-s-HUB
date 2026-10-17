import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from './AppContext';
import { api } from '../services/api';
import { locationService } from '../services/location/locationService';
import { offlineSyncService } from '../services/offline/offlineSyncService';
import type { Ride } from '../types';

/**
 * App-wide live-location sharing for the rider's current ride.
 *
 * Previously a rider's position was only published while the Live Ride screen
 * was open, so anyone on the Map (or any other) screen was invisible to the
 * rest of the group. This provider finds the ride the rider has joined and
 * keeps publishing their GPS to that ride's live channel on EVERY screen, so
 * everyone in the ride can always see everyone else.
 */
interface RideSharingValue {
  /** The ride I'm part of (in progress first, else the newest upcoming one). */
  activeRide: Ride | null;
  /** Whether I'm currently publishing my location to that ride. */
  sharing: boolean;
  setSharing: (on: boolean) => void;
  /** Re-check which ride I'm in (call after creating/joining/ending a ride). */
  refresh: () => void;
  /** Make this the ride I'm sharing with / seeing on the map (call on create, join, or opening a ride). */
  setCurrentRide: (rideId: string) => void;
}

const Ctx = createContext<RideSharingValue>({ activeRide: null, sharing: false, setSharing: () => {}, refresh: () => {}, setCurrentRide: () => {} });
export const useRideSharing = () => useContext(Ctx);

const SHARE_KEY = 'rh_share_location';
const CURRENT_RIDE_KEY = 'rh_current_ride';

export function RideSharingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const userId = user?.id;
  const userName = user?.name;
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [sharing, setSharingState] = useState(() => localStorage.getItem(SHARE_KEY) !== 'off');

  const setSharing = useCallback((on: boolean) => {
    setSharingState(on);
    localStorage.setItem(SHARE_KEY, on ? 'on' : 'off');
  }, []);

  const refreshRef = useRef<() => void>(() => {});
  const setCurrentRide = useCallback((rideId: string) => {
    localStorage.setItem(CURRENT_RIDE_KEY, rideId);
    refreshRef.current();
  }, []);

  const refresh = useCallback(() => {
    if (!userId) {
      setActiveRide(null);
      return;
    }
    api
      .listMyRides(userId)
      .then((rides) => {
        const open = rides.filter((r) => r.status === 'active' || r.status === 'paused' || r.status === 'scheduled');
        const rank = (r: Ride) => (r.status === 'scheduled' ? 0 : 1);
        open.sort((a, b) => rank(b) - rank(a) || b.createdAt - a.createdAt);
        // Everyone in a group must follow the SAME ride. So prefer the ride this
        // rider most recently created / joined / opened over simply "the newest
        // one" (which could differ between two riders who have old test rides).
        const preferredId = localStorage.getItem(CURRENT_RIDE_KEY);
        const next = open.find((r) => r.id === preferredId) ?? open[0] ?? null;
        setActiveRide((prev) => (next?.id === prev?.id && next?.status === prev?.status ? prev : next));
      })
      .catch(() => undefined); // keep the last known ride on a transient error
  }, [userId]);
  refreshRef.current = refresh;

  // Find my ride on login, then keep it fresh (leader starts/ends it, I join another, tab regains focus).
  useEffect(() => {
    refresh();
    if (!userId) return;
    const id = window.setInterval(refresh, 20000);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);

  // Publish my GPS to the ride's live channel, whichever screen I'm on.
  const rideId = activeRide?.id;
  const pushedOnce = useRef(false);
  useEffect(() => {
    if (!userId || !rideId || !sharing) return;
    pushedOnce.current = false;
    locationService.setActiveMode(true);
    locationService.start();

    offlineSyncService.registerHandler(async (item) => {
      if (item.kind === 'location') await api.pushLocation(item.payload as any);
    });

    const send = (sample: NonNullable<ReturnType<typeof locationService.getLastSample>>, fresh = false) => {
      const payload = { userId, rideId, name: userName, ...sample, ...(fresh ? { timestamp: Date.now() } : {}), isOnline: true };
      if (navigator.onLine) api.pushLocation(payload);
      else offlineSyncService.enqueue('location', payload);
    };

    const unsub = locationService.onSample((sample) => send(sample));

    // A browser only reports a position when it CHANGES. A rider who is stationary
    // (waiting at the meeting point, or a laptop) — or whose first fix arrived before
    // this started — would otherwise never publish anything and stay invisible.
    // So publish the latest fix right away and then every 5 s as a heartbeat.
    const first = locationService.getLastSample();
    if (first) send(first, true);
    const heartbeat = window.setInterval(() => {
      const last = locationService.getLastSample();
      if (last) send(last, true);
    }, 5000);

    return () => {
      window.clearInterval(heartbeat);
      unsub();
      locationService.stop();
    };
  }, [userId, userName, rideId, sharing]);

  const value = useMemo(
    () => ({ activeRide, sharing, setSharing, refresh, setCurrentRide }),
    [activeRide, sharing, setSharing, refresh, setCurrentRide]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
