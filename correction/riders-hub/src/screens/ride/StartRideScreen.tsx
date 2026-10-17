import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, MessageCircle, Check, ArrowLeft, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Primitives';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notifications/notificationService';
import { useMyLocation } from '../../hooks/useMyLocation';
import { useRideSharing } from '../../context/RideSharingContext';
import { usePlannedRoute } from '../../hooks/usePlannedRoute';
import { PlaceSearchInput } from '../../components/ride/PlaceSearchInput';
import { MapView } from '../../components/map/MapView';
import { reversePlace } from '../../services/geocoding/geocodingService';
import type { NamedPoint, Ride } from '../../types';

export function StartRideScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [createdRide, setCreatedRide] = useState<Ride | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Reuses the existing, working GPS pipeline (no changes to it) so a new
  // ride's origin is your real current location — never a hardcoded coordinate.
  const { position, permission, retry } = useMyLocation();

  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: '07:00',
    description: '',
    maxRiders: 15,
    visibility: 'public' as 'public' | 'private',
  });

  // Real, searched places. Each holds actual coordinates picked from the
  // suggestion list — nothing is guessed from the typed text.
  const { setCurrentRide } = useRideSharing();
  const [originPt, setOriginPt] = useState<NamedPoint | null>(null);
  const [destPt, setDestPt] = useState<NamedPoint | null>(null);
  const [meetPt, setMeetPt] = useState<NamedPoint | null>(null);

  // Default start = where the rider is right now. Captured once so the
  // preview map doesn't keep re-framing on every GPS tick.
  const [gpsOrigin, setGpsOrigin] = useState<NamedPoint | null>(null);
  useEffect(() => {
    if (position && !gpsOrigin) {
      const here = { lat: position.lat, lng: position.lng };
      setGpsOrigin({ ...here, label: 'My current location' });
      reversePlace(here.lat, here.lng).then((label) => {
        if (label) setGpsOrigin((g) => (g ? { ...g, label } : g));
      });
    }
  }, [position, gpsOrigin]);

  const effectiveOrigin = originPt ?? gpsOrigin;
  const { route: plannedRoute, loading: routeLoading } = usePlannedRoute(effectiveOrigin, destPt);

  const currentLocation = async (): Promise<NamedPoint | null> => {
    if (!position) return null;
    const here = { lat: position.lat, lng: position.lng };
    return { ...here, label: (await reversePlace(here.lat, here.lng)) ?? 'My current location' };
  };

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleCreate = async () => {
    if (!user || !position) return;
    setCreateError(null);
    setCreating(true);
    try {
      const start = effectiveOrigin ?? { lat: position.lat, lng: position.lng, label: 'Start point' };
      const ride = await api.createRide({
        name: form.name || 'Untitled Ride',
        description: form.description,
        leaderId: user.id,
        origin: start,
        destination: destPt!,
        ...(meetPt ? { meetingPoint: meetPt } : {}),
        date: form.date,
        startTime: form.startTime,
        maxRiders: form.maxRiders,
        visibility: form.visibility,
      });
      setCreatedRide(ride);
      setCurrentRide(ride.id);
      notificationService.toast('Ride created', `${ride.name} is ready to share.`, 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Rider's Hub] Ride creation failed:", err);
      setCreateError(
        (err as { code?: string })?.code === 'permission-denied'
          ? "Couldn't create the ride (permission denied). If you're the developer, check that firestore.rules has been deployed."
          : "Couldn't create the ride. Check your connection and try again."
      );
    } finally {
      setCreating(false);
    }
  };

  if (createdRide) {
    return <RideCreatedPanel ride={createdRide} />;
  }

  const canCreate = Boolean(form.name && position && destPt);

  return (
    <div className="px-4 md:px-6 py-4 rise-fade max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Start a Ride</h1>
      </div>

      {!position && (
        <div className="flex items-start gap-2.5 bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 mb-4">
          {permission === 'denied' || permission === 'unavailable' ? (
            <>
              <MapPin size={16} className="text-signal-amber shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-asphalt-100">Location access needed</p>
                <p className="text-xs text-asphalt-400 mt-0.5">
                  Rides are anchored at your real GPS location — enable location access to continue.
                </p>
              </div>
              <button onClick={retry} className="text-xs font-semibold text-ember-400 shrink-0 mt-0.5">
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="w-4 h-4 border-2 border-asphalt-500 border-t-gps-400 rounded-full animate-spin shrink-0 mt-0.5" />
              <p className="text-xs text-asphalt-300">Getting your real GPS location…</p>
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        <Field label="Ride name">
          <input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Weekend Ride" className={inputClass} />
        </Field>

        <Field label="Starting location">
          <PlaceSearchInput
            value={originPt}
            onSelect={setOriginPt}
            placeholder={gpsOrigin ? `Default: ${gpsOrigin.label}` : 'Search a starting point'}
            near={position}
            currentLocation={position ? currentLocation : null}
          />
        </Field>
        <Field label="Destination">
          <PlaceSearchInput value={destPt} onSelect={setDestPt} placeholder="Search a destination, e.g. Ramappa Temple" near={position} />
          {!destPt && <p className="text-[0.7rem] text-asphalt-500 mt-1">Pick a suggestion so it appears on the map.</p>}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => update({ date: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Start time">
            <input type="time" value={form.startTime} onChange={(e) => update({ startTime: e.target.value })} className={inputClass} />
          </Field>
        </div>

        <Field label="Meeting point (optional)">
          <PlaceSearchInput value={meetPt} onSelect={setMeetPt} placeholder="Search a meeting point, e.g. petrol pump" near={position} />
        </Field>

        {(effectiveOrigin || destPt) && (
          <div>
            <div className="h-56 rounded-2xl overflow-hidden border border-asphalt-600 relative">
              <MapView
                origin={effectiveOrigin ?? undefined}
                destination={destPt ?? undefined}
                meetingPoint={meetPt ?? undefined}
                route={plannedRoute?.path}
                fitBounds
                showMyLocation={false}
                showControls={false}
              />
            </div>
            <p className="text-xs text-asphalt-400 mt-1.5">
              {routeLoading
                ? 'Finding the route…'
                : plannedRoute?.distanceKm != null
                  ? `Route preview: ${plannedRoute.distanceKm.toFixed(1)} km · about ${Math.round(plannedRoute.durationMin ?? 0)} min by road`
                  : plannedRoute?.approximate
                    ? 'Showing a straight line — road route unavailable right now.'
                    : 'Choose a destination to preview the route.'}
            </p>
          </div>
        )}

        <Field label="Ride description">
          <textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            placeholder="Pace, fuel stops, what to expect…"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Maximum riders">
            <input
              type="number"
              min={2}
              max={100}
              value={form.maxRiders}
              onChange={(e) => update({ maxRiders: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Visibility">
            <div className="flex gap-2">
              {(['public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => update({ visibility: v })}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium border capitalize ${
                    form.visibility === v ? 'bg-ember-500/15 border-ember-500 text-ember-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Button fullWidth size="lg" onClick={handleCreate} disabled={!canCreate || creating}>
          {creating ? 'Creating…' : !position ? 'Waiting for GPS location…' : 'Create Ride'}
        </Button>
        {createError && <p className="text-sm text-signal-red text-center">{createError}</p>}
      </div>
    </div>
  );
}

function RideCreatedPanel({ ride }: { ride: Ride }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/join/${ride.code}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&bgcolor=17-19-24&color=255-255-255&data=${encodeURIComponent(shareUrl)}`;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(ride.code);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-lg mx-auto rise-fade text-center">
      <div className="w-16 h-16 rounded-2xl bg-gps-500/15 border border-gps-500/40 flex items-center justify-center mx-auto mb-4 text-gps-400">
        <Check size={28} />
      </div>
      <h1 className="font-display font-bold text-2xl">{ride.name} is live</h1>
      <p className="text-sm text-asphalt-400 mt-1">Share this Ride ID with your riders.</p>

      <Card className="p-6 mt-6">
        <p className="font-mono font-bold text-3xl tracking-widest text-ember-400">{ride.code}</p>
        <div className="flex justify-center my-5">
          <img src={qrSrc} alt="Ride QR code" className="rounded-xl w-40 h-40 border border-asphalt-600" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ShareButton icon={copied ? <Check size={16} /> : <Copy size={16} />} label={copied ? 'Copied' : 'Copy ID'} onClick={copyId} />
          <ShareButton
            icon={<MessageCircle size={16} />}
            label="WhatsApp"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join my ride on Rider's Hub: ${ride.code} — ${shareUrl}`)}`, '_blank')}
          />
          <ShareButton
            icon={<Share2 size={16} />}
            label="Share"
            onClick={() => navigator.share?.({ title: ride.name, text: `Join my ride: ${ride.code}`, url: shareUrl }).catch(() => {})}
          />
        </div>
      </Card>

      <Button fullWidth size="lg" className="mt-6" onClick={() => navigate(`/ride/live/${ride.id}`)}>
        Go to Live Ride
      </Button>
    </div>
  );
}

function ShareButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 bg-asphalt-700 hover:bg-asphalt-600 rounded-xl py-3 text-xs font-medium text-asphalt-100">
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ember-500 text-asphalt-100 placeholder:text-asphalt-500';
