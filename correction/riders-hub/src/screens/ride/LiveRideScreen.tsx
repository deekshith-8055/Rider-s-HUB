import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Siren,
  Play,
  Pause,
  Flag,
  Megaphone,
  X,
  Send,
} from 'lucide-react';
import { MapView } from '../../components/map/MapView';
import type { MapRiderInput } from '../../components/map/types';
import { BottomSheet, Modal } from '../../components/ui/Overlays';
import { Button } from '../../components/ui/Button';
import { Avatar, Badge } from '../../components/ui/Primitives';
import { StatusSelector, STATUS_META, EmergencyButton } from '../../components/ui/Controls';
import { useApp } from '../../context/AppContext';
import { useRideSharing } from '../../context/RideSharingContext';
import { usePlannedRoute } from '../../hooks/usePlannedRoute';
import { useRideLocations, useRideParticipants, useRideMessages, useRideEvents } from '../../hooks/useRideChannel';
import { api } from '../../services/api';
import { locationService } from '../../services/location/locationService';
import { offlineSyncService } from '../../services/offline/offlineSyncService';
import { notificationService } from '../../services/notifications/notificationService';
import type { Ride, RiderRideStatus } from '../../types';
import { distanceKm, formatDistance, formatTimeAgo } from '../../utils/format';

const QUICK_MESSAGES = [
  'Wait for me',
  'Stopping for fuel',
  'Need help',
  'Road blocked',
  'Slow down',
  'Taking a break',
  'Reached destination',
  'Mechanical problem',
];

export function LiveRideScreen() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const [ride, setRide] = useState<Ride | null>(null);
  const [sheet, setSheet] = useState<'none' | 'riders' | 'messages' | 'status' | 'leader'>('none');
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<RiderRideStatus>('riding');
  const [messageDraft, setMessageDraft] = useState('');
  // Real distance/speed tracking for this ride, built entirely from actual
  // GPS samples (same accumulation approach as SoloRideScreen) — used at
  // ride-end instead of any placeholder/random numbers.
  const [myTrail, setMyTrail] = useState<{ lat: number; lng: number }[]>([]);
  const [myDistanceKm, setMyDistanceKm] = useState(0);
  const [myMaxSpeedKmh, setMyMaxSpeedKmh] = useState(0);

  const { activeRide: sharedRide, sharing, setCurrentRide } = useRideSharing();
  const globallyShared = sharing && sharedRide?.id === rideId;
  const globallySharedRef = useRef(globallyShared);
  globallySharedRef.current = globallyShared;
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;
  const locations = useRideLocations(rideId);
  const participants = useRideParticipants(rideId);
  const messages = useRideMessages(rideId);
  const events = useRideEvents(rideId);

  useEffect(() => {
    if (rideId) setCurrentRide(rideId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    api.getRide(rideId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[Rider's Hub] Failed to load ride ${rideId}:`, err);
      return null;
    }).then(setRide);
  }, [rideId]);

  // Push own real GPS location to the ride's live location channel.
  useEffect(() => {
    if (!rideId || !user) return;
    locationService.setActiveMode(true);
    locationService.start();

    offlineSyncService.registerHandler(async (item) => {
      if (item.kind === 'location') await api.pushLocation(item.payload as any);
    });

    const unsub = locationService.onSample((sample) => {
      // The app-wide sharer already publishes this rider's GPS for their current
      // ride; only publish from here if it isn't covering this ride (avoids double writes).
      if (!globallySharedRef.current && sharingRef.current) {
        const payload = { userId: user.id, rideId, name: user.name, ...sample, isOnline: true };
        if (navigator.onLine) api.pushLocation(payload);
        else offlineSyncService.enqueue('location', payload);
      }

      // Accumulate this rider's real distance/speed/route from actual fixes.
      const point = { lat: sample.lat, lng: sample.lng };
      setMyTrail((prev) => {
        if (prev.length > 0) setMyDistanceKm((d) => d + distanceKm(prev[prev.length - 1], point));
        return [...prev, point];
      });
      setMyMaxSpeedKmh((m) => Math.max(m, sample.speedKmh));
    });

    const unsubState = locationService.onStateChange((state) => {
      if (state === 'denied') {
        notificationService.toast(
          'Location access is off',
          "Other riders won't see your live position until you enable location permission.",
          'warning'
        );
      } else if (state === 'unavailable') {
        notificationService.toast('GPS unavailable', "Your device doesn't support live location tracking.", 'warning');
      }
    });

    return () => {
      unsub();
      unsubState();
      locationService.stop();
    };
  }, [rideId, user]);

  const mapRiders: MapRiderInput[] = useMemo(() => {
    return locations.map((loc) => {
      const p = participants.find((pp) => pp.userId === loc.userId);
      return {
        userId: loc.userId,
        // Prefer the Firestore participant record's name, then the name
        // embedded directly in the live-location payload (see
        // LiveLocation.name), and only fall back to the raw ID as a last
        // resort — keeps a rider correctly labeled even if their
        // participant doc hasn't loaded yet or predates this fix.
        name: p?.name ?? loc.name ?? loc.userId,
        photoUrl: p?.photoUrl,
        location: loc,
        isLeader: p?.role === 'leader' || (!!ride && loc.userId === ride.leaderId),
        isSelf: loc.userId === user?.id,
        status: p?.status,
      };
    });
  }, [locations, participants, user, ride]);

  // Planned road route from the ride's real start to its real destination.
  const { route: plannedRoute } = usePlannedRoute(ride?.origin, ride?.destination);

  // Every rider who has JOINED, whether or not their GPS has reported yet.
  const roster = useMemo(
    () =>
      participants.map((p) => {
        const loc = locations.find((l) => l.userId === p.userId);
        return {
          userId: p.userId,
          name: p.userId === user?.id ? 'You' : p.name,
          fullName: p.name,
          photoUrl: p.photoUrl,
          isLeader: p.role === 'leader' || p.userId === ride?.leaderId,
          hasLocation: !!loc,
          live: !!loc && Date.now() - loc.timestamp < 30000,
        };
      }),
    [participants, locations, user, ride]
  );

  const isLeader = ride?.leaderId === user?.id;
  const selfLoc = locations.find((l) => l.userId === user?.id);
  const selectedInfo = useMemo(() => {
    if (!selectedRider) return null;
    const loc = locations.find((l) => l.userId === selectedRider);
    if (!loc) return null;
    const p = participants.find((pp) => pp.userId === selectedRider);
    const dist = selfLoc ? distanceKm(selfLoc, loc) : null;
    const name = p?.name ?? loc.name ?? selectedRider;
    return { loc, name, photoUrl: p?.photoUrl, dist };
  }, [selectedRider, locations, participants, selfLoc]);

  if (!ride || !user) return null;

  const updateStatus = async (s: RiderRideStatus) => {
    setMyStatus(s);
    await api.updateRiderStatus(ride.id, user.id, s);
    notificationService.toast(`Status updated`, `${STATUS_META[s].emoji} ${STATUS_META[s].label}`, 'info');
    setSheet('none');
  };

  const sendQuick = async (text: string) => {
    await api.sendMessage({ rideId: ride.id, senderId: user.id, senderName: user.name, kind: 'quick', text });
  };

  const sendText = async () => {
    if (!messageDraft.trim()) return;
    await api.sendMessage({ rideId: ride.id, senderId: user.id, senderName: user.name, kind: 'text', text: messageDraft.trim() });
    setMessageDraft('');
  };

  const startRide = async () => {
    const updated = await api.startRide(ride.id);
    setRide(updated);
    await api.logEvent({ rideId: ride.id, type: 'ride_started', actorId: user.id, actorName: user.name });
    notificationService.toast('Ride started', 'Live tracking is now active for all riders.', 'success');
  };

  const pauseRide = async () => {
    const updated = await api.pauseRide(ride.id);
    setRide(updated);
    await api.logEvent({ rideId: ride.id, type: 'ride_paused', actorId: user.id, actorName: user.name });
  };

  const endRide = async () => {
    // Real stats only: accumulated from actual GPS samples during this ride
    // (see the location-tracking effect above) — never a placeholder/random
    // number, and never a fabricated start time.
    const durationMinutes = ride.startedAt ? (Date.now() - ride.startedAt) / 60000 : 0;
    const avgSpeedKmh = durationMinutes > 0 ? myDistanceKm / (durationMinutes / 60) : 0;
    const summary = await api.endRide(ride.id, {
      rideId: ride.id,
      name: ride.name,
      distanceKm: Math.round(myDistanceKm * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      avgSpeedKmh: Math.round(avgSpeedKmh),
      maxSpeedKmh: Math.round(myMaxSpeedKmh),
      riderCount: participants.length,
      startedAt: ride.startedAt ?? Date.now(),
      endedAt: Date.now(),
      route: myTrail.length > 0 ? myTrail : locations.map((l) => ({ lat: l.lat, lng: l.lng })),
      stops: events.filter((e) => e.type === 'status_update').length,
      origin: ride.origin.label,
      destination: ride.destination.label,
    });
    await api.logEvent({ rideId: ride.id, type: 'ride_ended', actorId: user.id, actorName: user.name });
    navigate(`/ride/summary/${summary.id}`, { state: { summary } });
  };

  const triggerEmergency = async () => {
    await api.updateRiderStatus(ride.id, user.id, 'emergency');
    await api.logEvent({ rideId: ride.id, type: 'emergency_triggered', actorId: user.id, actorName: user.name });
    await api.sendMessage({
      rideId: ride.id,
      senderId: user.id,
      senderName: user.name,
      kind: 'announcement',
      text: `🚨 ${user.name} triggered an emergency alert. Live location has been shared with the group.`,
    });
    notificationService.toast('Emergency alert sent', 'Ride members have been notified.', 'danger');
    setEmergencyOpen(false);
  };

  return (
    <div className="relative h-screen md:h-[calc(100vh-0px)] flex flex-col">
      {/* Map fills the screen */}
      <div className="absolute inset-0">
        <MapView
          // Other riders come from the live channel; *this* rider is drawn as
          // the instant, heading-aware pointer straight from the device GPS
          // (no network round-trip), so exclude self from the remote markers.
          riders={mapRiders.filter((r) => !r.isSelf)}
          route={plannedRoute?.path}
          origin={ride.origin}
          destination={ride.destination}
          meetingPoint={ride.meetingPoint}
          onRiderClick={setSelectedRider}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between gap-2 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl glass border border-asphalt-600 flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <div className="glass border border-asphalt-600 rounded-xl px-4 py-2 text-center">
          <p className="text-sm font-display font-semibold leading-tight">{ride.name}</p>
          <RideStatusPill status={ride.status} />
        </div>
        <button onClick={() => setSheet('riders')} className="w-10 h-10 rounded-xl glass border border-asphalt-600 flex items-center justify-center relative">
          <Users size={17} />
          <span className="absolute -top-1 -right-1 bg-gps-500 text-asphalt-950 text-[0.6rem] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {participants.length}
          </span>
        </button>
      </div>

      {/* Everyone who joined this ride */}
      {roster.length > 0 && (
        <div className="relative z-30 px-4 mt-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {roster.map((r) => (
              <button
                key={r.userId}
                onClick={() => r.hasLocation && setSelectedRider(r.userId)}
                className={`shrink-0 flex items-center gap-1.5 glass border rounded-full pl-1 pr-3 py-1 ${
                  r.live ? 'border-gps-500/60' : 'border-asphalt-600'
                }`}
                aria-label={`${r.fullName}${r.hasLocation ? '' : ' (waiting for GPS)'}`}
              >
                <Avatar name={r.fullName} photoUrl={r.photoUrl} size={24} />
                <span className="text-xs font-semibold">{r.name}{r.isLeader ? ' ★' : ''}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${r.live ? 'bg-gps-400' : r.hasLocation ? 'bg-signal-amber' : 'bg-asphalt-500'}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected rider info card */}
      {selectedInfo && (
        <div className="absolute z-30 left-1/2 -translate-x-1/2 top-36 w-[88%] max-w-xs rise-fade">
          <div className="glass border border-asphalt-600 rounded-2xl p-4 flex items-center gap-3">
            <Avatar name={selectedInfo.name} photoUrl={selectedInfo.photoUrl} size={44} online />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{selectedInfo.name}</p>
              <p className="text-xs text-asphalt-300">
                {Math.round(selectedInfo.loc.speedKmh)} km/h
                {selectedInfo.dist !== null && <> · {formatDistance(selectedInfo.dist)} away</>}
              </p>
              <p className="text-[0.65rem] text-gps-400 mt-0.5">
                {Date.now() - selectedInfo.loc.timestamp < 15000 ? 'LIVE' : `Last seen ${formatTimeAgo(selectedInfo.loc.timestamp)}`}
              </p>
            </div>
            <button onClick={() => setSelectedRider(null)} className="text-asphalt-400">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="relative z-30 mt-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <div className="glass border border-asphalt-600 rounded-2xl p-3 flex items-center justify-between gap-2">
          <button onClick={() => setSheet('status')} className="flex items-center gap-1.5 bg-asphalt-800/80 rounded-xl px-3 py-2.5 text-sm font-medium">
            <span>{STATUS_META[myStatus].emoji}</span> {STATUS_META[myStatus].label}
          </button>
          <button onClick={() => setSheet('messages')} className="w-11 h-11 rounded-xl bg-asphalt-800/80 flex items-center justify-center relative">
            <MessageSquare size={18} />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-ember-500 text-white text-[0.6rem] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
          {isLeader && (
            <button onClick={() => setSheet('leader')} className="w-11 h-11 rounded-xl bg-asphalt-800/80 flex items-center justify-center">
              <Megaphone size={18} />
            </button>
          )}
          <EmergencyButton size="sm" onTrigger={() => setEmergencyOpen(true)} />
        </div>
      </div>

      {/* Riders sheet */}
      <BottomSheet open={sheet === 'riders'} onClose={() => setSheet('none')} title={`Riders (${participants.length})`}>
        <div className="space-y-2.5">
          {participants.map((p) => {
            const loc = locations.find((l) => l.userId === p.userId);
            return (
              <div key={p.userId} className="flex items-center gap-3 bg-asphalt-700/50 rounded-xl p-3">
                <Avatar name={p.name} photoUrl={p.photoUrl} size={38} online={!!loc && Date.now() - loc.timestamp < 15000} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    {p.name} {p.role === 'leader' && <Badge variant="ember">Leader</Badge>}
                  </p>
                  <p className="text-xs text-asphalt-400">
                    {STATUS_META[p.status].emoji} {STATUS_META[p.status].label}
                    {loc && <> · {Math.round(loc.speedKmh)} km/h</>}
                  </p>
                </div>
                {isLeader && p.userId !== user.id && (
                  <button
                    onClick={async () => {
                      // No manual refetch needed — subscribeToParticipants
                      // (useRideParticipants) picks this up in real time.
                      await api.removeParticipant(ride.id, p.userId, user.id);
                    }}
                    className="text-xs text-signal-red font-semibold"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Status sheet */}
      <BottomSheet open={sheet === 'status'} onClose={() => setSheet('none')} title="Update your status">
        <StatusSelector current={myStatus} onSelect={updateStatus} />
      </BottomSheet>

      {/* Messages sheet */}
      <BottomSheet open={sheet === 'messages'} onClose={() => setSheet('none')} title="Ride chat">
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_MESSAGES.map((m) => (
            <button key={m} onClick={() => sendQuick(m)} className="text-xs font-medium bg-asphalt-700 hover:bg-asphalt-600 rounded-full px-3 py-1.5">
              {m}
            </button>
          ))}
        </div>
        <div className="space-y-2.5 max-h-64 overflow-y-auto mb-3">
          {messages.length === 0 && <p className="text-sm text-asphalt-400 text-center py-6">No messages yet — send a quick update.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`rounded-xl px-3.5 py-2.5 text-sm ${m.kind === 'announcement' ? 'bg-ember-500/10 border border-ember-500/30' : 'bg-asphalt-700/50'}`}>
              <p className="text-xs font-semibold text-gps-400 mb-0.5">{m.senderName}</p>
              <p className="text-asphalt-100">{m.text}</p>
              <p className="text-[0.62rem] text-asphalt-500 mt-1">{formatTimeAgo(m.createdAt)}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
            placeholder="Type a message…"
            className="flex-1 bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ember-500"
          />
          <button onClick={sendText} className="w-11 h-11 rounded-xl bg-ember-500 flex items-center justify-center shrink-0">
            <Send size={17} className="text-white" />
          </button>
        </div>
      </BottomSheet>

      {/* Leader controls sheet */}
      <BottomSheet open={sheet === 'leader'} onClose={() => setSheet('none')} title="Ride leader controls">
        <div className="grid grid-cols-2 gap-2.5">
          {ride.status !== 'active' ? (
            <Button icon={<Play size={16} />} onClick={startRide}>
              Start Ride
            </Button>
          ) : (
            <Button variant="secondary" icon={<Pause size={16} />} onClick={pauseRide}>
              Pause Ride
            </Button>
          )}
          <Button
            variant="danger"
            icon={<Flag size={16} />}
            onClick={() => {
              setSheet('none');
              endRide();
            }}
          >
            End Ride
          </Button>
          <Button
            variant="secondary"
            className="col-span-2"
            icon={<Megaphone size={16} />}
            onClick={() => {
              const text = prompt('Announcement to all riders:');
              if (text) api.sendMessage({ rideId: ride.id, senderId: user.id, senderName: user.name, kind: 'announcement', text });
            }}
          >
            Send Announcement
          </Button>
        </div>
      </BottomSheet>

      {/* Emergency confirm modal */}
      <Modal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} title="Emergency assistance">
        <p className="text-sm text-asphalt-300 mb-5">
          Are you sure you need emergency assistance? This shares your live location with ride members and shows
          nearby help. Rider's Hub does not dispatch emergency services directly — for immediate danger, call local
          emergency services.
        </p>
        <div className="space-y-2">
          <Button variant="danger" fullWidth icon={<Siren size={16} />} onClick={triggerEmergency}>
            Confirm Emergency Alert
          </Button>
          <Button variant="secondary" fullWidth onClick={() => setEmergencyOpen(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function RideStatusPill({ status }: { status: Ride['status'] }) {
  const map: Record<Ride['status'], { label: string; variant: 'gps' | 'amber' | 'neutral' | 'red' }> = {
    scheduled: { label: 'Scheduled', variant: 'neutral' },
    active: { label: 'Live', variant: 'gps' },
    paused: { label: 'Paused', variant: 'amber' },
    completed: { label: 'Completed', variant: 'neutral' },
    cancelled: { label: 'Cancelled', variant: 'red' },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
