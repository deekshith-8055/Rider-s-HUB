import { useEffect, useRef, useState } from 'react';
import { locationService, type LocationSample } from '../services/location/locationService';
import type { LocationState } from '../types';

export interface MyLocationState {
  /** Latest raw GPS sample, or null until the first fix arrives. */
  position: LocationSample | null;
  /** idle | granted | denied | unavailable | revoked */
  permission: LocationState;
  /** True once the very first fix has been received (used to auto-center once). */
  hasFix: boolean;
  /** Re-prompts for permission / re-attempts watchPosition. */
  retry: () => void;
}

/**
 * Subscribes to the device's real GPS position via the browser Geolocation
 * API (navigator.geolocation.watchPosition, enableHighAccuracy: true).
 * Requests permission as soon as it mounts. Never returns a fake/hardcoded
 * location — `position` stays null until a real fix is received.
 */
export function useMyLocation(active = true): MyLocationState {
  const [position, setPosition] = useState<LocationSample | null>(locationService.getLastSample());
  const [permission, setPermission] = useState<LocationState>(locationService.getState());
  const hasFixRef = useRef(false);
  if (position) hasFixRef.current = true;

  useEffect(() => {
    if (!active) return;
    locationService.start();
    const unsubSample = locationService.onRawSample(setPosition);
    const unsubState = locationService.onStateChange(setPermission);
    return () => {
      unsubSample();
      unsubState();
      locationService.stop();
    };
  }, [active]);

  return {
    position,
    permission,
    hasFix: hasFixRef.current,
    retry: () => locationService.retry(),
  };
}
