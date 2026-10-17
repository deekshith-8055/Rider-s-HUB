import type {
  AppNotification,
  AppUser,
  Business,
  CommunityPost,
  LiveLocation,
  Ride,
  RideEventLog,
  RideMessage,
  RideParticipant,
  RiderEvent,
  SavedRideSummary,
} from '../../types';
import { CURRENT_USER } from './seed';

const STORAGE_KEY = 'ridershub_local_state_v4';

type Listener<T> = (data: T) => void;

interface StoreShape {
  users: Record<string, AppUser>;
  rides: Record<string, Ride>;
  participants: Record<string, RideParticipant[]>; // rideId -> participants
  locations: Record<string, LiveLocation>; // userId -> location
  messages: Record<string, RideMessage[]>; // rideId -> messages
  events: Record<string, RideEventLog[]>; // rideId -> events
  savedRides: SavedRideSummary[];
  businesses: Business[];
  riderEvents: RiderEvent[];
  posts: CommunityPost[];
  notifications: AppNotification[];
}

/**
 * A completely empty starting state — no seeded riders, rides, businesses,
 * events, posts, notifications, or locations. This is only used when
 * Firebase isn't configured at all (local-only mode). From here, every
 * screen's empty state ("No rides yet", "No businesses registered", etc.)
 * is what a genuinely new account actually sees, and the app fills in only
 * as real actions happen (creating a ride, registering a business, posting,
 * etc.) — see mockDataService.ts.
 */
function freshState(): StoreShape {
  return {
    users: { [CURRENT_USER.id]: CURRENT_USER },
    rides: {},
    participants: {},
    // Deliberately empty: the current user's location must only ever come
    // from a real GPS fix (see hooks/useMyLocation.ts /
    // services/location/locationService.ts) — never a seeded/default entry.
    locations: {},
    messages: {},
    events: {},
    savedRides: [],
    businesses: [],
    riderEvents: [],
    posts: [],
    notifications: [],
  };
}

class MockStore {
  state: StoreShape;
  private locationListeners: Record<string, Listener<LiveLocation[]>[]> = {};
  private messageListeners: Record<string, Listener<RideMessage[]>[]> = {};
  private eventListeners: Record<string, Listener<RideEventLog[]>[]> = {};
  private participantListeners: Record<string, Listener<RideParticipant[]>[]> = {};

  constructor() {
    this.state = this.load() ?? freshState();
  }

  private load(): StoreShape | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoreShape;
      // Defensive guard: never resurrect a cached location for the real
      // current user. Their marker must only ever come from a live GPS fix
      // (see services/location/locationService.ts) — strip anything else
      // that may have been persisted by an older build.
      if (parsed.locations && CURRENT_USER.id in parsed.locations) {
        delete parsed.locations[CURRENT_USER.id];
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Demo mode only. The store used to live in per-tab sessionStorage, so a ride
   * created in one tab/window simply did not exist in another and joining it
   * said "invalid". State is now shared through localStorage; this pulls in
   * rides/participants other tabs created (without touching anything local).
   */
  syncFromStorage() {
    const stored = this.load();
    if (!stored) return;
    this.state.rides = { ...stored.rides, ...this.state.rides };
    Object.entries(stored.participants ?? {}).forEach(([rideId, theirs]) => {
      const mine = this.state.participants[rideId] ?? [];
      const merged = [...mine];
      theirs.forEach((p) => {
        if (!merged.some((m) => m.userId === p.userId)) merged.push(p);
      });
      this.state.participants[rideId] = merged;
    });
  }

  persist() {
    try {
      this.syncFromStorage();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // storage unavailable — session continues in-memory only
    }
  }

  reset() {
    this.state = freshState();
    this.persist();
  }

  // ---- locations ----
  setLocation(loc: LiveLocation) {
    this.state.locations[loc.userId] = loc;
    // notify listeners for any ride this user participates in
    Object.entries(this.state.participants).forEach(([rideId, ps]) => {
      if (ps.some((p) => p.userId === loc.userId)) {
        this.emitLocations(rideId);
      }
    });
  }

  emitLocations(rideId: string) {
    const ids = new Set((this.state.participants[rideId] ?? []).map((p) => p.userId));
    const locs = Object.values(this.state.locations).filter((l) => ids.has(l.userId));
    (this.locationListeners[rideId] ?? []).forEach((cb) => cb(locs));
  }

  onLocations(rideId: string, cb: Listener<LiveLocation[]>) {
    this.locationListeners[rideId] = [...(this.locationListeners[rideId] ?? []), cb];
    this.emitLocations(rideId);
    return () => {
      this.locationListeners[rideId] = (this.locationListeners[rideId] ?? []).filter((l) => l !== cb);
    };
  }

  // ---- messages ----
  addMessage(msg: RideMessage) {
    this.state.messages[msg.rideId] = [...(this.state.messages[msg.rideId] ?? []), msg];
    this.persist();
    (this.messageListeners[msg.rideId] ?? []).forEach((cb) => cb(this.state.messages[msg.rideId]));
  }

  onMessages(rideId: string, cb: Listener<RideMessage[]>) {
    this.messageListeners[rideId] = [...(this.messageListeners[rideId] ?? []), cb];
    cb(this.state.messages[rideId] ?? []);
    return () => {
      this.messageListeners[rideId] = (this.messageListeners[rideId] ?? []).filter((l) => l !== cb);
    };
  }

  // ---- events ----
  addEvent(evt: RideEventLog) {
    this.state.events[evt.rideId] = [...(this.state.events[evt.rideId] ?? []), evt];
    (this.eventListeners[evt.rideId] ?? []).forEach((cb) => cb(this.state.events[evt.rideId]));
  }

  onEvents(rideId: string, cb: Listener<RideEventLog[]>) {
    this.eventListeners[rideId] = [...(this.eventListeners[rideId] ?? []), cb];
    cb(this.state.events[rideId] ?? []);
    return () => {
      this.eventListeners[rideId] = (this.eventListeners[rideId] ?? []).filter((l) => l !== cb);
    };
  }

  // ---- participants ----
  emitParticipants(rideId: string) {
    (this.participantListeners[rideId] ?? []).forEach((cb) => cb(this.state.participants[rideId] ?? []));
  }

  onParticipants(rideId: string, cb: Listener<RideParticipant[]>) {
    this.participantListeners[rideId] = [...(this.participantListeners[rideId] ?? []), cb];
    cb(this.state.participants[rideId] ?? []);
    return () => {
      this.participantListeners[rideId] = (this.participantListeners[rideId] ?? []).filter((l) => l !== cb);
    };
  }
}

export const mockStore = new MockStore();
