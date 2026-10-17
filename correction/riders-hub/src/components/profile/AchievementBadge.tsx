interface BadgeMeta {
  id: string;
  label: string;
  color: string;
}

export const ACHIEVEMENTS: BadgeMeta[] = [
  { id: 'first_ride', label: 'First Ride', color: '#21e6c1' },
  { id: '100km', label: '100 KM Rider', color: '#ff6a3d' },
  { id: '500km', label: '500 KM Rider', color: '#ff4d1c' },
  { id: '1000km', label: '1000 KM Rider', color: '#ffb020' },
  { id: 'night_rider', label: 'Night Rider', color: '#7c8494' },
  { id: 'long_distance', label: 'Long Distance', color: '#35e08a' },
];

export function AchievementBadge({ id, label, color, locked }: { id: string; label: string; color: string; locked?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 w-20 shrink-0">
      <svg width="52" height="58" viewBox="0 0 52 58" className={locked ? 'opacity-30 grayscale' : ''}>
        <path
          d="M26 2 L48 13 V33 C48 45 38 53 26 56 C14 53 4 45 4 33 V13 Z"
          fill={locked ? '#2a2f3a' : color}
          opacity={locked ? 1 : 0.18}
          stroke={locked ? '#3a404d' : color}
          strokeWidth="1.5"
        />
        <circle cx="26" cy="24" r="10" fill="none" stroke={locked ? '#565e6e' : color} strokeWidth="2" />
        <path d={ICON_PATHS[id] ?? ICON_PATHS.default} fill={locked ? '#565e6e' : color} transform="translate(16,14)" />
      </svg>
      <p className="text-[0.65rem] text-center leading-tight text-asphalt-300">{label}</p>
    </div>
  );
}

const ICON_PATHS: Record<string, string> = {
  first_ride: 'M10 0 L13 6 L20 7 L15 12 L16 19 L10 15.5 L4 19 L5 12 L0 7 L7 6 Z',
  '100km': 'M10 0 L20 20 H0 Z',
  '500km': 'M0 10 L10 0 L20 10 L10 20 Z',
  '1000km': 'M2 18 L2 8 L6 8 L6 18 M8 18 L8 4 L12 4 L12 18 M14 18 L14 11 L18 11 L18 18',
  night_rider: 'M14 2 A8 8 0 1 0 14 18 A6.5 6.5 0 0 1 14 2 Z',
  long_distance: 'M0 14 H20 M0 8 H20 M0 2 H14',
  default: 'M10 0 L20 20 H0 Z',
};
