import type { NamedPoint } from '../../types';

/**
 * Place search ("geocoding") backed by OpenStreetMap's free Nominatim service.
 * No API key needed. Nominatim's usage policy allows light interactive use
 * (about 1 request/second), so callers must debounce — see PlaceSearchInput.
 */
const BASE = 'https://nominatim.openstreetmap.org';

export interface PlaceSuggestion extends NamedPoint {
  /** Full address line shown under the name in the suggestion list. */
  address: string;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

function shortLabel(r: NominatimResult): string {
  const first = r.name?.trim() || r.display_name.split(',')[0]?.trim();
  return first || r.display_name;
}

export async function searchPlaces(
  query: string,
  opts: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {}
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '0' });
  if (opts.near) {
    // Prefer (but don't force) results around the rider's current area (~±1.5°).
    const d = 1.5;
    params.set('viewbox', `${opts.near.lng - d},${opts.near.lat + d},${opts.near.lng + d},${opts.near.lat - d}`);
    params.set('bounded', '0');
  }
  const res = await fetch(`${BASE}/search?${params}`, { signal: opts.signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    label: shortLabel(r),
    address: r.display_name,
  }));
}

/** Turns coordinates into a readable place name ("Hanamkonda, Warangal"). */
export async function reversePlace(lat: number, lng: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '16' });
    const res = await fetch(`${BASE}/reverse?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string; name?: string };
    if (!data.display_name) return null;
    return data.display_name.split(',').slice(0, 2).join(',').trim();
  } catch {
    return null;
  }
}
