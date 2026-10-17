import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, QrCode, Users, Calendar, Clock, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, Avatar } from '../../components/ui/Primitives';
import { api, isDemoMode } from '../../services/api';
import { useMyLocation } from '../../hooks/useMyLocation';
import { useRideSharing } from '../../context/RideSharingContext';
import { parseRideCode } from '../../utils/rideCode';
import { QrScannerModal } from '../../components/ride/QrScannerModal';
import { useApp } from '../../context/AppContext';
import { notificationService } from '../../services/notifications/notificationService';
import type { Ride, RideParticipant } from '../../types';

export function JoinRideScreen() {
  const { user } = useApp();
  const navigate = useNavigate();
  const { code: codeParam } = useParams();
  const { setCurrentRide } = useRideSharing();
  // Ask for GPS permission as soon as this screen opens (same as Start Ride does),
  // so the browser prompt appears BEFORE joining and sharing can begin immediately.
  const { permission, hasFix, retry } = useMyLocation();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [ride, setRide] = useState<Ride | null>(null);
  const [participants, setParticipants] = useState<RideParticipant[]>([]);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const search = async (raw: string = code) => {
    const normalized = parseRideCode(raw);
    if (!normalized) {
      setRide(null);
      setNotFound(false);
      setSearchError("That doesn't look like a Ride ID. It should look like RH-7K29XB.");
      return;
    }
    setCode(normalized);
    setSearching(true);
    setNotFound(false);
    setSearchError(null);
    try {
      const found = await api.getRideByCode(normalized);
      if (found) {
        setRide(found);
        setParticipants(await api.listParticipants(found.id));
      } else {
        setNotFound(true);
      }
    } catch (err) {
      // Surface the real error instead of leaving the screen looking stuck —
      // e.g. a Firestore permission-denied means the rules aren't deployed,
      // not that the code is wrong.
      // eslint-disable-next-line no-console
      console.error("[Rider's Hub] Ride lookup failed:", err);
      setSearchError(
        (err as { code?: string })?.code === 'permission-denied'
          ? "Couldn't retrieve that ride (permission denied). If you're the developer, check that firestore.rules has been deployed."
          : "Couldn't reach the server. Check your connection and try again."
      );
    } finally {
      setSearching(false);
    }
  };

  // Opened from a shared link / scanned QR (/join/:code): look the ride up straight away.
  const autoSearched = useRef(false);
  useEffect(() => {
    if (codeParam && !autoSearched.current) {
      autoSearched.current = true;
      setCode(codeParam.toUpperCase());
      void search(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const onScanned = (text: string) => {
    setScanning(false);
    void search(text);
  };

  const join = async () => {
    if (!ride || !user) return;
    setJoinError(null);
    // Joining is a tap, which browsers treat as a user gesture — re-request GPS now if it isn't on yet.
    if (permission !== 'granted') retry();
    try {
      await api.joinRide(ride.id, user);
      setCurrentRide(ride.id);
      notificationService.toast('Joined ride', `You're in for ${ride.name}.`, 'success');
      navigate(`/ride/live/${ride.id}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[Rider's Hub] Joining ride failed:", err);
      setJoinError("Couldn't join this ride. Check your connection and try again.");
    }
  };

  const leader = participants.find((p) => p.role === 'leader');

  return (
    <div className="px-4 md:px-6 py-4 rise-fade max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Join a Ride</h1>
      </div>

      <div
        className={`rounded-xl border px-3.5 py-2.5 mb-4 text-xs leading-snug flex items-start gap-2.5 ${
          permission === 'granted'
            ? 'border-gps-500/40 bg-gps-500/10 text-gps-400'
            : permission === 'denied' || permission === 'unavailable'
              ? 'border-signal-red/50 bg-signal-red/10 text-signal-red'
              : 'border-signal-amber/50 bg-signal-amber/10 text-signal-amber'
        }`}
      >
        <MapPin size={15} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          {permission === 'granted' ? (
            <p>{hasFix ? 'Location is on ✓ — your teammates will see you once you join.' : 'Location allowed — getting your GPS fix…'}</p>
          ) : permission === 'denied' ? (
            <>
              <p className="font-semibold">Location is blocked.</p>
              <p className="mt-0.5">
                Other riders can't see you without it. Tap the lock/location icon in your browser's address bar → allow Location → then press
                Retry.
              </p>
              <button onClick={retry} className="mt-1.5 font-semibold underline">Retry</button>
            </>
          ) : permission === 'unavailable' ? (
            <>
              <p className="font-semibold">Couldn't get a location signal.</p>
              <button onClick={retry} className="mt-1 font-semibold underline">Retry</button>
            </>
          ) : (
            <p>Please tap <b>Allow</b> when your browser asks for your location — it's needed so your team can see you on the map.</p>
          )}
        </div>
      </div>

      {!ride && (
        <>
          <p className="text-sm text-asphalt-400 mb-3">Enter the Ride ID your leader shared with you.</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && search()}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="RH-7K29X"
              className="flex-1 bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm font-mono tracking-widest outline-none focus:border-ember-500"
            />
            <Button onClick={() => search()} disabled={searching}>
              {searching ? '...' : 'Find'}
            </Button>
          </div>
          <button onClick={() => setScanning(true)} className="mt-4 flex items-center gap-2 text-sm text-gps-400 font-medium">
            <QrCode size={18} /> Scan QR code instead
          </button>
          {notFound && (
            <p className="text-sm text-signal-red mt-4">
              No ride found for that ID. Double check the code and try again.
              {isDemoMode && ' (Demo mode: rides only exist in the browser that created them.)'}
            </p>
          )}
          {isDemoMode && (
            <p className="text-xs text-signal-amber mt-4 leading-relaxed">
              Demo mode is on (no Firebase keys configured), so rides are stored only in this browser. To join a ride
              created on another phone or computer, add your Firebase keys to .env.
            </p>
          )}
          {searchError && <p className="text-sm text-signal-red mt-4">{searchError}</p>}
        </>
      )}

      {ride && (
        <Card className="p-5 mt-2">
          <h2 className="font-display font-bold text-xl">{ride.name}</h2>
          {leader && (
            <div className="flex items-center gap-2 mt-3">
              <Avatar name={leader.name} size={30} />
              <p className="text-sm text-asphalt-300">
                Led by <span className="text-asphalt-100 font-semibold">{leader.name}</span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm text-asphalt-300">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> {ride.date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} /> {ride.startTime}
            </span>
            <span className="flex items-center gap-1.5 col-span-2">
              <MapPin size={14} /> {ride.origin.label} → {ride.destination.label}
            </span>
            {ride.meetingPoint && (
              <span className="flex items-center gap-1.5 col-span-2">
                <MapPin size={14} className="text-gps-400" /> Meet at {ride.meetingPoint.label}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users size={14} /> {participants.length}/{ride.maxRiders} riders
            </span>
          </div>
          {ride.description && <p className="text-sm text-asphalt-400 mt-4 leading-relaxed">{ride.description}</p>}
          {joinError && <p className="text-sm text-signal-red mt-4">{joinError}</p>}

          <Button fullWidth size="lg" className="mt-6" onClick={join}>
            Join Ride
          </Button>
        </Card>
      )}
      <QrScannerModal open={scanning} onClose={() => setScanning(false)} onResult={onScanned} />
    </div>
  );
}
