import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Share2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Primitives';
import { MapView } from '../../components/map/MapView';
import { notificationService } from '../../services/notifications/notificationService';
import type { SavedRideSummary } from '../../types';
import { formatDistance, formatDuration } from '../../utils/format';

export function RideSummaryScreen() {
  const { summaryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const summary = (location.state as { summary?: SavedRideSummary })?.summary;
  const [phase, setPhase] = useState<'drawing' | 'revealed'>('drawing');

  useEffect(() => {
    const t = setTimeout(() => setPhase('revealed'), 1600);
    return () => clearTimeout(t);
  }, []);

  if (!summary) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-asphalt-400">Ride summary not found for {summaryId}.</p>
        <Button className="mt-4" onClick={() => navigate('/home')}>
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-4 max-w-lg mx-auto rise-fade">
      <button onClick={() => navigate('/home')} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800 mb-2">
        <ArrowLeft size={20} />
      </button>

      <div className="h-56 rounded-2xl overflow-hidden border border-asphalt-600 relative">
        <MapView route={summary.route} showMyLocation={false} showControls={false} />
        {phase === 'revealed' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-asphalt-950/55 rise-fade">
            <span className="text-4xl">🏁</span>
            <p className="font-display font-bold text-xl mt-1 tracking-wide">RIDE COMPLETED</p>
          </div>
        )}
      </div>

      {phase === 'revealed' && (
        <div className="rise-fade">
          <div className="grid grid-cols-3 gap-3 mt-5">
            <BigStat value={formatDistance(summary.distanceKm)} label="Distance" />
            <BigStat value={formatDuration(summary.durationMinutes)} label="Duration" />
            <BigStat value={`${summary.riderCount}`} label="Riders" />
          </div>

          <Card className="p-4 mt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Row label="Route" value={`${summary.origin} → ${summary.destination}`} />
              <Row label="Avg speed" value={`${summary.avgSpeedKmh} km/h`} />
              <Row label="Max speed" value={`${summary.maxSpeedKmh} km/h`} />
              <Row label="Stops" value={`${summary.stops}`} />
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <Button
              variant="secondary"
              icon={<Share2 size={16} />}
              onClick={() => notificationService.toast('Ride shared', 'A shareable summary link was copied.', 'success')}
            >
              Share Ride
            </Button>
            <Button icon={<Save size={16} />} onClick={() => navigate('/profile')}>
              Save & View Profile
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center bg-asphalt-800 border border-asphalt-600 rounded-2xl py-4">
      <p className="font-display font-bold text-xl text-ember-400">{value}</p>
      <p className="text-[0.65rem] uppercase tracking-wider text-asphalt-400 mt-1">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-asphalt-400">{label}</p>
      <p className="font-medium text-asphalt-100">{value}</p>
    </div>
  );
}
