import React, { useRef, useState } from 'react';
import { Plus, Minus, LocateFixed, MapPinOff, Users } from 'lucide-react';
import { LeafletMapView } from './LeafletMapView';
import { GoogleMapView, isGoogleMapsConfigured } from './GoogleMapView';
import type { MapHandle, MapRiderInput } from './types';
import type { Business, GeoPoint, NamedPoint } from '../../types';
import { useMyLocation } from '../../hooks/useMyLocation';

interface MapViewProps {
  riders?: MapRiderInput[];
  route?: GeoPoint[];
  origin?: NamedPoint;
  destination?: NamedPoint;
  meetingPoint?: NamedPoint;
  /** Zoom/pan the map to frame the origin, destination, meeting point and route (used by previews). */
  fitBounds?: boolean;
  places?: Business[];
  onRiderClick?: (userId: string) => void;
  onPlaceClick?: (id: string) => void;
  focus?: GeoPoint;
  showControls?: boolean;
  className?: string;
  /**
   * Renders the real-time GPS "my location" blue dot and requests location
   * permission when the map mounts. Defaults to true. Screens that already
   * represent the current user as a ride participant marker (e.g. the live
   * group-ride map) can set this to false to avoid showing two markers for
   * the same person.
   */
  showMyLocation?: boolean;
}

/**
 * Renders a real, interactive, tile-based map — Google Maps when
 * `VITE_GOOGLE_MAPS_API_KEY` is configured, otherwise Leaflet with live
 * OpenStreetMap raster tiles. Both backends show actual roads, streets,
 * buildings, and place names; neither is a CSS/SVG/Canvas stand-in.
 *
 * The device's live GPS position (see hooks/useMyLocation.ts) is passed
 * straight through from `navigator.geolocation.watchPosition()` — no
 * random, demo, or hardcoded coordinates are ever substituted.
 */
export function MapView(props: MapViewProps) {
  const { showControls = true, showMyLocation = true, className = '', ...rest } = props;
  const { position, permission, retry } = useMyLocation(showMyLocation);
  const mapRef = useRef<MapHandle>(null);
  // Live "trace the rider" camera mode: on by default, switched off when the
  // user drags the map, switched back on by the locate button.
  const [following, setFollowing] = useState(true);

  const myLocation = showMyLocation && position
    ? { lat: position.lat, lng: position.lng, headingDeg: position.headingDeg, accuracyM: position.accuracyM }
    : undefined;

  const recenter = () => {
    setFollowing(true);
    mapRef.current?.recenter();
  };

  return (
    <div className={`relative w-full h-full isolate ${className}`}>
      {isGoogleMapsConfigured ? (
        <GoogleMapView ref={mapRef} {...rest} myLocation={myLocation} follow={following} onUserPan={() => setFollowing(false)} />
      ) : (
        <LeafletMapView ref={mapRef} {...rest} myLocation={myLocation} follow={following} onUserPan={() => setFollowing(false)} />
      )}

      {showControls && (
        <div className="absolute right-3 bottom-24 flex flex-col gap-2 z-30">
          <MapControlButton icon={<Plus size={16} />} onClick={() => mapRef.current?.zoomIn()} />
          <MapControlButton icon={<Minus size={16} />} onClick={() => mapRef.current?.zoomOut()} />
          {(rest.riders?.length ?? 0) > 0 && (
            <MapControlButton
              icon={<Users size={16} />}
              onClick={() => {
                setFollowing(false);
                mapRef.current?.fitAll();
              }}
            />
          )}
          <MapControlButton icon={<LocateFixed size={16} />} accent={following} onClick={recenter} />
        </div>
      )}

      {showMyLocation && myLocation && !following && !showControls && (
        <button
          onClick={recenter}
          className="absolute right-3 top-20 z-30 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border bg-gps-500 border-gps-400 text-asphalt-950 active:scale-95 transition-transform"
          aria-label="Re-center on my location"
        >
          <LocateFixed size={16} />
        </button>
      )}

      {showMyLocation && permission === 'denied' && (
        <div className="absolute inset-x-3 top-3 z-40 rise-fade">
          <div className="glass border border-signal-amber/40 rounded-2xl px-4 py-3 flex items-start gap-3">
            <MapPinOff size={18} className="text-signal-amber shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-asphalt-100">Location access is off</p>
              <p className="text-xs text-asphalt-300 mt-0.5">
                Enable location permission in your browser to see your live position on the map.
              </p>
            </div>
            <button onClick={retry} className="text-xs font-semibold text-ember-400 shrink-0 mt-0.5">
              Retry
            </button>
          </div>
        </div>
      )}

      {showMyLocation && permission === 'unavailable' && (
        <div className="absolute inset-x-3 top-3 z-40 rise-fade">
          <div className="glass border border-asphalt-600 rounded-2xl px-4 py-3 flex items-start gap-3">
            <MapPinOff size={18} className="text-asphalt-400 shrink-0 mt-0.5" />
            <p className="text-xs text-asphalt-300">
              GPS isn't available on this device/browser — showing the map without your live position.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MapControlButton({
  icon,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border active:scale-95 transition-transform ${
        accent ? 'bg-gps-500 border-gps-400 text-asphalt-950' : 'bg-asphalt-800 border-asphalt-500 text-white'
      }`}
    >
      {icon}
    </button>
  );
}
