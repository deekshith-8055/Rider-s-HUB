import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MapPin, ShieldCheck, Users2, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { api, isDemoMode } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { locationService } from '../../services/location/locationService';
import { notificationService } from '../../services/notifications/notificationService';

const STEPS = ['welcome', 'account', 'profile', 'preferences', 'location', 'notifications', 'finish'] as const;
type Step = (typeof STEPS)[number];

const RIDING_STYLES = ['Touring', 'Adventure', 'Sport', 'Cruiser', 'Off-road', 'Long distance'];

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/email-already-in-use': 'An account already exists with that email — try logging in instead.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
  };
  return map[code] ?? "Couldn't create your account. Please check your details and try again.";
}

export function OnboardingFlow() {
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [styles, setStyles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useApp();

  const step: Step = STEPS[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const finish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.signUp(name.trim() || 'Rider', email, password);
      const updated = await api.updateProfile(user.id, { bio, preferences: { ridingStyle: styles } });
      setUser(updated);
      navigate('/home');
    } catch (err) {
      setError(friendlyAuthError(err));
      setStepIndex(STEPS.indexOf('account'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-asphalt-950 px-6 py-8">
      <div className="flex gap-1.5 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-ember-500' : 'bg-asphalt-700'}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full rise-fade" key={step}>
        {step === 'welcome' && (
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <Logo size={72} />
            </div>
            <h1 className="font-display font-bold text-3xl text-asphalt-100">RIDER'S HUB</h1>
            <p className="text-ember-400 font-medium mt-2">Every Road. Every Rider. One Hub.</p>
            <p className="text-asphalt-400 text-sm mt-5 leading-relaxed">
              Group rides, live tracking, and a community built for riders — motorcycles, scooters, tourers, and
              everything in between.
            </p>
          </div>
        )}

        {step === 'account' && (
          <div>
            <h2 className="font-display font-bold text-2xl mb-1">Create your account</h2>
            <p className="text-sm text-asphalt-400 mb-6">
              {isDemoMode ? 'This is a demo — no email verification needed.' : 'Sign up with your email to get started.'}
            </p>

            {error && (
              <div className="flex items-start gap-2 bg-signal-red/10 border border-signal-red/30 rounded-xl px-3.5 py-2.5 mb-4">
                <AlertCircle size={15} className="text-signal-red shrink-0 mt-0.5" />
                <p className="text-xs text-signal-red">{error}</p>
              </div>
            )}

            <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Reddy"
              className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
            />

            {!isDemoMode && (
              <>
                <label className="text-xs font-semibold text-asphalt-300 mb-1.5 mt-4 block">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
                />
                <label className="text-xs font-semibold text-asphalt-300 mb-1.5 mt-4 block">Password</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="At least 6 characters"
                  className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
                />
              </>
            )}
          </div>
        )}

        {step === 'profile' && (
          <div>
            <h2 className="font-display font-bold text-2xl mb-1">Tell riders about you</h2>
            <p className="text-sm text-asphalt-400 mb-6">Shown on your Rider's Hub profile.</p>
            <label className="text-xs font-semibold text-asphalt-300 mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What kind of riding do you love?"
              rows={4}
              className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500 resize-none"
            />
          </div>
        )}

        {step === 'preferences' && (
          <div>
            <h2 className="font-display font-bold text-2xl mb-1">Riding preferences</h2>
            <p className="text-sm text-asphalt-400 mb-6">Pick all that fit — helps us surface the right rides.</p>
            <div className="flex flex-wrap gap-2">
              {RIDING_STYLES.map((s) => {
                const active = styles.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setStyles((prev) => (active ? prev.filter((x) => x !== s) : [...prev, s]))}
                    className={`px-3.5 py-2 rounded-full text-sm border font-medium transition-colors ${
                      active ? 'bg-ember-500/15 border-ember-500 text-ember-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-300'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'location' && (
          <PermissionStep
            icon={<MapPin size={26} />}
            title="Enable location"
            body="Rider's Hub uses live GPS to show you on the group ride map and route you to your destination."
            onAllow={() => locationService.start()}
          />
        )}

        {step === 'notifications' && (
          <PermissionStep
            icon={<Bell size={26} />}
            title="Turn on notifications"
            body="Get alerted when a ride starts, a rider joins, or someone triggers an emergency alert."
            onAllow={() => notificationService.requestBrowserPermission()}
          />
        )}

        {step === 'finish' && (
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gps-500/15 border border-gps-500/40 flex items-center justify-center mb-5">
              <Users2 className="text-gps-400" size={32} />
            </div>
            <h2 className="font-display font-bold text-2xl">You're all set, {name || 'Rider'}</h2>
            <p className="text-sm text-asphalt-400 mt-2">Time to find your first ride.</p>
          </div>
        )}
      </div>

      <div className="max-w-sm mx-auto w-full flex gap-3 mt-8">
        {stepIndex > 0 && (
          <Button variant="secondary" onClick={back} className="flex-1">
            Back
          </Button>
        )}
        <Button onClick={step === 'finish' ? finish : next} className="flex-1" disabled={submitting}>
          {step === 'finish' ? (submitting ? 'Setting up…' : "Enter Rider's Hub") : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

function PermissionStep({
  icon,
  title,
  body,
  onAllow,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onAllow: () => void;
}) {
  const [allowed, setAllowed] = useState(false);
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-ember-500/15 border border-ember-500/40 flex items-center justify-center mb-5 text-ember-400">
        {icon}
      </div>
      <h2 className="font-display font-bold text-2xl">{title}</h2>
      <p className="text-sm text-asphalt-400 mt-2 mb-5">{body}</p>
      <button
        onClick={() => {
          onAllow();
          setAllowed(true);
        }}
        className={`text-sm font-semibold rounded-xl px-4 py-2.5 border ${
          allowed ? 'bg-gps-500/15 border-gps-500 text-gps-400' : 'bg-asphalt-800 border-asphalt-600 text-asphalt-100'
        }`}
      >
        {allowed ? (
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={15} /> Allowed
          </span>
        ) : (
          'Allow'
        )}
      </button>
    </div>
  );
}
