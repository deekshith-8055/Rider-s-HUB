import type { LocationState } from '../../types';

export interface LocationSample {
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  accuracyM?: number;
  timestamp: number;
}

type LocationListener = (sample: LocationSample) => void;
type StateListener = (state: LocationState) => void;

/**
 * A fix worse than this (in meters) is treated as a low-quality outlier and
 * ignored *if* we already have a meaningfully better fix in hand — this is
 * what "ignore extremely inaccurate GPS fixes until a better fix arrives"
 * means in practice. The very first fix of a session is always accepted
 * (better to show a rough position than none), and everyday accuracy
 * fluctuation (e.g. 15m -> 40m) is not blocked — only a fix that is both
 * absolutely bad (> this ceiling) and drastically worse (> 3x) than the
 * best fix already seen this session is dropped.
 */
const MAX_ACCEPTABLE_ACCURACY_M = 100;
const OUTLIER_MULTIPLIER = 3;

/**
 * Wraps navigator.geolocation with:
 *  - permission-state tracking (idle/granted/denied/unavailable/revoked)
 *  - update throttling: fast interval while "active" (riding), slower while idle
 *  - graceful no-op behaviour when GPS is unavailable (never throws)
 *  - outlier rejection so a single bad fix can't yank the marker away from a
 *    good one
 *
 * Two subscription channels are exposed:
 *  - onSample(): throttled by `minIntervalMs`, meant for network writes
 *    (pushing location to a ride/backend) so we don't spam Firestore.
 *  - onRawSample(): fires on every accepted watchPosition callback,
 *    unthrottled — meant purely for local UI (the "My Location" map
 *    marker), so the blue dot moves smoothly and immediately instead of
 *    updating only every few seconds.
 *
 * Every sample originates from `navigator.geolocation.watchPosition()` and
 * uses only `position.coords.latitude` / `position.coords.longitude` (plus
 * the standard `speed`, `heading`, and `accuracy` fields from that same
 * `coords` object) — there is no random, mock, demo, or hardcoded fallback
 * coordinate anywhere in this file.
 */
function toRad(d: number) {
  return (d * Math.PI) / 180;
}
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Initial compass bearing (0-360, 0 = north) travelling from a to b. */
function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

class LocationService {
  private lastHeading = 0;
  private watchId: number | null = null;
  private listeners: LocationListener[] = [];
  private rawListeners: LocationListener[] = [];
  private stateListeners: StateListener[] = [];
  private state: LocationState = 'idle';
  private lastSample: LocationSample | null = null;
  private bestAccuracyM: number | null = null;
  private minIntervalMs = 3000; // active riding cadence
  private lastEmit = 0;
  private refCount = 0;

  get isSupported() {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  getState() {
    return this.state;
  }

  setActiveMode(active: boolean) {
    this.minIntervalMs = active ? 3000 : 15000;
  }

  private setState(next: LocationState) {
    this.state = next;
    this.stateListeners.forEach((cb) => cb(next));
  }

  onStateChange(cb: StateListener) {
    this.stateListeners.push(cb);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== cb);
    };
  }

  onSample(cb: LocationListener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  onRawSample(cb: LocationListener) {
    this.rawListeners.push(cb);
    return () => {
      this.rawListeners = this.rawListeners.filter((l) => l !== cb);
    };
  }

  getLastSample() {
    return this.lastSample;
  }

  /** Re-requests the browser permission prompt (or re-attempts watchPosition after a prior denial). */
  retry() {
    this.forceStop();
    this.start();
  }

  start() {
    if (!this.isSupported) {
      this.setState('unavailable');
      // eslint-disable-next-line no-console
      console.warn('[Rider\'s Hub GPS] Geolocation is not supported by this browser/device.');
      return;
    }
    this.refCount += 1;
    if (this.watchId !== null) return;

    // eslint-disable-next-line no-console
    console.log('[Rider\'s Hub GPS] Requesting live location via navigator.geolocation.watchPosition()…');

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.setState('granted');
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;

        // --- outlier rejection: ignore a drastically worse fix once a good one is in hand ---
        if (
          this.bestAccuracyM !== null &&
          accuracy > MAX_ACCEPTABLE_ACCURACY_M &&
          accuracy > this.bestAccuracyM * OUTLIER_MULTIPLIER
        ) {
          // eslint-disable-next-line no-console
          console.log(
            `[Rider's Hub GPS] Ignoring low-accuracy fix (±${Math.round(accuracy)}m) — waiting for one at least as good as the best seen so far (±${Math.round(this.bestAccuracyM)}m).`
          );
          return;
        }
        if (this.bestAccuracyM === null || accuracy < this.bestAccuracyM) {
          this.bestAccuracyM = accuracy;
        }

        // --- heading: trust the device compass/GPS heading when it is
        // reported (browsers give null/NaN while stationary); otherwise derive
        // it from the direction of travel; otherwise keep the last known one.
        if (typeof heading === 'number' && Number.isFinite(heading)) {
          this.lastHeading = heading;
        } else if (this.lastSample && distanceM(this.lastSample, { lat: latitude, lng: longitude }) >= 4) {
          this.lastHeading = bearingDeg(this.lastSample, { lat: latitude, lng: longitude });
        }

        const now = Date.now();
        const sample: LocationSample = {
          lat: latitude,
          lng: longitude,
          speedKmh: speed ? Math.max(0, speed * 3.6) : 0,
          headingDeg: this.lastHeading,
          accuracyM: accuracy,
          timestamp: now,
        };
        this.lastSample = sample;

        // eslint-disable-next-line no-console
        console.log(
          `[Rider's Hub GPS] lat=${latitude.toFixed(6)} lng=${longitude.toFixed(6)} accuracy=±${Math.round(accuracy)}m`
        );

        this.rawListeners.forEach((cb) => cb(sample));
        if (now - this.lastEmit >= this.minIntervalMs) {
          this.lastEmit = now;
          this.listeners.forEach((cb) => cb(sample));
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.setState('denied');
          // eslint-disable-next-line no-console
          console.warn('[Rider\'s Hub GPS] Location permission denied by the user/browser.');
        } else {
          this.setState('unavailable');
          // eslint-disable-next-line no-console
          console.warn(`[Rider's Hub GPS] Location unavailable: ${err.message}`);
        }
      },
      // maximumAge: 0 forces a fresh fix on every callback instead of a cached
      // one (which could otherwise be a stale/previous-location reading).
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }

  /** Reference-counted stop: only actually clears the watch once every caller has released it. */
  stop() {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;
    if (this.watchId !== null && this.isSupported) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /** Hard stop regardless of ref count — used by retry(). */
  private forceStop() {
    if (this.watchId !== null && this.isSupported) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.refCount = 0;
    this.bestAccuracyM = null;
  }
}

export const locationService = new LocationService();

