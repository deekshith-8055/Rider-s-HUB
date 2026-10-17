import { useState } from 'react';
import { Search, Siren } from 'lucide-react';
import type { RiderRideStatus } from '../../types';
import { Card } from './Primitives';

export function SearchBar({
  placeholder = 'Search riders, rides, events, businesses…',
  onSearch,
}: {
  placeholder?: string;
  onSearch?: (q: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="flex items-center gap-2 bg-asphalt-800 border border-asphalt-600 rounded-xl px-3.5 py-2.5">
      <Search size={17} className="text-asphalt-400 shrink-0" />
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onSearch?.(e.target.value);
        }}
        placeholder={placeholder}
        className="bg-transparent outline-none text-sm text-asphalt-100 placeholder:text-asphalt-400 w-full"
      />
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 flex-1 min-w-[7.5rem]">
      <p className="text-[0.7rem] uppercase tracking-wider text-asphalt-400 font-semibold">{label}</p>
      <p className="font-display font-bold text-2xl text-asphalt-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-gps-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

const STATUS_META: Record<RiderRideStatus, { label: string; emoji: string }> = {
  riding: { label: 'Riding', emoji: '🟢' },
  slow_down: { label: 'Slow down', emoji: '🟡' },
  stopped: { label: 'Stopped', emoji: '🔴' },
  fuel_stop: { label: 'Fuel stop', emoji: '⛽' },
  food_stop: { label: 'Food stop', emoji: '🍴' },
  mechanical_issue: { label: 'Mechanical issue', emoji: '🔧' },
  emergency: { label: 'Emergency', emoji: '🚨' },
  photo_stop: { label: 'Photo stop', emoji: '📸' },
  destination_reached: { label: 'Reached', emoji: '🏁' },
};

export { STATUS_META };

export function StatusSelector({
  current,
  onSelect,
}: {
  current: RiderRideStatus;
  onSelect: (s: RiderRideStatus) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(STATUS_META) as RiderRideStatus[]).map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
            current === s
              ? 'bg-ember-500/15 border-ember-500 text-ember-400'
              : 'bg-asphalt-800 border-asphalt-600 text-asphalt-200 hover:bg-asphalt-700'
          }`}
        >
          <span className="text-lg leading-none">{STATUS_META[s].emoji}</span>
          {STATUS_META[s].label}
        </button>
      ))}
    </div>
  );
}

export function EmergencyButton({ onTrigger, size = 'md' }: { onTrigger: () => void; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 40, md: 52, lg: 68 }[size];
  return (
    <button
      onClick={onTrigger}
      className="relative rounded-full bg-signal-red text-white flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(255,59,92,0.7)] ember-pulse active:scale-95 transition-transform"
      style={{ width: dims, height: dims }}
      aria-label="Emergency"
    >
      <Siren size={dims * 0.46} />
    </button>
  );
}
