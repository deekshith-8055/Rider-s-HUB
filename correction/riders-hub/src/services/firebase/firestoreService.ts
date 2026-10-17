import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';
import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { auth, db, rtdb, COLLECTIONS } from './config';
import { shareDiagnostics } from '../location/shareDiagnostics';
import type { RiderHubDataService } from '../apiTypes';
import { generateId, generateRideCode } from '../../utils/format';
import type { AppUser, LiveLocation, RideParticipant } from '../../types';

/**
 * Production data service backed by Firebase Auth + Firestore.
 * Only instantiated when `isFirebaseConfigured` is true (see services/api.ts).
 * Mirrors the exact interface of the mock service so screens never branch
 * on which backend is active.
 */
export function createFirestoreService(): RiderHubDataService {
  if (!db || !auth) {
    throw new Error('Firebase is not configured — check your .env values.');
  }
  const firestore = db;
  const authInstance = auth;

  const defaultStats = () => ({
    totalRides: 0,
    totalDistanceKm: 0,
    totalRidingMinutes: 0,
    ridersConnected: 0,
    maxSpeedKmh: 0,
  });

  const registeredDisconnects = new Set<string>();

  /** Load the rider's profile, creating it if the Auth account has none yet. */
  const loadOrCreateProfile = async (fbUser: { uid: string; displayName: string | null; photoURL: string | null; email: string | null }) => {
    const ref = doc(firestore, COLLECTIONS.users, fbUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as AppUser;
    const displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'Rider';
    const user: AppUser = {
      id: fbUser.uid,
      name: displayName,
      username: displayName.toLowerCase().replace(/\s+/g, ''),
      photoUrl: fbUser.photoURL || undefined,
      role: 'rider',
      stats: defaultStats(),
      achievements: [],
      joinedCommunities: [],
      createdAt: Date.now(),
    };
    await setDoc(ref, user);
    return user;
  };

  return {
    async getCurrentUser() {
      // onAuthStateChanged fires once Firebase has restored the saved session
      // from local storage — that is what keeps riders logged in across restarts.
      return new Promise((resolve) => {
        const unsub = onAuthStateChanged(authInstance, async (fbUser) => {
          unsub();
          if (!fbUser) return resolve(null);
          try {
            resolve(await loadOrCreateProfile(fbUser));
          } catch (err) {
            // A temporary network/Firestore problem must not sign the rider out.
            // eslint-disable-next-line no-console
            console.warn("[Rider's Hub Auth] Session restored but profile load failed:", err);
            const name = fbUser.displayName || fbUser.email?.split('@')[0] || 'Rider';
            resolve({
              id: fbUser.uid,
              name,
              username: name.toLowerCase().replace(/\s+/g, ''),
              photoUrl: fbUser.photoURL || undefined,
              role: 'rider',
              stats: defaultStats(),
              achievements: [],
              joinedCommunities: [],
              createdAt: Date.now(),
            });
          }
        });
      });
    },

    async signIn(email, password) {
      const cred = await signInWithEmailAndPassword(authInstance, email, password);
      return loadOrCreateProfile(cred.user);
    },

    async signUp(name, email, password) {
      const cred = await createUserWithEmailAndPassword(authInstance, email, password);
      const user: AppUser = {
        id: cred.user.uid,
        name,
        username: name.toLowerCase().replace(/\s+/g, ''),
        role: 'rider',
        stats: defaultStats(),
        achievements: [],
        joinedCommunities: [],
        createdAt: Date.now(),
      };
      await setDoc(doc(firestore, COLLECTIONS.users, cred.user.uid), user);
      return user;
    },

    async signInWithGoogle() {
      const cred = await signInWithPopup(authInstance, new GoogleAuthProvider());
      const ref = doc(firestore, COLLECTIONS.users, cred.user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) return snap.data() as AppUser;
      const user: AppUser = {
        id: cred.user.uid,
        name: cred.user.displayName || 'Rider',
        username: (cred.user.displayName || 'rider').toLowerCase().replace(/\s+/g, ''),
        photoUrl: cred.user.photoURL || undefined,
        role: 'rider',
        stats: defaultStats(),
        achievements: [],
        joinedCommunities: [],
        createdAt: Date.now(),
      };
      await setDoc(ref, user);
      return user;
    },

    async signOut() {
      await fbSignOut(authInstance);
    },

    async updateProfile(userId, patch) {
      const ref = doc(firestore, COLLECTIONS.users, userId);
      await updateDoc(ref, patch as Record<string, unknown>);
      const snap = await getDoc(ref);
      return snap.data() as AppUser;
    },

    async createRide(input) {
      const id = generateId('ride');
      const ride = {
        ...input,
        id,
        code: generateRideCode(),
        status: 'scheduled' as const,
        waypoints: input.waypoints ?? [],
        createdAt: Date.now(),
      };
      await setDoc(doc(firestore, COLLECTIONS.rides, id), ride);

      // The leader must be a real participant record too — not just
      // rides/{id}.leaderId — so they show up in listParticipants(), the
      // "Riders" roster, and are correctly identified/named on every other
      // rider's live map (see LiveRideScreen.tsx's mapRiders + leader lookup).
      let leaderName = 'Ride Leader';
      try {
        const leaderSnap = await getDoc(doc(firestore, COLLECTIONS.users, input.leaderId));
        if (leaderSnap.exists()) leaderName = (leaderSnap.data() as AppUser).name || leaderName;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Rider's Hub Firestore] Could not look up leader's profile name:", err);
      }
      const leaderParticipant: RideParticipant = {
        rideId: id,
        userId: input.leaderId,
        name: leaderName,
        role: 'leader',
        joinedAt: Date.now(),
        status: 'riding',
        isOnline: true,
      };
      await setDoc(doc(firestore, COLLECTIONS.rideParticipants, `${id}_${input.leaderId}`), leaderParticipant);

      return ride;
    },

    async getRideByCode(code) {
      const normalized = code.trim().toUpperCase();
      const q = query(collection(firestore, COLLECTIONS.rides), where('code', '==', normalized));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return snap.docs[0].data() as any;
    },

    async getRide(rideId) {
      const snap = await getDoc(doc(firestore, COLLECTIONS.rides, rideId));
      return snap.exists() ? (snap.data() as any) : null;
    },

    async listMyRides(userId) {
      // Rides I lead...
      const ledSnap = await getDocs(query(collection(firestore, COLLECTIONS.rides), where('leaderId', '==', userId)));
      const rides = new Map<string, any>();
      ledSnap.docs.forEach((d) => rides.set(d.id, d.data()));
      // ...plus rides I have JOINED as a participant.
      const joinedSnap = await getDocs(
        query(collection(firestore, COLLECTIONS.rideParticipants), where('userId', '==', userId))
      );
      const missing = joinedSnap.docs.map((d) => (d.data() as RideParticipant).rideId).filter((id) => !rides.has(id));
      await Promise.all(
        missing.map(async (rideId) => {
          try {
            const s = await getDoc(doc(firestore, COLLECTIONS.rides, rideId));
            if (s.exists()) rides.set(rideId, s.data());
          } catch {
            /* ride no longer readable — skip it */
          }
        })
      );
      return Array.from(rides.values());
    },

    async listPublicRides() {
      const q = query(collection(firestore, COLLECTIONS.rides), where('visibility', '==', 'public'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    async joinRide(rideId, user) {
      // Riders in a shared ride are connected by BOTH identifiers: the
      // participant doc ID is `${rideId}_${uid}` (unique per rider per
      // ride), and each live location update carries both `rideId` and
      // `userId` fields (see pushLocation/subscribeToRideLocations below).
      // That dual key is what lets the live map join "this location" to
      // "this rider" to "this specific ride".
      const participantRef = doc(firestore, COLLECTIONS.rideParticipants, `${rideId}_${user.id}`);
      // Already on this ride (e.g. the leader joining their own ride, or a
      // rider re-scanning): keep their existing record/role instead of
      // overwriting it as a plain participant.
      const existingSnap = await getDoc(participantRef);
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as RideParticipant;
        if (!existing.isOnline) await updateDoc(participantRef, { isOnline: true });
        return { ...existing, isOnline: true };
      }
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
      await setDoc(doc(firestore, COLLECTIONS.rideParticipants, `${rideId}_${user.id}`), participant);
      return participant;
    },

    async leaveRide(rideId, userId) {
      await updateDoc(doc(firestore, COLLECTIONS.rideParticipants, `${rideId}_${userId}`), {
        isOnline: false,
      });
    },

    async removeParticipant(rideId, userId) {
      await updateDoc(doc(firestore, COLLECTIONS.rideParticipants, `${rideId}_${userId}`), {
        isOnline: false,
        status: 'stopped',
      });
    },

    async listParticipants(rideId) {
      const q = query(collection(firestore, COLLECTIONS.rideParticipants), where('rideId', '==', rideId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    subscribeToParticipants(rideId, cb) {
      // Real-time so that when Rider B joins, Rider A's already-open Live
      // Ride screen sees them appear immediately — without this, the
      // roster/marker list only ever reflected whoever had joined at the
      // moment the screen first loaded.
      const q = query(collection(firestore, COLLECTIONS.rideParticipants), where('rideId', '==', rideId));
      return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => d.data() as any)),
        (err) => {
          // eslint-disable-next-line no-console
          console.error(`[Rider's Hub Firestore] Participants listener error for ride ${rideId}:`, err);
        }
      );
    },

    async startRide(rideId) {
      const ref = doc(firestore, COLLECTIONS.rides, rideId);
      await updateDoc(ref, { status: 'active', startedAt: Date.now() });
      return (await getDoc(ref)).data() as any;
    },

    async pauseRide(rideId) {
      const ref = doc(firestore, COLLECTIONS.rides, rideId);
      await updateDoc(ref, { status: 'paused' });
      return (await getDoc(ref)).data() as any;
    },

    async endRide(rideId, summary) {
      const ref = doc(firestore, COLLECTIONS.rides, rideId);
      await updateDoc(ref, { status: 'completed', endedAt: Date.now() });
      const id = generateId('summary');
      const full = { ...summary, id };
      await setDoc(doc(firestore, COLLECTIONS.savedRides, id), full);
      return full;
    },

    async updateRiderStatus(rideId, userId, status) {
      await updateDoc(doc(firestore, COLLECTIONS.rideParticipants, `${rideId}_${userId}`), { status });
    },

    async pushLocation(loc) {
      // Existing Firestore write preserved as-is — this is what still powers
      // the general "nearby riders" aggregate on the Home screen
      // (listNearbyRiders below), completely unrelated to any single ride.
      try {
        await setDoc(doc(firestore, COLLECTIONS.locations, loc.userId), loc);
        shareDiagnostics.report({ lastOkAt: Date.now(), firestoreError: null });
      } catch (err) {
        shareDiagnostics.report({ firestoreError: (err as { code?: string })?.code ?? String(err) });
        // eslint-disable-next-line no-console
        console.error('[Rider\'s Hub Firestore] Failed to write location doc:', err);
      }

      // Realtime Database sync, scoped to the ride ("room") the rider is
      // currently in. Path: rides/{rideId}/riders/{userId}. This is what
      // every other rider viewing the same Ride ID subscribes to below, for
      // true low-latency real-time marker updates.
      if (rtdb && loc.rideId) {
        const riderRef = ref(rtdb, `rides/${loc.rideId}/riders/${loc.userId}`);
        try {
          await set(riderRef, {
            latitude: loc.lat,
            longitude: loc.lng,
            speed: loc.speedKmh,
            heading: loc.headingDeg,
            name: loc.name ?? '',
            lastUpdated: Date.now(),
          });
          shareDiagnostics.report({ lastOkAt: Date.now(), rtdbError: null });
          // eslint-disable-next-line no-console
          console.log(`[Rider's Hub RTDB] Location write OK -> rides/${loc.rideId}/riders/${loc.userId}`);
        } catch (err) {
          shareDiagnostics.report({ rtdbError: (err as { code?: string })?.code ?? String(err) });
          // eslint-disable-next-line no-console
          console.error(`[Rider's Hub RTDB] Location write FAILED for rides/${loc.rideId}/riders/${loc.userId}:`, err);
        }
        // If this rider's connection drops (tab closed, app killed, network
        // lost) Firebase automatically removes their entry, so nobody else
        // in the room keeps seeing a stale/ghost marker.
        const disconnectKey = `${loc.rideId}/${loc.userId}`;
        if (registeredDisconnects.has(disconnectKey)) return;
        registeredDisconnects.add(disconnectKey);
        onDisconnect(riderRef).remove().catch((err) => {
          registeredDisconnects.delete(disconnectKey);
          // eslint-disable-next-line no-console
          console.warn(
            `[Rider's Hub RTDB] Could not register onDisconnect cleanup for rides/${loc.rideId}/riders/${loc.userId} (non-fatal — the entry just won't auto-remove if this device drops offline):`,
            err
          );
        });
      } else if (loc.rideId && !rtdb) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Rider's Hub RTDB] VITE_FIREBASE_DATABASE_URL is not configured — falling back to Firestore-only location sync for this ride."
        );
      }
    },

    subscribeToRideLocations(rideId, cb) {
      // Riders' positions arrive through TWO channels and are merged, newest
      // wins: the Realtime Database room (fast) and the Firestore `locations`
      // docs (backup). If one channel is misconfigured (e.g. its rules aren't
      // published) the other still shows everyone on the map.
      const rtdbRiders = new Map<string, LiveLocation>();
      const fsRiders = new Map<string, LiveLocation>();
      const MAX_AGE_MS = 10 * 60 * 1000; // hide ghosts from riders who left long ago

      const emit = () => {
        const merged = new Map<string, LiveLocation>();
        [rtdbRiders, fsRiders].forEach((src) =>
          src.forEach((loc, userId) => {
            const prev = merged.get(userId);
            if (!prev || loc.timestamp > prev.timestamp) merged.set(userId, loc);
          })
        );
        shareDiagnostics.report({ rtdbCount: rtdbRiders.size, firestoreCount: fsRiders.size });
        const now = Date.now();
        cb(
          Array.from(merged.values())
            .filter((l) => now - l.timestamp < MAX_AGE_MS)
            .map((l) => ({ ...l, isOnline: now - l.timestamp < 15000 }))
        );
      };

      const unsubs: Array<() => void> = [];

      if (rtdb) {
        unsubs.push(
          onValue(
            ref(rtdb, `rides/${rideId}/riders`),
            (snapshot) => {
              const val = snapshot.val() as Record<
                string,
                { latitude: number; longitude: number; speed: number; heading?: number; name?: string; lastUpdated: number }
              > | null;
              rtdbRiders.clear();
              Object.entries(val ?? {}).forEach(([userId, r]) =>
                rtdbRiders.set(userId, {
                  userId,
                  rideId,
                  lat: r.latitude,
                  lng: r.longitude,
                  speedKmh: r.speed,
                  headingDeg: r.heading ?? 0,
                  timestamp: r.lastUpdated,
                  isOnline: true,
                  name: r.name,
                })
              );
              emit();
            },
            (err) => {
              // eslint-disable-next-line no-console
              console.error(`[Rider's Hub RTDB] Listener error on rides/${rideId}/riders:`, err);
            }
          )
        );
      }

      unsubs.push(
        onSnapshot(
          query(collection(firestore, COLLECTIONS.locations), where('rideId', '==', rideId)),
          (snap) => {
            fsRiders.clear();
            snap.docs.forEach((d) => {
              const l = d.data() as LiveLocation;
              if (typeof l.lat === 'number' && typeof l.lng === 'number') fsRiders.set(l.userId ?? d.id, { ...l, userId: l.userId ?? d.id });
            });
            emit();
          },
          (err) => {
            // eslint-disable-next-line no-console
            console.error(`[Rider's Hub Firestore] Location listener error for ride ${rideId}:`, err);
          }
        )
      );

      // Ride-room entries age out without a new snapshot; re-evaluate "live/stale" periodically.
      const tick = window.setInterval(emit, 5000);
      return () => {
        window.clearInterval(tick);
        unsubs.forEach((u) => u());
      };
    },

    async sendMessage(msg) {
      const id = generateId('msg');
      const full = { ...msg, id, createdAt: Date.now() };
      await setDoc(doc(firestore, COLLECTIONS.rideMessages, id), full);
      return full;
    },

    subscribeToMessages(rideId, cb) {
      const q = query(
        collection(firestore, COLLECTIONS.rideMessages),
        where('rideId', '==', rideId),
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as any)));
    },

    async logEvent(evt) {
      const id = generateId('evt');
      await setDoc(doc(firestore, COLLECTIONS.rideEvents, id), { ...evt, id, createdAt: Date.now() });
    },

    subscribeToEvents(rideId, cb) {
      const q = query(
        collection(firestore, COLLECTIONS.rideEvents),
        where('rideId', '==', rideId),
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as any)));
    },

    async listSavedRides(userId) {
      const q = query(collection(firestore, COLLECTIONS.savedRides), where('userId', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    async listBusinesses(category) {
      const col = collection(firestore, COLLECTIONS.businesses);
      const q = category ? query(col, where('category', '==', category)) : col;
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    async registerBusiness(input) {
      const id = generateId('biz');
      const full = { ...input, id };
      await setDoc(doc(firestore, COLLECTIONS.businesses, id), full);
      return full;
    },

    async updateBusiness(businessId, patch) {
      const ref = doc(firestore, COLLECTIONS.businesses, businessId);
      await updateDoc(ref, patch as Record<string, unknown>);
      return (await getDoc(ref)).data() as any;
    },

    async listEvents() {
      const snap = await getDocs(collection(firestore, COLLECTIONS.events));
      return snap.docs.map((d) => d.data() as any);
    },

    async joinEvent(eventId, userId) {
      const ref = doc(firestore, COLLECTIONS.events, eventId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const attendeeIds = Array.from(new Set([...(data.attendeeIds ?? []), userId]));
      await updateDoc(ref, { attendeeIds });
    },

    async listCommunityPosts() {
      const q = query(collection(firestore, COLLECTIONS.posts), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    async createPost(input) {
      const id = generateId('post');
      const full = { ...input, id, createdAt: Date.now(), likeCount: 0, commentCount: 0 };
      await setDoc(doc(firestore, COLLECTIONS.posts, id), full);
      return full;
    },

    async listNotifications(userId) {
      const q = query(collection(firestore, COLLECTIONS.notifications), where('userId', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as any);
    },

    async markNotificationRead(notificationId) {
      await updateDoc(doc(firestore, COLLECTIONS.notifications, notificationId), { read: true });
    },

    async listNearbyRiders() {
      const snap = await getDocs(collection(firestore, COLLECTIONS.locations));
      return snap.docs.map((d) => d.data() as any);
    },
  };

  // NOTE: serverTimestamp() is available for fields that should use Firestore's
  // server clock instead of the client clock (e.g. message ordering under
  // clock skew) — swap Date.now() for serverTimestamp() per-field as needed.
  void serverTimestamp;
}
