import type { GeoPoint } from '../../types';

/**
 * Road route between two points using the public OSRM demo server (free, no
 * key, light use only). Falls back to a straight line if it is unreachable,
 * so the map always shows *something* between start and destination.
 */
export interface PlannedRoute {
  path: GeoPoint[];
  distanceKm: number | null;
  durationMin: number | null;
  /** true when this is only a straight line (routing service unavailable). */
  approximate: boolean;
}

const cache = new Map<string, PlannedRoute>();

export async function fetchRoute(a: GeoPoint, b: GeoPoint, signal?: AbortSignal): Promise<PlannedRoute> {
  const key = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = data.routes?.[0];
    if (!r) throw new Error('no route');
    const route: PlannedRoute = {
      path: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      distanceKm: r.distance / 1000,
      durationMin: r.duration / 60,
      approximate: false,
    };
    cache.set(key, route);
    return route;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    return { path: [a, b], distanceKm: null, durationMin: null, approximate: true };
  }
}
