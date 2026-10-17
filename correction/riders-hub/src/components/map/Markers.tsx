import { Flag, MapPin, Siren, Fuel, Wrench, UtensilsCrossed, Coffee, Hotel, Zap, CircleDot, Hospital, ShoppingBag } from 'lucide-react';
import type { BusinessCategory } from '../../types';
import { initials } from '../../utils/format';

export function RiderMarker({
  name,
  photoUrl,
  heading = 0,
  isLeader,
  isSelf,
  status,
}: {
  name: string;
  photoUrl?: string;
  heading?: number;
  isLeader?: boolean;
  isSelf?: boolean;
  status?: string;
}) {
  const ring = isSelf ? 'ring-gps-400' : isLeader ? 'ring-ember-500' : 'ring-asphalt-300';
  return (
    <div className="relative flex flex-col items-center pointer-events-none" style={{ width: 40 }}>
      <div
        className="absolute -top-1.5 text-gps-glow"
        style={{ transform: `translateY(-100%) rotate(${heading}deg)`, transformOrigin: '50% 100%' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M7 0 L12 12 L7 9 L2 12 Z" fill="currentColor" />
        </svg>
      </div>
      <div className="relative">
        {isSelf && <span className="gps-pulse absolute inset-0 opacity-70" />}
        <div
          className={`relative w-9 h-9 rounded-full ring-2 ${ring} overflow-hidden bg-gradient-to-br from-gps-400 to-gps-600 flex items-center justify-center text-[0.65rem] font-bold text-asphalt-950 shadow-lg`}
        >
          {photoUrl ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" /> : initials(name)}
        </div>
        {isLeader && (
          <span className="absolute -top-1 -right-1 bg-ember-500 rounded-full w-4 h-4 flex items-center justify-center text-[0.55rem] text-white font-bold">
            ★
          </span>
        )}
      </div>
      {status && (
        <span className="mt-1 text-[0.6rem] leading-none bg-asphalt-900/90 border border-asphalt-600 rounded-full px-1.5 py-0.5 whitespace-nowrap">
          {status}
        </span>
      )}
    </div>
  );
}

export function DestinationMarker() {
  return (
    <div className="w-8 h-8 rounded-full bg-ember-500 flex items-center justify-center text-white shadow-lg ring-4 ring-ember-500/25">
      <Flag size={14} />
    </div>
  );
}

export function StartMarker() {
  return (
    <div className="w-8 h-8 rounded-full bg-gps-500 border-2 border-white flex items-center justify-center text-asphalt-950 shadow-lg">
      <span className="w-2.5 h-2.5 rounded-full bg-asphalt-950" />
    </div>
  );
}

export function MeetingPointMarker() {
  return (
    <div className="w-8 h-8 rounded-full bg-asphalt-700 border-2 border-gps-400 flex items-center justify-center text-gps-400 shadow-lg">
      <MapPin size={14} />
    </div>
  );
}

export function EmergencyMarker() {
  return (
    <div className="w-9 h-9 rounded-full bg-signal-red flex items-center justify-center text-white shadow-lg ember-pulse">
      <Siren size={16} />
    </div>
  );
}

const CATEGORY_ICON: Record<BusinessCategory, React.ComponentType<{ size?: number }>> = {
  petrol: Fuel,
  ev_charging: Zap,
  mechanic: Wrench,
  tyre_shop: CircleDot,
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  hotel: Hotel,
  bike_service: Wrench,
  accessories: ShoppingBag,
  hospital: Hospital,
  other: MapPin,
};

const CATEGORY_COLOR: Record<BusinessCategory, string> = {
  petrol: 'bg-signal-amber text-asphalt-950',
  ev_charging: 'bg-gps-400 text-asphalt-950',
  mechanic: 'bg-asphalt-300 text-asphalt-950',
  tyre_shop: 'bg-asphalt-300 text-asphalt-950',
  restaurant: 'bg-ember-400 text-asphalt-950',
  cafe: 'bg-ember-400 text-asphalt-950',
  hotel: 'bg-gps-400 text-asphalt-950',
  bike_service: 'bg-asphalt-300 text-asphalt-950',
  accessories: 'bg-asphalt-300 text-asphalt-950',
  hospital: 'bg-signal-red text-white',
  other: 'bg-asphalt-400 text-asphalt-950',
};

export function PlaceMarker({ category }: { category: BusinessCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md ${CATEGORY_COLOR[category]}`}
    >
      <Icon size={13} />
    </div>
  );
}

/**
 * Google Maps-style "my location" blue dot: solid blue circle with a white
 * ring and a soft pulsing halo. Rendered as a real marker icon on both real
 * map backends (Leaflet + OpenStreetMap, and Google Maps) — see
 * LeafletMapView.tsx and GoogleMapView.tsx.
 */
export function MyLocationDot({ headingDeg }: { headingDeg?: number }) {
  return (
    <div className="relative flex items-center justify-center pointer-events-none" style={{ width: 26, height: 26 }}>
      <span className="gps-pulse-blue absolute inset-0 opacity-50" />
      {typeof headingDeg === 'number' && (
        <div
          className="absolute"
          style={{ transform: `translateY(-15px) rotate(${headingDeg}deg)`, transformOrigin: '50% 15px' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 0 L10 10 L6 7.5 L2 10 Z" fill="#4285F4" opacity={0.9} />
          </svg>
        </div>
      )}
      <div
        className="w-4 h-4 rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.4)]"
        style={{ backgroundColor: '#4285F4' }}
      />
    </div>
  );
}

/**
 * The rider's own live pointer: an ember-orange navigation arrow in a white-
 * ringed disc with a pulsing halo. The arrow sits inside `.rh-pointer-rot`,
 * which map backends rotate to the rider's current heading as GPS updates
 * arrive (so it points the way the bike is travelling).
 */
export function RiderPointer({ headingDeg = 0 }: { headingDeg?: number }) {
  return (
    <div className="relative flex items-center justify-center pointer-events-none" style={{ width: 44, height: 44 }}>
      <span className="gps-pulse-ember absolute inset-1" />
      <div
        className="relative w-9 h-9 rounded-full bg-ember-500 border-[3px] border-white flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
      >
        <div className="rh-pointer-rot" data-rh-pointer style={{ transform: `rotate(${headingDeg}deg)` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ display: 'block' }}>
            <path d="M12 2 L20 21 L12 16.5 L4 21 Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
