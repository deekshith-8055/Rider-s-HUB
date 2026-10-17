import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, Siren, MapPinOff } from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Overlays';
import { locationService } from '../../services/location/locationService';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { distanceKm, formatDistance, formatDuration } from '../../utils/format';
import type { GeoPoint, LocationState } from '../../types';

export function SoloRideScreen() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [tracking, setTracking] = useState(false);
  const [route, setRoute] = useState<GeoPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [gpsState, setGpsState] = useState<LocationState>(locationService.getState());
  const [hasFix, setHasFix] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!tracking) return;
    locationService.setActiveMode(true);
    locationService.start();

    const unsub = locationService.onSample((sample) => {
      setHasFix(true);
      setRoute((prev) => {
        const point = { lat: sample.lat, lng: sample.lng };
        if (prev.length > 0) setDistance((d) => d + distanceKm(prev[prev.length - 1], point));
        return [...prev, point];
      });
      setSpeed(sample.speedKmh);
      setMaxSpeed((m) => Math.max(m, sample.speedKmh));
    });
    const unsubState = locationService.onStateChange(setGpsState);

    tickRef.current = setInterval(() => setElapsedMs((e) => e + 1000), 1000);

    return () => {
      unsub();
      unsubState();
      locationService.stop();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [tracking]);

  const start = () => {
    setTracking(true);
    setStartedAt(Date.now());
    setRoute([]);
    setDistance(0);
    setMaxSpeed(0);
    setElapsedMs(0);
    setHasFix(false);
  };

  const end = async () => {
    setTracking(false);
    if (!user) return;
    const durationMinutes = elapsedMs / 60000 || 1;
    const summary = await api.endRide('solo', {
      name: 'Solo Ride',
      distanceKm: Math.round(distance * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      avgSpeedKmh: Math.round(distance / Math.max(durationMinutes / 60, 0.05)),
      maxSpeedKmh: Math.round(maxSpeed),
      riderCount: 1,
      startedAt: startedAt ?? Date.now(),
      endedAt: Date.now(),
      route,
      stops: 0,
      origin: 'Start point',
      destination: 'Current location',
    });
    navigate(`/ride/summary/${summary.id}`, { state: { summary } });
  };

  const avgSpeed = elapsedMs > 0 ? distance / (elapsedMs / 3600000) : 0;
  const gpsBlocked = tracking && !hasFix && (gpsState === 'denied' || gpsState === 'unavailable');

  return (
    <div className="relative h-screen flex flex-col">
      <div className="absolute inset-0">
        <MapView route={route} showControls={!tracking} />
      </div>

      <div className="relative z-30 flex items-center gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl glass border border-asphalt-600 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="glass border border-asphalt-600 rounded-xl px-4 py-2">
          <p className="text-sm font-display font-semibold">Solo Ride</p>
        </div>
      </div>

      {gpsBlocked && (
        <div className="relative z-30 mx-4 mt-3 rise-fade">
          <div className="glass border border-signal-red/40 rounded-2xl px-4 py-3 flex items-start gap-3">
            <MapPinOff size={18} className="text-signal-red shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-asphalt-100">
                {gpsState === 'denied' ? 'Location permission denied' : 'GPS unavailable on this device'}
              </p>
              <p className="text-xs text-asphalt-300 mt-0.5">
                {gpsState === 'denied'
                  ? 'Enable location access in your browser settings, then try again.'
                  : "This browser/device doesn't support live GPS tracking."}
              </p>
            </div>
            <button onClick={() => locationService.retry()} className="text-xs font-semibold text-ember-400 shrink-0 mt-0.5">
              Retry
            </button>
          </div>
        </div>
      )}

      {tracking && !hasFix && !gpsBlocked && (
        <div className="relative z-30 mx-4 mt-3 rise-fade">
          <div className="glass border border-asphalt-600 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 border-2 border-asphalt-500 border-t-gps-400 rounded-full animate-spin shrink-0" />
            <p className="text-xs text-asphalt-300">Waiting for a GPS signal…</p>
          </div>
        </div>
      )}

      <div className="relative z-30 mt-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        {tracking && (
          <div className="glass border border-asphalt-600 rounded-2xl p-4 mb-3 grid grid-cols-4 gap-2 text-center">
            <Stat value={formatDistance(distance)} label="Distance" />
            <Stat value={formatDuration(elapsedMs / 60000)} label="Duration" />
            <Stat value={`${Math.round(speed)}`} label="km/h" />
            <Stat value={`${Math.round(avgSpeed)}`} label="Avg km/h" />
          </div>
        )}
        <div className="glass border border-asphalt-600 rounded-2xl p-3 flex items-center gap-2">
          {!tracking ? (
            <Button fullWidth size="lg" icon={<Play size={18} />} onClick={start}>
              Start GPS Tracking
            </Button>
          ) : (
            <Button fullWidth size="lg" variant="danger" icon={<Square size={18} />} onClick={end}>
              End Ride
            </Button>
          )}
          <button
            onClick={() => setEmergencyOpen(true)}
            className="w-14 h-14 rounded-2xl bg-signal-red flex items-center justify-center shrink-0 ember-pulse"
          >
            <Siren size={20} className="text-white" />
          </button>
        </div>
      </div>

      <Modal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Emergency assistance">
        <p className="text-sm text-asphalt-300 mb-5">
          Are you sure you need emergency assistance? Your live location and recent route will be shared with your
          emergency contacts. For immediate danger, call local emergency services directly.
        </p>
        <div className="space-y-2">
          <Button variant="danger" fullWidth onClick={() => setEmergencyOpen(false)}>
            Share Location & Alert Contacts
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setEmergencyOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display font-bold text-lg text-ember-400">{value}</p>
      <p className="text-[0.6rem] uppercase tracking-wide text-asphalt-400">{label}</p>
    </div>
  );
}
