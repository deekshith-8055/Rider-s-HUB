import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Bell, Wifi, LogOut, Stethoscope } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Primitives';
import { useApp } from '../../context/AppContext';
import { api, isDemoMode } from '../../services/api';
import { locationService } from '../../services/location/locationService';
import { notificationService } from '../../services/notifications/notificationService';
import { offlineSyncService } from '../../services/offline/offlineSyncService';
import { runBackendDiagnostics, type DiagnosticResult } from '../../services/firebase/diagnostics';

export function SettingsScreen() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [queueSize, setQueueSize] = useState(offlineSyncService.size);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[] | null>(null);

  useEffect(() => offlineSyncService.onChange((q) => setQueueSize(q.length)), []);

  const save = async () => {
    if (!user) return;
    const updated = await api.updateProfile(user.id, { name, bio });
    setUser(updated);
    notificationService.toast('Profile updated', undefined, 'success');
  };

  const signOut = async () => {
    await api.signOut();
    setUser(null);
    navigate('/login');
  };

  const diagnose = async () => {
    setRunningDiagnostics(true);
    setDiagnosticResults(null);
    try {
      const results = await runBackendDiagnostics();
      setDiagnosticResults(results);
      const passCount = results.filter((r) => r.ok).length;
      notificationService.toast(
        `Diagnostics: ${passCount}/${results.length} passed`,
        'Full details are in the browser console.',
        passCount === results.length ? 'success' : 'warning'
      );
    } finally {
      setRunningDiagnostics(false);
    }
  };

  if (!user) return null;

  return (
    <div className="px-4 md:px-6 py-4 max-w-lg mx-auto rise-fade">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg hover:bg-asphalt-800">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-bold text-xl">Settings</h1>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-asphalt-700 border border-asphalt-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ember-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-asphalt-700 border border-asphalt-600 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-ember-500 resize-none" />
        </div>
        <Button onClick={save}>Save Changes</Button>
      </Card>

      <h2 className="font-display font-semibold text-lg mt-6 mb-3">Permissions</h2>
      <Card className="p-4 space-y-3">
        <PermissionRow icon={<MapPin size={16} />} label="Location access" status={locationService.getState()} onAllow={() => locationService.start()} />
        <PermissionRow
          icon={<Bell size={16} />}
          label="Notifications"
          status={typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'}
          onAllow={() => notificationService.requestBrowserPermission()}
        />
      </Card>

      <h2 className="font-display font-semibold text-lg mt-6 mb-3">Sync</h2>
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-gps-400" />
          <p className="text-sm text-asphalt-200">Offline queue</p>
        </div>
        <span className="text-sm font-mono text-asphalt-300">{queueSize} pending</span>
      </Card>

      {isDemoMode && (
        <p className="text-xs text-asphalt-500 mt-4 text-center">
          Running in Demo Mode — connect Firebase in .env to switch to production data.
        </p>
      )}

      <h2 className="font-display font-semibold text-lg mt-6 mb-3">Backend diagnostics</h2>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-asphalt-200">
            <Stethoscope size={16} />
            Test Auth, Firestore &amp; Realtime Database
          </div>
          <Button size="sm" variant="secondary" onClick={diagnose} disabled={runningDiagnostics}>
            {runningDiagnostics ? 'Running…' : 'Run Diagnostics'}
          </Button>
        </div>
        {diagnosticResults && (
          <div className="mt-3 pt-3 border-t border-asphalt-700 space-y-1.5">
            {diagnosticResults.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={r.ok ? 'text-signal-green' : 'text-signal-red'}>{r.ok ? '✓' : '✗'}</span>
                <div>
                  <p className="text-asphalt-200 font-medium">{r.label}</p>
                  <p className="text-asphalt-400">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button variant="danger" fullWidth icon={<LogOut size={16} />} className="mt-6" onClick={signOut}>
        Sign Out
      </Button>
    </div>
  );
}

function PermissionRow({ icon, label, status, onAllow }: { icon: React.ReactNode; label: string; status: string; onAllow: () => void }) {
  const granted = status === 'granted';
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-asphalt-200">
        {icon} {label}
      </div>
      <button
        onClick={onAllow}
        className={`text-xs font-semibold px-3 py-1.5 rounded-full ${granted ? 'bg-gps-500/15 text-gps-400' : 'bg-asphalt-700 text-asphalt-300'}`}
      >
        {granted ? 'Allowed' : 'Allow'}
      </button>
    </div>
  );
}
