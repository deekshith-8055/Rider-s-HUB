import type { AppUser } from '../../types';

/**
 * Local-mode identity placeholder.
 *
 * This is NOT demo/fake content — it's the account record used only when
 * Firebase isn't configured at all (see services/api.ts / isDemoMode), so
 * the app has something to attach a locally-created profile to. It starts
 * completely empty: zeroed stats, no bio, no achievements, no communities.
 * All real content (rides, businesses, posts, events, notifications,
 * ride history) starts as empty collections too — see mockStore.ts — and
 * is populated only by real user actions from that point on.
 */
export const CURRENT_USER: AppUser = {
  id: 'current_user',
  name: 'Rider',
  username: 'rider',
  role: 'rider',
  stats: {
    totalRides: 0,
    totalDistanceKm: 0,
    totalRidingMinutes: 0,
    ridersConnected: 0,
    maxSpeedKmh: 0,
  },
  achievements: [],
  joinedCommunities: [],
  createdAt: Date.now(),
};
