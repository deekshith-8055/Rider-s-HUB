# RIDER'S HUB

**Every Road. Every Rider. One Hub.**

Rider's Hub is a social + utility platform for motorcycle, scooter, touring, adventure, and general riding
communities: group rides with a shareable Ride ID, live GPS tracking on an original map surface, lightweight
ride communication, rider safety tools, a rider-focused business directory, community posts, and events —
all wrapped in an original dark/ember visual identity.

This build runs **fully in Demo Mode** out of the box — no API keys required — and is architected to drop in
real Firebase + Google Maps credentials for production with no code changes.

---

## 1. What's included

- **Start Ride → Ride ID → Join → Live Map → Communicate → Complete Ride → Save** — the full core loop, working end to end
- Live rider tracking on a **real, interactive map** — Google Maps when configured, otherwise Leaflet with live
  OpenStreetMap tiles — showing actual roads, streets, buildings, and places (no CSS/SVG stand-in map)
- Ride leader controls: start / pause / end, remove rider, send announcements
- Optional **Firebase Realtime Database** ride-room sync (`rides/{rideId}/riders/{uid}`) for low-latency,
  real-time marker updates scoped strictly to riders sharing the same Ride ID
- Rider quick-status system (🟢 Riding, ⛽ Fuel stop, 🚨 Emergency, etc.) reflected live on the map
- Lightweight ride chat with quick messages + free text
- Emergency button with a confirmation flow, live-location sharing, and nearby-hospital/mechanic surfacing
- Solo Ride mode with independent GPS tracking, distance/speed/duration stats
- Ride completion animation + shareable ride summary
- Rider profile with stats, original SVG achievement badges, and ride history
- Map utilities: petrol, EV charging, mechanics, tyres, food, hospitals, and more, with category filters
- Business registration + business dashboard (open/closed toggle, offers)
- Community feed, categories, and rider events with RSVP
- Basic admin console (rides, businesses, reports queue)
- Offline-first architecture: an `offlineSyncService` write queue that flushes automatically on reconnect
- Onboarding flow (welcome → account → profile → preferences → location permission → notification permission)

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript, Vite |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens) |
| Routing | React Router v7 |
| Icons | lucide-react |
| Backend (production) | Firebase Auth + Firestore, optionally + Realtime Database for ride-room live location |
| Backend (demo) | In-memory / `sessionStorage`-backed mock service with a live rider-movement simulator |
| Maps | Leaflet + OpenStreetMap tiles by default; Google Maps JS SDK when `VITE_GOOGLE_MAPS_API_KEY` is set |

All screens and hooks talk to a single `RiderHubDataService` interface (`src/services/apiTypes.ts`). Two
implementations satisfy it — `services/mock/mockDataService.ts` (demo) and `services/firebase/firestoreService.ts`
(production) — selected automatically in `src/services/api.ts` based on whether Firebase env vars are present.
Screens never import a concrete backend directly.

## 3. Project structure

```
src/
  components/
    ui/            Button, Card, Modal, BottomSheet, Toast, EmptyState, StatusSelector, EmergencyButton...
    map/            MapView, LeafletMapView (OpenStreetMap), GoogleMapView, Markers, shared map types
    ride/           RideCard, BusinessCard, EventCard, PostCard, NotificationCard
    layout/         Sidebar (desktop), BottomNav (mobile), Header, AppShell
    brand/          Logo (original SVG mark)
    profile/        AchievementBadge (original SVG badges)
  screens/
    onboarding/ auth/ home/ ride/ solo/ map/ community/ profile/ business/ events/ admin/ notifications/ settings/
  services/
    apiTypes.ts             shared backend interface
    api.ts                  picks mock vs Firebase
    firebase/                config.ts, firestoreService.ts
    mock/                    mockStore.ts, mockDataService.ts, seed.ts, simulator.ts
    location/                GPS watch + throttling + permission state
    offline/                 offlineSyncService (queue + auto-flush on reconnect)
    notifications/           in-app toast + browser Notification API
  hooks/            useRideChannel (locations/messages/events subscriptions)
  context/          AppContext (current user, network state, toasts, offline queue)
  types/            Full domain model (User, Ride, RideParticipant, Business, Event, ...)
  utils/            id generation, formatting, haversine distance/bearing
```

## 4. Installation

```bash
npm install
cp .env.example .env   # optional — see below
npm run dev
```

The app opens in **Demo Mode** by default: a full realistic dataset (fictional riders, four seeded group rides,
ten businesses, three events, community posts) and a live rider-movement simulation on the map, so every flow is
explorable with zero configuration.

## 5. Environment variables

See `.env.example`. Nothing is required to run the demo. To switch to production:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_MAPS_API_KEY=
```

Once all Firebase values are present, `services/api.ts` automatically switches from the mock service to
`firestoreService.ts` — no code changes needed. `VITE_GOOGLE_MAPS_API_KEY` is independent: set it to switch the
map from Leaflet + OpenStreetMap to the real Google Maps SDK.

## 6. Firebase setup (production)

1. Create a Firebase project → enable **Authentication** (Email/Password, Google, and optionally Phone) and
   **Firestore**.
2. Copy your web app config into `.env` (see above).
3. Deploy the included security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
   (`firestore.rules` is at the project root — it scopes ride, location, and message reads to ride
   participants/leaders, keeps notifications private to their recipient, and reserves report review for admins.)
4. Firestore collections used (created lazily on first write — no manual setup required):
   `users`, `rides`, `rideParticipants`, `locations`, `rideMessages`, `rideEvents`, `businesses`, `events`,
   `communities`, `posts`, `notifications`, `achievements`, `savedRides`, `offlineQueue`, `reports`.

## 7. Realtime Database setup (ride-room live location) — optional

On top of Firestore, Rider's Hub can sync live ride locations through **Firebase Realtime Database** for
lower-latency, room-style broadcasting — this is layered around the existing GPS/location code, not a
replacement for it.

1. In the Firebase console, enable **Realtime Database** and copy its URL (looks like
   `https://<project-id>-default-rtdb.<region>.firebasedatabase.app`).
2. Set `VITE_FIREBASE_DATABASE_URL` in `.env`.
3. Deploy the included rules:
   ```bash
   firebase deploy --only database
   ```
   (`database.rules.json` is at the project root.)
4. **How it works:** when a rider starts or joins a ride, that Ride ID becomes a "room". While the ride is
   active, `LiveRideScreen` keeps pushing the rider's real GPS fix (from the same `locationService` used
   everywhere else in the app — untouched by this feature) to:
   ```
   rides/{rideId}/riders/{uid}
     latitude, longitude, speed, name, lastUpdated
   ```
   Every other rider viewing that same Ride ID subscribes to `rides/{rideId}/riders` in real time
   (`onValue`), so markers on the map update the instant a fix arrives — no polling. If a rider's
   connection drops, Firebase's `onDisconnect().remove()` clears their entry automatically, so nobody sees a
   stale marker. Because each rider's data lives under their own ride's path, riders in different Ride IDs
   never see each other.
5. **Leaving this unset changes nothing** — `pushLocation`/`subscribeToRideLocations` fall back to the
   original Firestore-based location sync, so maps, GPS, rider markers, and ride flows keep working exactly
   as before.
6. Note: like the existing Firestore rules, `database.rules.json` scopes writes to the rider's own UID but
   allows any signed-in user who knows a Ride ID to read that room's riders (Firebase's rules language can't
   easily cross-reference Firestore's `rideParticipants` collection). Ride IDs are long, non-guessable
   identifiers, not the short shareable Ride Code, which keeps this reasonably safe for the intended use.

## 8. Map setup

Rider's Hub always renders a real, tile-based interactive map — never a CSS/SVG/Canvas placeholder.

- **No `VITE_GOOGLE_MAPS_API_KEY` configured (default):** `MapView` renders `LeafletMapView`
  (`src/components/map/LeafletMapView.tsx`), which uses [Leaflet](https://leafletjs.com) with live
  [OpenStreetMap](https://www.openstreetmap.org/copyright) raster tiles — real roads, streets, buildings, place
  names, cities, and towns, exactly as OSM publishes them, with standard pinch/scroll zoom and drag-to-pan. OSM's
  required attribution is shown in the map's bottom-right corner automatically. No API key needed.
- **With `VITE_GOOGLE_MAPS_API_KEY` set:** `MapView` renders `GoogleMapView` instead. Enable the **Maps
  JavaScript API** in Google Cloud Console, generate a browser-restricted key, and set it in `.env`. The map then
  renders Google's real roadmap tiles — roads and road names, buildings, localities, landmarks, and native POI
  icons (petrol pumps, restaurants, hospitals, mechanics, and more) — with standard Google Maps pan/zoom
  gestures (`gestureHandling: 'greedy'`).
- Every screen consumes the same `MapView` props regardless of which backend is active, so no other code changes
  are required to switch.
- Neither backend creates the underlying map until it has a real, data-driven coordinate to center on (a GPS
  fix, ride route/destination, or loaded places) — there is no hardcoded default location. If nothing is
  available yet, the map shows a short "waiting for your location" loading state instead of guessing.

### Live location on the map

- `MapView` requests browser location permission on mount via `navigator.geolocation.watchPosition()` with
  `enableHighAccuracy: true`, reading only `position.coords.latitude` / `position.coords.longitude` (plus the
  standard `speed`, `heading`, and `accuracy` fields from the same `coords` object for the accuracy halo and
  smoother rendering) — see `hooks/useMyLocation.ts` and `services/location/locationService.ts`. No random, demo,
  or hardcoded coordinates are ever substituted, and your marker is not drawn at all until a real GPS fix
  arrives.
- Your position renders as a Google-style solid blue dot with a white ring and a translucent GPS-accuracy halo,
  and animates smoothly between updates — via a `requestAnimationFrame` easing tween on both `LeafletMapView`
  and `GoogleMapView` — instead of jumping or flickering.
- The map centers on your position the first time a GPS fix arrives; the **My Location** button (bottom-right,
  the teal circular button) recenters on demand afterward.
- If permission is denied, an in-map banner explains this and offers a **Retry** button instead of silently

  failing.
- Screens that already show the current user as a ride participant (the live group-ride map) set
  `showMyLocation={false}` on `MapView` to avoid a duplicate marker — the rider's own avatar marker already
  serves that purpose there.

## 9. Demo mode internals

- `services/mock/seed.ts` — fictional riders (Arjun, Rahul, Kiran, Vikram, Aisha, Neha, Sanjay, Meera), four
  seeded rides (Warangal Weekend Ride, Hyderabad Night Ride, Lake View Morning Ride, Long Distance Tour), ten
  businesses, three events, and community posts, centered on Hyderabad.
- `services/mock/simulator.ts` — moves demo riders along a looping route every ~2.2s so the live map feels alive
  without any backend.
- `services/mock/mockStore.ts` — an in-memory store with a `sessionStorage` mirror and a pub/sub layer that
  mimics Firestore's `onSnapshot` semantics for locations, messages, and ride events.
- Demo state resets each browser session (`sessionStorage`), so every fresh visit starts from a clean seed.

## 10. Offline behavior

`services/offline/offlineSyncService.ts` is a small `localStorage`-backed write queue. GPS points, chat
messages, and status updates are enqueued when `navigator.onLine` is false and flushed in order through a
registered handler the moment the browser reports `online` again. The `OfflineBanner` component shows
**OFFLINE MODE** while disconnected and a **BACK ONLINE** confirmation while the queue drains.

## 11. Voice / Bluetooth architecture

The location and messaging services are written as small, replaceable modules specifically so a future
`bluetoothMeshService` (nearby discovery + short-range communication) can be added alongside — not instead of —
the GPS + internet live-tracking path, since Bluetooth cannot provide unlimited-distance tracking. A
`VITE_ENABLE_BLUETOOTH_MESH` flag is reserved in `.env.example` for that future module. Voice input is scoped
for a speech-to-text → message-box pipeline using the Web Speech API, feeding directly into the existing ride
chat `sendMessage` call.

## 12. Production deployment

```bash
npm run build     # outputs to dist/
```

Deploy `dist/` to any static host (Firebase Hosting, Vercel, Netlify, Cloudflare Pages). If using Firebase
Hosting alongside Firestore:

```bash
firebase deploy
```

## 13. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Map shows a "waiting for your location" spinner indefinitely | No GPS fix yet and no ride route/destination/places loaded — the map won't guess a location. Check location permission in your browser. |
| Sign-in does nothing in production | Firebase Auth provider not enabled in the Firebase console |
| Riders don't move on the map | Demo simulator only animates *seeded* riders; your own marker uses real GPS (or a gentle simulated fallback if location permission is denied) |
| "Offline queue" never empties | Check `navigator.onLine` — some sandboxed browser previews report `offline` permanently |
| Firestore permission-denied errors | Confirm `firestore.rules` was deployed and the signed-in user is a participant/leader of the ride being read |

---

Built as an original implementation — branding, graphics, layouts, and code are Rider's Hub's own; no
third-party proprietary source, logos, or copyrighted assets were used.
