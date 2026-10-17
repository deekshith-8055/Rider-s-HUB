import type { GeoPoint, LiveLocation } from '../../types';

export interface MapRiderInput {
  userId: string;
  name: string;
  photoUrl?: string;
  location: LiveLocation;
  isLeader?: boolean;
  isSelf?: boolean;
  status?: string;
}

/** Imperative handle shared by every real map backend (Google Maps, Leaflet). */
export interface MapHandle {
  recenter: () => void;
  /** Frame every rider on the ride (plus me) in one view. */
  fitAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface CenterCandidates {
  myLocation?: GeoPoint | null;
  focus?: GeoPoint | null;
  route?: GeoPoint[];
  destination?: GeoPoint | null;
  meetingPoint?: GeoPoint | null;
  places?: { location: GeoPoint }[];
  riders?: { location: GeoPoint }[];
}

/**
 * Picks the first real, data-driven coordinate available to center the map
 * on. Never falls back to a hardcoded/fake location — if nothing is
 * available yet (no GPS fix, no ride context, no places loaded), returns
 * null and the caller should wait rather than guess.
 */
export function resolveInitialCenter(c: CenterCandidates): GeoPoint | null {
  return (
    c.myLocation ??
    c.focus ??
    c.route?.[0] ??
    c.destination ??
    c.meetingPoint ??
    c.places?.[0]?.location ??
    c.riders?.[0]?.location ??
    null
  );
}
