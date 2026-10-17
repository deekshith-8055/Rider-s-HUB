import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Business, GeoPoint, NamedPoint } from '../../types';
import type { MapHandle, MapRiderInput } from './types';
import { resolveInitialCenter } from './types';

declare global {
  interface Window {
    google?: any;
    __rhGoogleMapsLoading?: Promise<void>;
  }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (window.__rhGoogleMapsLoading) return window.__rhGoogleMapsLoading;
  window.__rhGoogleMapsLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=marker,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return window.__rhGoogleMapsLoading;
}

export const isGoogleMapsConfigured = Boolean(API_KEY);

interface GoogleMapViewProps {
  riders?: MapRiderInput[];
  route?: GeoPoint[];
  origin?: NamedPoint;
  fitBounds?: boolean;
  destination?: NamedPoint;
  meetingPoint?: NamedPoint;
  places?: Business[];
  onRiderClick?: (userId: string) => void;
  onPlaceClick?: (id: string) => void;
  focus?: GeoPoint;
  className?: string;
  /** Real device GPS position — only ever set once an actual fix has been received. */
  myLocation?: GeoPoint & { headingDeg?: number; accuracyM?: number };
  /** When true the camera keeps the rider's pointer in view as GPS updates arrive. */
  follow?: boolean;
  /** Fired when the user drags the map themselves (so the parent can stop following). */
  onUserPan?: () => void;
}

/**
 * Real Google Maps JS SDK wrapper — roads, road names, buildings, cities,
 * landmarks, and native POI icons (petrol pumps, restaurants, hospitals,
 * mechanics, etc.) all come from Google's own map tiles, so nothing is
 * faked or drawn by this app. Only rendered when `VITE_GOOGLE_MAPS_API_KEY`
 * is configured; otherwise MapView renders LeafletMapView (OpenStreetMap)
 * instead — see MapView.tsx.
 *
 * The map is not created until a real, data-driven center is available
 * (GPS fix, ride route/destination, or loaded places) — it never opens on
 * a hardcoded location.
 */
export const GoogleMapView = forwardRef<MapHandle, GoogleMapViewProps>(function GoogleMapView(
  { riders = [], route = [], origin, fitBounds = false, destination, meetingPoint, places = [], onRiderClick, onPlaceClick, focus, myLocation, follow = false, onUserPan, className = '' },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const riderMarkersRef = useRef<Record<string, any>>({});
  const placeMarkersRef = useRef<Record<string, any>>({});
  const routeLineRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const meetMarkerRef = useRef<any>(null);
  const selfMarkerRef = useRef<any>(null);
  const selfAccuracyCircleRef = useRef<any>(null);
  const hasCenteredOnSelfRef = useRef(false);
  const onRiderClickRef = useRef(onRiderClick);
  const onPlaceClickRef = useRef(onPlaceClick);
  const followRef = useRef(follow);
  const onUserPanRef = useRef(onUserPan);
  const [ready, setReady] = useState(false);
  // See LeafletMapView.tsx for why this is a one-shot boolean latch rather
  // than depending on `initialCenter` directly: that object is recomputed
  // fresh on every render (it tracks live GPS/RTDB data), so its identity
  // changes constantly — using it as an effect dependency directly is
  // fragile. `hasCenter` flips false -> true exactly once.
  const [hasCenter, setHasCenter] = useState(false);
  const initialCenterRef = useRef<GeoPoint | null>(null);

  onRiderClickRef.current = onRiderClick;
  onPlaceClickRef.current = onPlaceClick;
  followRef.current = follow;
  onUserPanRef.current = onUserPan;

  const initialCenter = resolveInitialCenter({ myLocation, focus, route, destination: destination ?? origin, meetingPoint, places, riders });
  if (initialCenter && !initialCenterRef.current) {
    initialCenterRef.current = initialCenter;
  }
  useEffect(() => {
    if (initialCenter && !hasCenter) setHasCenter(true);
  }, [initialCenter, hasCenter]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      if (!mapRef.current) return;
      const target = myLocation ?? focus ?? route[0];
      if (target) {
        mapRef.current.panTo({ lat: target.lat, lng: target.lng });
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() ?? 15, 16));
      }
    },
    fitAll: () => {
      if (!mapRef.current) return;
      const g = window.google;
      const pts = riders.map((r) => ({ lat: r.location.lat, lng: r.location.lng }));
      if (myLocation) pts.push({ lat: myLocation.lat, lng: myLocation.lng });
      if (pts.length > 1) {
        const b = new g.maps.LatLngBounds();
        pts.forEach((p) => b.extend(p));
        mapRef.current.fitBounds(b, 60);
      } else if (pts.length === 1) {
        mapRef.current.setCenter(pts[0]);
        mapRef.current.setZoom(16);
      }
    },
    zoomIn: () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 14) + 1),
    zoomOut: () => mapRef.current?.setZoom((mapRef.current.getZoom() ?? 14) - 1),
  }));

  // --- init map once we have a real, data-driven point to center on ---
  useEffect(() => {
    if (mapRef.current || !containerRef.current || !hasCenter || !initialCenterRef.current) return;
    const center = initialCenterRef.current;
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 14,
        // Keep Google's native roads/buildings/labels/POI icons visible so the
        // map reads exactly like the standard Google Maps interface.
        mapTypeId: 'roadmap',
        disableDefaultUI: false,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: true,
      });
      mapRef.current.addListener('dragstart', () => onUserPanRef.current?.());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasCenter]);

  // --- route + destination + meeting point ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google;

    if (routeLineRef.current) routeLineRef.current.setMap(null);
    if (route.length > 1) {
      routeLineRef.current = new g.maps.Polyline({
        path: route,
        strokeColor: '#ff4d1c',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map: mapRef.current,
      });
    }

    if (originMarkerRef.current) originMarkerRef.current.setMap(null);
    if (origin) {
      originMarkerRef.current = new g.maps.Marker({
        position: origin,
        map: mapRef.current,
        title: `Start: ${origin.label}`,
        icon: pinIcon('#21e6c1'),
      });
    }

    if (destMarkerRef.current) destMarkerRef.current.setMap(null);
    if (destination) {
      destMarkerRef.current = new g.maps.Marker({
        position: destination,
        map: mapRef.current,
        title: destination.label,
        icon: pinIcon('#ff4d1c'),
      });
    }

    if (meetMarkerRef.current) meetMarkerRef.current.setMap(null);
    if (meetingPoint) {
      meetMarkerRef.current = new g.maps.Marker({
        position: meetingPoint,
        map: mapRef.current,
        title: meetingPoint.label,
        icon: pinIcon('#21e6c1'),
      });
    }

    if (fitBounds) {
      const pts = [origin, destination, meetingPoint, ...route].filter(Boolean) as GeoPoint[];
      if (pts.length > 1) {
        const bounds = new g.maps.LatLngBounds();
        pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        mapRef.current.fitBounds(bounds, 36);
      } else if (pts.length === 1) {
        mapRef.current.setCenter(pts[0]);
        mapRef.current.setZoom(15);
      }
    }
  }, [ready, route, origin, destination, meetingPoint, fitBounds]);

  // --- other riders, smoothly animated ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google;
    const seen = new Set(riders.map((r) => r.userId));

    riders.forEach((r) => {
      const pos = { lat: r.location.lat, lng: r.location.lng };
      const existing = riderMarkersRef.current[r.userId];
      if (existing) {
        animateMarkerTo(existing, pos);
      } else {
        const marker = new g.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: r.name,
          icon: riderPinIcon(r.isLeader),
          zIndex: r.isLeader ? 200 : 100,
        });
        marker.addListener('click', () => onRiderClickRef.current?.(r.userId));
        riderMarkersRef.current[r.userId] = marker;
      }
    });

    Object.keys(riderMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        riderMarkersRef.current[id].setMap(null);
        delete riderMarkersRef.current[id];
      }
    });
  }, [ready, riders]);

  // --- nearby places (petrol, mechanics, restaurants, hospitals, etc.) ---
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const g = window.google;
    const seen = new Set(places.map((p) => p.id));

    places.forEach((p) => {
      if (placeMarkersRef.current[p.id]) return;
      const marker = new g.maps.Marker({
        position: p.location,
        map: mapRef.current,
        title: p.name,
        icon: placePinIcon(p.category),
      });
      marker.addListener('click', () => onPlaceClickRef.current?.(p.id));
      placeMarkersRef.current[p.id] = marker;
    });

    Object.keys(placeMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        placeMarkersRef.current[id].setMap(null);
        delete placeMarkersRef.current[id];
      }
    });
  }, [ready, places]);

  // --- my real-time location: rider pointer + accuracy halo, smooth animation, live camera follow ---
  useEffect(() => {
    if (!ready || !mapRef.current || !myLocation) return;
    const g = window.google;
    const pos = { lat: myLocation.lat, lng: myLocation.lng };

    if (!selfMarkerRef.current) {
      selfMarkerRef.current = new g.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: 'My location',
        icon: riderPointerIcon(myLocation.headingDeg),
        zIndex: 999,
        optimized: false,
      });
      selfAccuracyCircleRef.current = new g.maps.Circle({
        map: mapRef.current,
        center: pos,
        radius: myLocation.accuracyM ?? 30,
        strokeColor: '#ff4d1c',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        fillColor: '#ff4d1c',
        fillOpacity: 0.1,
        clickable: false,
      });
    } else {
      animateMarkerTo(selfMarkerRef.current, pos);
      selfMarkerRef.current.setIcon(riderPointerIcon(myLocation.headingDeg));
      selfAccuracyCircleRef.current?.setCenter(pos);
      if (myLocation.accuracyM) selfAccuracyCircleRef.current?.setRadius(myLocation.accuracyM);
    }

    if (!hasCenteredOnSelfRef.current) {
      hasCenteredOnSelfRef.current = true;
      mapRef.current.panTo(pos);
      mapRef.current.setZoom(16);
    } else if (followRef.current) {
      mapRef.current.panTo(pos);
    }
  }, [ready, myLocation]);

  return (
    <div className={`relative w-full h-full isolate z-0 ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {!hasCenter && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-asphalt-950 text-center px-6">
          <div className="w-8 h-8 border-2 border-asphalt-600 border-t-gps-400 rounded-full animate-spin" />
          <p className="text-sm text-asphalt-300">Waiting for your location to load the map…</p>
        </div>
      )}
    </div>
  );
});

/** Smoothly interpolates a marker from its current position to a new one instead of jumping instantly. */
function animateMarkerTo(marker: any, to: { lat: number; lng: number }, durationMs = 1000) {
  const g = window.google;
  const from = marker.getPosition();
  if (!from) {
    marker.setPosition(to);
    return;
  }
  const fromLat = from.lat();
  const fromLng = from.lng();
  const start = performance.now();

  function step(now: number) {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    const lat = fromLat + (to.lat - fromLat) * eased;
    const lng = fromLng + (to.lng - fromLng) * eased;
    marker.setPosition(new g.maps.LatLng(lat, lng));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function pinIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="6" fill="white"/></svg>`;
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: window.google ? new window.google.maps.Size(30, 40) : undefined,
    anchor: window.google ? new window.google.maps.Point(15, 40) : undefined,
  };
}

function riderPinIcon(isLeader?: boolean) {
  return pinIcon(isLeader ? '#ff4d1c' : '#0fd6b0');
}

const PLACE_COLORS: Record<string, string> = {
  petrol: '#ffb020',
  ev_charging: '#21e6c1',
  mechanic: '#7c8494',
  tyre_shop: '#7c8494',
  restaurant: '#ff6a3d',
  cafe: '#ff6a3d',
  hotel: '#21e6c1',
  bike_service: '#7c8494',
  accessories: '#7c8494',
  hospital: '#ff3b5c',
  other: '#565e6e',
};

function placePinIcon(category: string) {
  const color = PLACE_COLORS[category] ?? PLACE_COLORS.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="${color}" stroke="white" stroke-width="2"/></svg>`;
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    scaledSize: window.google ? new window.google.maps.Size(22, 22) : undefined,
    anchor: window.google ? new window.google.maps.Point(11, 11) : undefined,
  };
}

/** The rider's live pointer: an ember navigation arrow that rotates to the current heading. */
function riderPointerIcon(headingDeg = 0) {
  const g = window.google;
  return {
    path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 6,
    rotation: headingDeg,
    fillColor: '#ff4d1c',
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
  };
}
