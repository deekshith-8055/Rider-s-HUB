import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, onValue, off, remove } from 'firebase/database';
import { auth, db, rtdb, isRealtimeDbConfigured, COLLECTIONS } from './config';
import { api, isDemoMode } from '../api';

export interface DiagnosticResult {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * End-to-end backend diagnostic. Verifies, in order:
 *  1. Firebase Auth is connected and returns a UID
 *  2. Firestore is reachable (reads the signed-in user's own profile doc)
 *  3. Realtime Database socket is connected (`.info/connected`)
 *  4. A real ride can be created in Firestore
 *  5. That ride can be looked up again by its code (the exact Rider A / Rider
 *     B handoff this app depends on)
 *  6. A location can be written to Realtime Database under
 *     rides/{rideId}/riders/{uid}
 *  7. A realtime listener on that same path actually receives the write
 *
 * The temporary ride/participant/location created for steps 4–7 are cleaned
 * up automatically at the end. Every step is also logged to the console as
 * it runs, so this can be read either from the returned array or directly
 * from devtools.
 */
export async function runBackendDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const log = (r: DiagnosticResult) => {
    results.push(r);
    // eslint-disable-next-line no-console
    console.log(`[Rider's Hub Diagnostics] ${r.ok ? '✅' : '❌'} ${r.label} — ${r.detail}`);
  };

  // eslint-disable-next-line no-console
  console.log(
    `[Rider's Hub Diagnostics] Starting… running in ${isDemoMode ? 'DEMO MODE (no Firebase)' : 'PRODUCTION MODE (Firebase)'}.`
  );

  if (isDemoMode) {
    log({
      label: 'Mode check',
      ok: false,
      detail:
        'App is running in DEMO MODE — no Firebase project is configured, so none of the Firebase checks below can run. Set VITE_FIREBASE_* env vars to test the real backend.',
    });
    return results;
  }

  // 1. Auth
  const uid = auth?.currentUser?.uid ?? null;
  log({
    label: 'Firebase Auth connected',
    ok: Boolean(uid),
    detail: uid ? `Signed in as UID ${uid}` : 'No authenticated user — sign in first.',
  });
  if (!uid || !db) {
    log({ label: 'Firestore connected', ok: false, detail: 'Skipped — not signed in.' });
    return results;
  }

  // 2. Firestore
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
    log({
      label: 'Firestore connected',
      ok: true,
      detail: snap.exists() ? `Read users/${uid} successfully.` : `Connected, but users/${uid} doc doesn't exist yet.`,
    });
  } catch (err) {
    log({ label: 'Firestore connected', ok: false, detail: `Read failed: ${(err as Error).message}` });
  }

  // 3. Realtime Database connection
  if (!isRealtimeDbConfigured || !rtdb) {
    log({
      label: 'Realtime Database connected',
      ok: false,
      detail: 'VITE_FIREBASE_DATABASE_URL is not set — live location will use the Firestore fallback instead.',
    });
  } else {
    const connected = await new Promise<boolean>((resolve) => {
      const infoRef = ref(rtdb!, '.info/connected');
      const timeout = setTimeout(() => resolve(false), 5000);
      onValue(
        infoRef,
        (snap) => {
          clearTimeout(timeout);
          off(infoRef);
          resolve(Boolean(snap.val()));
        },
        { onlyOnce: true }
      );
    });
    log({
      label: 'Realtime Database connected',
      ok: connected,
      detail: connected ? 'Socket is live.' : 'Could not confirm a live connection within 5s.',
    });
  }

  // 4–7: full ride-creation + code-lookup + RTDB write/listen round trip,
  // using a clearly-labeled throwaway ride that gets cleaned up afterward.
  let testRideId: string | null = null;
  try {
    const currentUser = await api.getCurrentUser();
    if (!currentUser) throw new Error('No current user profile to attach the test ride to.');

    const ride = await api.createRide({
      name: '__diagnostics_test_ride__',
      leaderId: currentUser.id,
      origin: { lat: 0, lng: 0, label: 'Diagnostics' },
      destination: { lat: 0, lng: 0, label: 'Diagnostics' },
      date: new Date().toISOString().slice(0, 10),
      startTime: '00:00',
      maxRiders: 2,
      visibility: 'public',
    });
    testRideId = ride.id;
    log({ label: 'Ride creation successful', ok: true, detail: `Created ride ${ride.id} with code ${ride.code}.` });

    const found = await api.getRideByCode(ride.code);
    log({
      label: 'Ride lookup by code successful',
      ok: Boolean(found && found.id === ride.id),
      detail: found ? `getRideByCode('${ride.code}') returned the same ride.` : `getRideByCode('${ride.code}') returned nothing.`,
    });

    if (rtdb) {
      const receivedPromise = new Promise<boolean>((resolve) => {
        const ridersRef = ref(rtdb!, `rides/${ride.id}/riders`);
        const timeout = setTimeout(() => {
          off(ridersRef);
          resolve(false);
        }, 6000);
        onValue(ridersRef, (snap) => {
          const val = snap.val();
          if (val && val[currentUser.id]) {
            clearTimeout(timeout);
            off(ridersRef);
            resolve(true);
          }
        });
      });

      try {
        await api.pushLocation({
          userId: currentUser.id,
          rideId: ride.id,
          lat: 0,
          lng: 0,
          speedKmh: 0,
          headingDeg: 0,
          timestamp: Date.now(),
          isOnline: true,
          name: currentUser.name,
        });
        log({ label: 'Realtime location write successful', ok: true, detail: `Wrote to rides/${ride.id}/riders/${currentUser.id}.` });
      } catch (err) {
        log({ label: 'Realtime location write successful', ok: false, detail: (err as Error).message });
      }

      const received = await receivedPromise;
      log({
        label: 'Realtime location listener receiving data',
        ok: received,
        detail: received
          ? `Listener on rides/${ride.id}/riders received the write in real time.`
          : 'Listener did not receive the write within 6s — check database.rules.json is deployed.',
      });
    } else {
      log({ label: 'Realtime location write successful', ok: false, detail: 'Skipped — Realtime Database not configured.' });
      log({ label: 'Realtime location listener receiving data', ok: false, detail: 'Skipped — Realtime Database not configured.' });
    }
  } catch (err) {
    log({ label: 'Ride creation successful', ok: false, detail: (err as Error).message });
  } finally {
    // Clean up the throwaway test ride so it doesn't clutter real data.
    if (testRideId && db) {
      try {
        await deleteDoc(doc(db, COLLECTIONS.rides, testRideId));
        await deleteDoc(doc(db, COLLECTIONS.rideParticipants, `${testRideId}_${auth?.currentUser?.uid}`));
        if (rtdb) await remove(ref(rtdb, `rides/${testRideId}`));
      } catch {
        /* best-effort cleanup */
      }
    }
  }

  const passCount = results.filter((r) => r.ok).length;
  // eslint-disable-next-line no-console
  console.log(`[Rider's Hub Diagnostics] Finished: ${passCount}/${results.length} checks passed.`);
  return results;
}
