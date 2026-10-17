import type { RiderHubDataService } from '../apiTypes';
import { mockStore } from './mockStore';
import { CURRENT_USER } from './seed';
import { generateId, generateRideCode } from '../../utils/format';
import type { AppUser, Ride, RideParticipant } from '../../types';

// Demo-mode accounts. Stored in localStorage (not sessionStorage) so a rider
// stays signed in after closing and reopening the browser/app. Passwords are
// SHA-256 hashed — demo mode only; real accounts use Firebase Auth.
const LOGGED_IN_KEY = 'ridershub_demo_logged_in';
const ACCOUNTS_KEY = 'ridershub_demo_accounts';

type DemoAccounts = Record<string, { name: string; passwordHash: string }>;

function loadAccounts(): DemoAccounts {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '{}') as DemoAccounts;
  } catch {
    return {};
  }
}
function saveAccounts(a: DemoAccounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}
async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function authError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function createMockService(): RiderHubDataService {
  return {
    async getCurrentUser() {
      if (!localStorage.getItem(LOGGED_IN_KEY)) return delay(null);
      return delay(mockStore.state.users[CURRENT_USER.id]);
    },

    async signIn(email, password) {
      const key = email.trim().toLowerCase();
      if (!key) throw authError('auth/invalid-email');
      if (!password) throw authError('auth/missing-password');
      const account = loadAccounts()[key];
      if (!account) throw authError('auth/user-not-found');
      if (account.passwordHash !== (await hash(password))) throw authError('auth/invalid-credential');
      const user = { ...mockStore.state.users[CURRENT_USER.id], name: account.name };
      mockStore.state.users[CURRENT_USER.id] = user;
      localStorage.setItem(LOGGED_IN_KEY, key);
      return delay(user);
    },

    async signUp(name, email, password) {
      const key = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(key)) throw authError('auth/invalid-email');
      if (password.length < 6) throw authError('auth/weak-password');
      const accounts = loadAccounts();
      if (accounts[key]) throw authError('auth/email-already-in-use');
      accounts[key] = { name: name.trim() || 'Rider', passwordHash: await hash(password) };
      saveAccounts(accounts);
      const user = { ...mockStore.state.users[CURRENT_USER.id], name: accounts[key].name };
      mockStore.state.users[CURRENT_USER.id] = user;
      mockStore.persist();
      localStorage.setItem(LOGGED_IN_KEY, key);
      return delay(user);
    },

    async signInWithGoogle() {
      localStorage.setItem(LOGGED_IN_KEY, 'google-demo');
      return delay(mockStore.state.users[CURRENT_USER.id]);
    },

    async signOut() {
      localStorage.removeItem(LOGGED_IN_KEY);
      return delay(undefined);
    },

    async updateProfile(userId, patch) {
      const updated = { ...mockStore.state.users[userId], ...patch };
      mockStore.state.users[userId] = updated;
      mockStore.persist();
      return delay(updated);
    },

    async createRide(input) {
      const id = generateId('ride');
      const ride: Ride = {
        ...input,
        id,
        code: generateRideCode(),
        status: 'scheduled',
        waypoints: input.waypoints ?? [],
        createdAt: Date.now(),
      };
      mockStore.state.rides[id] = ride;
      mockStore.state.participants[id] = [
        {
          rideId: id,
          userId: input.leaderId,
          name: mockStore.state.users[input.leaderId]?.name ?? 'You',
          role: 'leader',
          joinedAt: Date.now(),
          status: 'riding',
          isOnline: true,
        },
      ];
      mockStore.persist();
      mockStore.emitParticipants(id);
      return delay(ride);
    },

    async getRideByCode(code) {
      mockStore.syncFromStorage();
      const normalized = code.trim().toUpperCase();
      const ride = Object.values(mockStore.state.rides).find((r) => r.code.trim().toUpperCase() === normalized);
      return delay(ride ?? null);
    },

    async getRide(rideId) {
      mockStore.syncFromStorage();
      return delay(mockStore.state.rides[rideId] ?? null);
    },

    async listMyRides(userId) {
      const rides = Object.values(mockStore.state.rides).filter(
        (r) =>
          r.leaderId === userId ||
          (mockStore.state.participants[r.id] ?? []).some((p) => p.userId === userId)
      );
      return delay(rides);
    },

    async listPublicRides() {
      return delay(Object.values(mockStore.state.rides).filter((r) => r.visibility === 'public'));
    },

    async joinRide(rideId, user) {
      const participant: RideParticipant = {
        rideId,
        userId: user.id,
        name: user.name,
        photoUrl: user.photoUrl,
        role: 'participant',
        joinedAt: Date.now(),
        status: 'riding',
        isOnline: true,
      };
      const existing = mockStore.state.participants[rideId] ?? [];
      if (!existing.some((p) => p.userId === user.id)) {
        mockStore.state.participants[rideId] = [...existing, participant];
      }
      mockStore.addEvent({
        id: generateId('evt'),
        rideId,
        type: 'rider_joined',
        actorId: user.id,
        actorName: user.name,
        createdAt: Date.now(),
      });
      mockStore.persist();
      mockStore.emitParticipants(rideId);
      return delay(participant);
    },

    async leaveRide(rideId, userId) {
      mockStore.state.participants[rideId] = (mockStore.state.participants[rideId] ?? []).map((p) =>
        p.userId === userId ? { ...p, isOnline: false } : p
      );
      mockStore.persist();
      mockStore.emitParticipants(rideId);
      return delay(undefined);
    },

    async removeParticipant(rideId, userId, actorId) {
      const actor = mockStore.state.users[actorId];
      mockStore.state.participants[rideId] = (mockStore.state.participants[rideId] ?? []).filter(
        (p) => p.userId !== userId
      );
      mockStore.addEvent({
        id: generateId('evt'),
        rideId,
        type: 'rider_removed',
        actorId,
        actorName: actor?.name ?? 'Leader',
        detail: userId,
        createdAt: Date.now(),
      });
      mockStore.persist();
      mockStore.emitParticipants(rideId);
      return delay(undefined);
    },

    async listParticipants(rideId) {
      return delay(mockStore.state.participants[rideId] ?? []);
    },

    subscribeToParticipants(rideId, cb) {
      return mockStore.onParticipants(rideId, cb);
    },

    async startRide(rideId) {
      const ride = { ...mockStore.state.rides[rideId], status: 'active' as const, startedAt: Date.now() };
      mockStore.state.rides[rideId] = ride;
      mockStore.persist();
      return delay(ride);
    },

    async pauseRide(rideId) {
      const ride = { ...mockStore.state.rides[rideId], status: 'paused' as const };
      mockStore.state.rides[rideId] = ride;
      mockStore.persist();
      return delay(ride);
    },

    async endRide(rideId, summary) {
      const ride = { ...mockStore.state.rides[rideId], status: 'completed' as const, endedAt: Date.now() };
      mockStore.state.rides[rideId] = ride;
      const id = generateId('summary');
      const full = { ...summary, id };
      mockStore.state.savedRides = [full, ...mockStore.state.savedRides];
      // bump rider stats
      const user = mockStore.state.users[CURRENT_USER.id];
      if (user) {
        user.stats = {
          ...user.stats,
          totalRides: user.stats.totalRides + 1,
          totalDistanceKm: Math.round((user.stats.totalDistanceKm + summary.distanceKm) * 10) / 10,
          totalRidingMinutes: user.stats.totalRidingMinutes + summary.durationMinutes,
          maxSpeedKmh: Math.max(user.stats.maxSpeedKmh, summary.maxSpeedKmh),
        };
      }
      mockStore.persist();
      return delay(full);
    },

    async updateRiderStatus(rideId, userId, status) {
      mockStore.state.participants[rideId] = (mockStore.state.participants[rideId] ?? []).map((p) =>
        p.userId === userId ? { ...p, status } : p
      );
      mockStore.emitParticipants(rideId);
      const user = mockStore.state.users[userId];
      mockStore.addEvent({
        id: generateId('evt'),
        rideId,
        type: 'status_update',
        actorId: userId,
        actorName: user?.name ?? 'Rider',
        detail: status,
        createdAt: Date.now(),
      });
      return delay(undefined);
    },

    async pushLocation(loc) {
      mockStore.setLocation(loc);
      return delay(undefined, 40);
    },

    subscribeToRideLocations(rideId, cb) {
      return mockStore.onLocations(rideId, cb);
    },

    async sendMessage(msg) {
      const full = { ...msg, id: generateId('msg'), createdAt: Date.now() };
      mockStore.addMessage(full);
      return delay(full, 120);
    },

    subscribeToMessages(rideId, cb) {
      return mockStore.onMessages(rideId, cb);
    },

    async logEvent(evt) {
      mockStore.addEvent({ ...evt, id: generateId('evt'), createdAt: Date.now() });
      return delay(undefined, 60);
    },

    subscribeToEvents(rideId, cb) {
      return mockStore.onEvents(rideId, cb);
    },

    async listSavedRides() {
      return delay(mockStore.state.savedRides);
    },

    async listBusinesses(category) {
      const all = mockStore.state.businesses;
      return delay(category ? all.filter((b) => b.category === category) : all);
    },

    async registerBusiness(input) {
      const business = { ...input, id: generateId('biz') };
      mockStore.state.businesses = [business, ...mockStore.state.businesses];
      mockStore.persist();
      return delay(business);
    },

    async updateBusiness(businessId, patch) {
      mockStore.state.businesses = mockStore.state.businesses.map((b) =>
        b.id === businessId ? { ...b, ...patch } : b
      );
      mockStore.persist();
      return delay(mockStore.state.businesses.find((b) => b.id === businessId)!);
    },

    async listEvents() {
      return delay(mockStore.state.riderEvents);
    },

    async joinEvent(eventId, userId) {
      mockStore.state.riderEvents = mockStore.state.riderEvents.map((e) =>
        e.id === eventId && !e.attendeeIds.includes(userId)
          ? { ...e, attendeeIds: [...e.attendeeIds, userId] }
          : e
      );
      mockStore.persist();
      return delay(undefined);
    },

    async listCommunityPosts() {
      return delay([...mockStore.state.posts].sort((a, b) => b.createdAt - a.createdAt));
    },

    async createPost(input) {
      const post = { ...input, id: generateId('post'), createdAt: Date.now(), likeCount: 0, commentCount: 0 };
      mockStore.state.posts = [post, ...mockStore.state.posts];
      mockStore.persist();
      return delay(post);
    },

    async listNotifications(userId) {
      return delay(mockStore.state.notifications.filter((n) => n.userId === userId));
    },

    async markNotificationRead(notificationId) {
      mockStore.state.notifications = mockStore.state.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      return delay(undefined);
    },

    async listNearbyRiders() {
      return delay(Object.values(mockStore.state.locations).filter((l) => l.userId !== CURRENT_USER.id));
    },
  };
}

export type { AppUser };
