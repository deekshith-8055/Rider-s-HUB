import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, ref, onValue, type Database } from 'firebase/database';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
};

/** True only when every required Firebase env var has a real value. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

/**
 * True only when a Realtime Database URL is also configured. This is
 * intentionally separate from `isFirebaseConfigured` — Auth/Firestore keep
 * working exactly as before even if a project hasn't set up Realtime
 * Database yet; the ride-room live-location sync (rides/{rideId}/riders)
 * simply falls back to the existing Firestore-based location sync in that
 * case (see firestoreService.ts).
 */
export const isRealtimeDbConfigured = Boolean(isFirebaseConfigured && firebaseConfig.databaseURL);

// ---------------------------------------------------------------------------
// Clear, unambiguous startup logging (never silently fall back to demo mode
// without saying so). Logs exactly which of the 7 expected env vars were
// found, so a misconfigured .env is obvious immediately in the console.
// ---------------------------------------------------------------------------
const envVarStatus = {
  VITE_FIREBASE_API_KEY: Boolean(firebaseConfig.apiKey),
  VITE_FIREBASE_AUTH_DOMAIN: Boolean(firebaseConfig.authDomain),
  VITE_FIREBASE_PROJECT_ID: Boolean(firebaseConfig.projectId),
  VITE_FIREBASE_STORAGE_BUCKET: Boolean(firebaseConfig.storageBucket),
  VITE_FIREBASE_MESSAGING_SENDER_ID: Boolean(firebaseConfig.messagingSenderId),
  VITE_FIREBASE_APP_ID: Boolean(firebaseConfig.appId),
  VITE_FIREBASE_DATABASE_URL: Boolean(firebaseConfig.databaseURL),
};

if (isFirebaseConfigured) {
  // eslint-disable-next-line no-console
  console.log("[Rider's Hub] Firebase env vars detected — initializing PRODUCTION mode.", envVarStatus);
} else {
  // eslint-disable-next-line no-console
  console.warn(
    "[Rider's Hub] Firebase is NOT fully configured (need at least API key, project ID, and app ID) — falling back to DEMO MODE with local mock data. Env var status:",
    envVarStatus
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rtdb: Database | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // eslint-disable-next-line no-console
  console.log('[Rider\'s Hub Firebase] Auth + Firestore initialized for project:', firebaseConfig.projectId);

  // Explicit local persistence so a signed-in rider stays signed in across
  // browser restarts / app reopens (Firebase's default for web, made
  // explicit here so "stay logged in" is guaranteed rather than assumed).
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[Rider's Hub Auth] Local session persistence enabled — riders stay logged in across app reopens.");
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[Rider's Hub Auth] Could not set local auth persistence:", err);
    });

  if (isRealtimeDbConfigured) {
    rtdb = getDatabase(app, firebaseConfig.databaseURL);
    // `.info/connected` is a special Firebase-reserved path that always
    // works regardless of custom security rules — a reliable, low-noise way
    // to confirm the Realtime Database socket is actually live.
    onValue(ref(rtdb, '.info/connected'), (snap) => {
      // eslint-disable-next-line no-console
      console.log(snap.val() ? "[Rider's Hub RTDB] Connected." : "[Rider's Hub RTDB] Disconnected — reconnecting…");
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[Rider's Hub RTDB] VITE_FIREBASE_DATABASE_URL is not set — live ride locations will use the Firestore fallback instead of Realtime Database."
    );
  }
} else {
  // Intentionally otherwise silent at import time beyond the warning above —
  // App.tsx surfaces a demo-mode banner too. This keeps the module safe to
  // import even with a blank .env.
}

export { app, auth, db, rtdb };

/** Firestore collection name constants — keep all string literals here. */
export const COLLECTIONS = {
  users: 'users',
  rides: 'rides',
  rideParticipants: 'rideParticipants',
  locations: 'locations',
  rideMessages: 'rideMessages',
  rideEvents: 'rideEvents',
  businesses: 'businesses',
  events: 'events',
  communities: 'communities',
  posts: 'posts',
  notifications: 'notifications',
  achievements: 'achievements',
  savedRides: 'savedRides',
  offlineQueue: 'offlineQueue',
  reports: 'reports',
} as const;
