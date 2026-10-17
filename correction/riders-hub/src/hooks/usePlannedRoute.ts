import { useEffect, useState } from 'react';
import type { GeoPoint } from '../types';
import { fetchRoute, type PlannedRoute } from '../services/geocoding/routingService';

function far(a: GeoPoint, b: GeoPoint) {
  return Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng) > 0.0005; // ≈50 m
}

/** Road route from `origin` to `destination` (null until both exist and differ). */
export function usePlannedRoute(origin?: GeoPoint | null, destination?: GeoPoint | null) {
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [loading, setLoading] = useState(false);

  const oLat = origin?.lat, oLng = origin?.lng, dLat = destination?.lat, dLng = destination?.lng;

  useEffect(() => {
    if (oLat == null || oLng == null || dLat == null || dLng == null) {
      setRoute(null);
      return;
    }
    const a = { lat: oLat, lng: oLng };
    const b = { lat: dLat, lng: dLng };
    if (!far(a, b)) {
      setRoute(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetchRoute(a, b, ctrl.signal)
      .then(setRoute)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [oLat, oLng, dLat, dLng]);

  return { route, loading };
}
