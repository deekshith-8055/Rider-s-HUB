import { useEffect, useRef, useState } from 'react';
import { Check, Crosshair, Loader2, MapPin, X } from 'lucide-react';
import { searchPlaces, type PlaceSuggestion } from '../../services/geocoding/geocodingService';
import type { NamedPoint } from '../../types';

const inputClass =
  'w-full bg-asphalt-800 border border-asphalt-600 rounded-xl pl-9 pr-9 py-3 text-sm outline-none focus:border-ember-500';

/**
 * Text box with live place suggestions. Typing searches OpenStreetMap; picking
 * a suggestion gives the parent a real coordinate (`onSelect`). Editing the
 * text again clears the selection (`onSelect(null)`) so a stale pin is never kept.
 */
export function PlaceSearchInput({
  value,
  onSelect,
  placeholder,
  near,
  currentLocation,
}: {
  value: NamedPoint | null;
  onSelect: (p: NamedPoint | null) => void;
  placeholder: string;
  near?: { lat: number; lng: number } | null;
  /** When provided, a "Use my current location" option is offered. */
  currentLocation?: (() => Promise<NamedPoint | null>) | null;
}) {
  const [text, setText] = useState(value?.label ?? '');
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the box in sync if the parent sets the value (e.g. "use my location").
  useEffect(() => {
    if (value) setText(value.label);
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => () => { window.clearTimeout(timer.current); abortRef.current?.abort(); }, []);

  const onType = (v: string) => {
    setText(v);
    if (value) onSelect(null);
    setOpen(true);
    setError(null);
    setSearched(false);
    window.clearTimeout(timer.current);
    abortRef.current?.abort();
    if (v.trim().length < 3) {
      setResults([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        setResults(await searchPlaces(v, { near: near ?? undefined, signal: ctrl.signal }));
        setSearched(true);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setError("Couldn't search places. Check your connection and try again.");
        }
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 500);
  };

  const pick = (p: NamedPoint) => {
    setText(p.label);
    setOpen(false);
    setResults([]);
    onSelect(p);
  };

  const useCurrent = async () => {
    if (!currentLocation) return;
    setBusy(true);
    const p = await currentLocation();
    setBusy(false);
    if (p) pick(p);
    else setError("Couldn't get your current location yet.");
  };

  const showList = open && !value && (currentLocation || busy || results.length > 0 || error || searched);

  return (
    <div ref={wrapRef} className="relative">
      <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-asphalt-400" />
      <input
        value={text}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={inputClass}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {busy ? (
          <Loader2 size={15} className="animate-spin text-asphalt-400" />
        ) : value ? (
          <Check size={15} className="text-gps-400" />
        ) : text ? (
          <button type="button" onClick={() => { setText(''); setResults([]); onSelect(null); }} aria-label="Clear">
            <X size={15} className="text-asphalt-400" />
          </button>
        ) : null}
      </div>

      {showList && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-asphalt-800 border border-asphalt-600 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {currentLocation && (
            <button type="button" onClick={useCurrent} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-gps-400 hover:bg-asphalt-700 border-b border-asphalt-700">
              <Crosshair size={15} /> Use my current location
            </button>
          )}
          {results.map((r) => (
            <button key={`${r.lat},${r.lng},${r.address}`} type="button" onClick={() => pick(r)} className="w-full text-left px-3.5 py-2.5 hover:bg-asphalt-700 border-b border-asphalt-700 last:border-0">
              <p className="text-sm font-medium text-asphalt-100 truncate">{r.label}</p>
              <p className="text-xs text-asphalt-400 truncate">{r.address}</p>
            </button>
          ))}
          {error && <p className="px-3.5 py-2.5 text-xs text-signal-red">{error}</p>}
          {!busy && searched && results.length === 0 && !error && (
            <p className="px-3.5 py-2.5 text-xs text-asphalt-400">No places found. Try a nearby town or landmark.</p>
          )}
          {text.trim().length > 0 && text.trim().length < 3 && (
            <p className="px-3.5 py-2.5 text-xs text-asphalt-400">Keep typing…</p>
          )}
        </div>
      )}
    </div>
  );
}
