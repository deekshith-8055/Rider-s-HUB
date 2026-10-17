import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Globe, Smartphone, AlertCircle } from 'lucide-react';
import { Logo } from '../../components/brand/Logo';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { isDemoMode } from '../../services/api';

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with that email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
    'auth/network-request-failed': 'Network error — check your connection and try again.',
    'auth/missing-password': 'Please enter your password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/user-disabled': 'This account has been disabled.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const afterLogin = from?.pathname && from.pathname !== '/login' ? `${from.pathname}${from.search ?? ''}` : '/home';
  const { setUser } = useApp();

  const validate = (): string | null => {
    if (mode === 'signup' && !name.trim()) return 'Please enter your full name.';
    if (!email.trim()) return 'Please enter your email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'That email address looks invalid.';
    if (!password) return 'Please enter your password.';
    if (mode === 'signup' && password.length < 6) return 'Password should be at least 6 characters.';
    return null;
  };

  const handleAuth = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === 'login'
          ? await api.signIn(email.trim(), password)
          : await api.signUp(name.trim(), email.trim(), password);
      setUser(user);
      navigate(afterLogin, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.signInWithGoogle();
      setUser(user);
      navigate(afterLogin, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 bg-asphalt-950">
      <div className="max-w-sm mx-auto w-full">
        <div className="flex justify-center mb-8">
          <Logo size={64} />
        </div>
        <h1 className="font-display font-bold text-2xl text-center">Welcome back</h1>
        <p className="text-sm text-asphalt-400 text-center mt-1 mb-8">
          {isDemoMode ? 'Demo mode — create an account once; this browser will remember you.' : 'Sign in to continue your ride.'}
        </p>

        {error && (
          <div className="flex items-start gap-2 bg-signal-red/10 border border-signal-red/30 rounded-xl px-3.5 py-2.5 mb-4">
            <AlertCircle size={15} className="text-signal-red shrink-0 mt-0.5" />
            <p className="text-xs text-signal-red">{error}</p>
          </div>
        )}

        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleAuth();
          }}
        >
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              name="name"
              autoComplete="name"
              className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full bg-asphalt-800 border border-asphalt-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-ember-500"
          />
          <Button type="submit" fullWidth size="lg" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-asphalt-700 flex-1" />
          <span className="text-xs text-asphalt-500">or</span>
          <div className="h-px bg-asphalt-700 flex-1" />
        </div>

        <div className="space-y-2.5">
          <Button type="button" variant="secondary" fullWidth icon={<Globe size={17} />} onClick={handleGoogle} disabled={submitting}>
            Continue with Google
          </Button>
          <Button type="button" variant="secondary" fullWidth icon={<Smartphone size={17} />} onClick={handleGoogle} disabled={submitting}>
            Continue with phone number
          </Button>
        </div>

        <p className="text-center text-sm text-asphalt-400 mt-8">
          {mode === 'login' ? "New to Rider's Hub?" : 'Already riding with us?'}{' '}
          <button
            className="text-ember-500 font-semibold"
            onClick={() => {
              setError(null);
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>

        {mode === 'signup' && (
          <p className="text-center text-xs text-asphalt-500 mt-3">
            Prefer a guided setup with riding preferences?{' '}
            <button className="text-gps-400 font-semibold" onClick={() => navigate('/onboarding')}>
              Start onboarding
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
