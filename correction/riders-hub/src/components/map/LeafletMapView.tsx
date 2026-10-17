import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Business, GeoPoint, NamedPoint } from '../../types';
import type { MapHandle, MapRiderInput } from './types';
import { resolveInitialCenter } from './types';
import { RiderMarker, DestinationMarker, MeetingPointMarker, PlaceMarker, RiderPointer, StartMarker } from './Markers';

interface LeafletMapViewProps {
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

function divIcon(html: string, size: [number, number], anchor: [number, number]) {
  return L.divIcon({ html, className: 'rh-leaflet-marker', iconSize: size, iconAnchor: anchor });
}

/**
 * Real, interactive map rendered with Leaflet + live OpenStreetMap raster
 * tiles — actual roads, streets, buildings, place names, cities, and towns,
 * exactly as OSM publishes them. No CSS/SVG/Canvas stand-in, no hardcoded
 * geography. Used automatically whenever `VITE_GOOGLE_MAPS_API_KEY` is not
 * configured (see MapView.tsx); Google Maps is used instead when it is.
 */
export const LeafletMapView = forwardRef<MapHandle, LeafletMapViewProps>(function LeafletMapView(
  { riders = [], route = [], origin, fitBounds = false, destination, meetingPoint, places = [], onRiderClick, onPlaceClick, focus, myLocation, follow = false, onUserPan, className = '' },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const riderMarkersRef = useRef<Record<string, L.Marker>>({});
  const placeMarkersRef = useRef<Record<string, L.Marker>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const meetMarkerRef = useRef<L.Marker | null>(null);
  const selfMarkerRef = useRef<L.Marker | null>(null);
  const selfAccuracyCircleRef = useRef<L.Circle | null>(null);
  const hasCenteredOnSelfRef = useRef(false);
  const onRiderClickRef = useRef(onRiderClick);
  const onPlaceClickRef = useRef(onPlaceClick);
  const followRef = useRef(follow);
  const onUserPanRef = useRef(onUserPan);
  const [initialized, setInitialized] = useState(false);
  // `initialCenter` is recomputed fresh on every render (it tracks live GPS/
  // RTDB data), so its object identity changes constantly. Using it directly
  // as an effect dependency previously caused the map to be torn down and
  // recreated on every single location update (destroying it, then
  // orphaning every rider marker) — which is exactly why the map appeared
  // to "only work once". `hasCenter` is a one-shot boolean latch: it flips
  // from false to true exactly once, the moment a real center becomes
  // available, and never again — so the map is created exactly once and
  // only ever torn down when this component actually unmounts.
  const [hasCenter, setHasCenter] = useState(false);
  const initialCenterRef = useRef<GeoPoint | null>(null);

  onRiderClickRef.current = onRiderClick;
  onPlaceClickRef.current = onPlaceClick;
  followRef.current = follow;
  onUserPanRef.current = onUserPan;

  const initialCenter = resolveInitialCenter({ myLocation, focus, route, destination: destination ?? origin, meetingPoint, places });
  if (initialCenter && !initialCenterRef.current) {
    initialCenterRef.current = initialCenter;
  }
  useEffect(() => {
    if (initialCenter && !hasCenter) setHasCenter(true);
  }, [initialCenter, hasCenter]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      const map = mapRef.current;
      const target = myLocation ?? focus ?? route[0];
      if (map && target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    },
    fitAll: () => {
      const map = mapRef.current;
      if (!map) return;
      const pts: [number, number][] = riders.map((r) => [r.location.lat, r.location.lng]);
      if (myLocation) pts.push([myLocation.lat, myLocation.lng]);
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 17, animate: true });
      else if (pts.length === 1) map.setView(pts[0], 16);
    },
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
  }));

  // --- initialize the map exactly once, the moment a real center is available ---
  useEffect(() => {
    if (mapRef.current || !containerRef.current || !hasCenter || !initialCenterRef.current) return;
    const center = initialCenterRef.current;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // A real finger/mouse drag means the rider wants to look around: stop following.
    map.on('dragstart', () => onUserPanRef.current?.());

    mapRef.current = map;
    setInitialized(true);
  }, [hasCenter]);

  // --- tear the map down only when this component actually unmounts ---
  // (previously this cleanup ran on every `initialCenter` change — i.e. on
  // every GPS/RTDB update — which destroyed the map and orphaned every
  // rider marker almost immediately after they were drawn).
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- route + destination + meeting point ---
  useEffect(() => {
    const map = mapRef.current;
    if (!initialized || !map) return;

    routeLineRef.current?.remove();
    if (route.length > 1) {
      routeLineRef.current = L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#ff4d1c', weight: 5, opacity: 0.95 }
      ).addTo(map);
    }

    originMarkerRef.current?.remove();
    if (origin) {
      originMarkerRef.current = L.marker([origin.lat, origin.lng], {
        icon: divIcon(renderToStaticMarkup(<StartMarker />), [32, 32], [16, 16]),
      })
        .bindPopup(`Start: ${origin.label}`)
        .addTo(map);
    }

    destMarkerRef.current?.remove();
    if (destination) {
      destMarkerRef.current = L.marker([destination.lat, destination.lng], {
        icon: divIcon(renderToStaticMarkup(<DestinationMarker />), [32, 32], [16, 16]),
      })
        .bindPopup(destination.label)
        .addTo(map);
    }

    meetMarkerRef.current?.remove();
    if (meetingPoint) {
      meetMarkerRef.current = L.marker([meetingPoint.lat, meetingPoint.lng], {
        icon: divIcon(renderToStaticMarkup(<MeetingPointMarker />), [32, 32], [16, 16]),
      })
        .bindPopup(meetingPoint.label)
        .addTo(map);
    }

    if (fitBounds) {
      const pts: [number, number][] = [origin, destination, meetingPoint]
        .filter((p): p is NamedPoint => !!p)
        .map((p) => [p.lat, p.lng]);
      route.forEach((p) => pts.push([p.lat, p.lng]));
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 16, animate: true });
      else if (pts.length === 1) map.setView(pts[0], 15);
    }
  }, [initialized, route, origin, destination, meetingPoint, fitBounds]);

  // --- other riders, smoothly animated between position updates ---
  useEffect(() => {
    const map = mapRef.current;
    if (!initialized || !map) return;
    const seen = new Set(riders.map((r) => r.userId));

    riders.forEach((r) => {
      const latlng: [number, number] = [r.location.lat, r.location.lng];
      const existing = riderMarkersRef.current[r.userId];
      if (existing) {
        animateMarkerTo(existing, latlng);
      } else {
        const marker = L.marker(latlng, {
          icon: divIcon(
            renderToStaticMarkup(
              <RiderMarker name={r.name} photoUrl={r.photoUrl} heading={r.location.headingDeg} isLeader={r.isLeader} />
            ),
            [40, 56],
            [20, 40]
          ),
        })
          .bindPopup(r.name)
          .on('click', () => onRiderClickRef.current?.(r.userId))
          .addTo(map);
        riderMarkersRef.current[r.userId] = marker;
      }
    });

    Object.keys(riderMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        riderMarkersRef.current[id].remove();
        delete riderMarkersRef.current[id];
      }
    });
  }, [initialized, riders]);

  // --- nearby places: petrol, mechanics, restaurants, hospitals, etc. ---
  useEffect(() => {
    const map = mapRef.current;
    if (!initialized || !map) return;
    const seen = new Set(places.map((p) => p.id));

    places.forEach((p) => {
      if (placeMarkersRef.current[p.id]) return;
      const marker = L.marker([p.location.lat, p.location.lng], {
        icon: divIcon(renderToStaticMarkup(<PlaceMarker category={p.category} />), [28, 28], [14, 14]),
      })
        .bindPopup(p.name)
        .on('click', () => onPlaceClickRef.current?.(p.id))
        .addTo(map);
      placeMarkersRef.current[p.id] = marker;
    });

    Object.keys(placeMarkersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        placeMarkersRef.current[id].remove();
        delete placeMarkersRef.current[id];
      }
    });
  }, [initialized, places]);

  // --- my real-time GPS location: rider pointer + accuracy halo, smooth movement, live camera follow ---
  useEffect(() => {
    const map = mapRef.current;
    if (!initialized || !map || !myLocation) return;
    const latlng: [number, number] = [myLocation.lat, myLocation.lng];

    if (!selfMarkerRef.current) {
      selfMarkerRef.current = L.marker(latlng, {
        icon: divIcon(renderToStaticMarkup(<RiderPointer headingDeg={myLocation.headingDeg} />), [44, 44], [22, 22]),
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(map);
    } else {
      animateMarkerTo(selfMarkerRef.current, latlng);
      // Rotate the arrow in place (no icon re-creation, so the pulse doesn't restart).
      const arrow = selfMarkerRef.current.getElement()?.querySelector<HTMLElement>('[data-rh-pointer]');
      if (arrow && typeof myLocation.headingDeg === 'number') {
        arrow.style.transform = `rotate(${myLocation.headingDeg}deg)`;
      }
    }

    if (myLocation.accuracyM) {
      if (!selfAccuracyCircleRef.current) {
        selfAccuracyCircleRef.current = L.circle(latlng, {
          radius: myLocation.accuracyM,
          color: '#ff4d1c',
          opacity: 0.3,
          weight: 1,
          fillColor: '#ff4d1c',
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
      } else {
        selfAccuracyCircleRef.current.setLatLng(latlng);
        selfAccuracyCircleRef.current.setRadius(myLocation.accuracyM);
      }
    }

    if (!hasCenteredOnSelfRef.current) {
      hasCenteredOnSelfRef.current = true;
      map.flyTo(latlng, 16, { duration: 1 });
    } else if (followRef.current) {
      // Trace the rider live: glide the camera along with the pointer.
      map.panTo(latlng, { animate: true, duration: 1, easeLinearity: 0.5, noMoveStart: true });
    }
  }, [initialized, myLocation]);

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

/** Smoothly interpolates a Leaflet marker to a new position instead of jumping instantly. */
function animateMarkerTo(marker: L.Marker, to: [number, number], durationMs = 1000) {
  const from = marker.getLatLng();
  const fromLat = from.lat;
  const fromLng = from.lng;
  const start = performance.now();

  function step(now: number) {
    const t = Math.min(1, (now - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    const lat = fromLat + (to[0] - fromLat) * eased;
    const lng = fromLng + (to[1] - fromLng) * eased;
    marker.setLatLng([lat, lng]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
