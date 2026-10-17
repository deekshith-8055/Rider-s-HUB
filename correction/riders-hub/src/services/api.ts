import { isFirebaseConfigured } from './firebase/config';
import { createMockService } from './mock/mockDataService';
import { createFirestoreService } from './firebase/firestoreService';
import type { RiderHubDataService } from './apiTypes';

/**
 * Rider's Hub runs in one of two modes:
 *  - DEMO MODE (default): no Firebase keys configured -> mock service with
 *    realistic in-memory/session data and a live rider simulation, so the
 *    product looks and feels complete out of the box.
 *  - PRODUCTION MODE: real Firebase keys present in .env -> Firestore-backed
 *    service (see services/firebase/firestoreService.ts).
 *
 * Every screen/hook imports `api` from this file and never touches a
 * concrete backend directly.
 */
export const isDemoMode = !isFirebaseConfigured;

// eslint-disable-next-line no-console
console.log(
  isDemoMode
    ? "[Rider's Hub] Running in DEMO MODE — using mock data (no Firebase keys configured). The current user's map marker still only ever comes from real device GPS."
    : "[Rider's Hub] Running in PRODUCTION MODE — connected to Firebase."
);

export const api: RiderHubDataService = isFirebaseConfigured
  ? createFirestoreService()
  : createMockService();
