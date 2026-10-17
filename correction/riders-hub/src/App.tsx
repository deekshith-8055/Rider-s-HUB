import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { RideSharingProvider } from './context/RideSharingContext';
import { AppShell } from './components/layout/AppShell';
import { Logo } from './components/brand/Logo';

import { OnboardingFlow } from './screens/onboarding/OnboardingFlow';
import { LoginScreen } from './screens/auth/LoginScreen';
import { HomeScreen } from './screens/home/HomeScreen';
import { RidesScreen } from './screens/ride/RidesScreen';
import { StartRideScreen } from './screens/ride/StartRideScreen';
import { JoinRideScreen } from './screens/ride/JoinRideScreen';
import { LiveRideScreen } from './screens/ride/LiveRideScreen';
import { RideSummaryScreen } from './screens/ride/RideSummaryScreen';
import { SoloRideScreen } from './screens/solo/SoloRideScreen';
import { MapScreen } from './screens/map/MapScreen';
import { CommunityScreen } from './screens/community/CommunityScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { BusinessRegisterScreen } from './screens/business/BusinessRegisterScreen';
import { BusinessDashboardScreen } from './screens/business/BusinessDashboardScreen';
import { EventsScreen } from './screens/events/EventsScreen';
import { AdminScreen } from './screens/admin/AdminScreen';
import { NotificationsScreen } from './screens/notifications/NotificationsScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-asphalt-950 gap-4">
      <div className="relative">
        <span className="gps-pulse absolute inset-0 opacity-60" />
        <Logo size={56} />
      </div>
      <p className="text-xs font-mono text-asphalt-500 tracking-widest">LOADING RIDER'S HUB…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Guards /login and /onboarding: an already-authenticated rider should never see these again. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const location = useLocation();
  if (loading) return <Splash />;
  if (user) {
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
    const target = from?.pathname && from.pathname !== '/login' ? `${from.pathname}${from.search ?? ''}` : '/home';
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useApp();
  if (loading) return <Splash />;
  return <Navigate to={user ? '/home' : '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/onboarding" element={<RedirectIfAuthed><OnboardingFlow /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><LoginScreen /></RedirectIfAuthed>} />

      <Route path="/ride/live/:rideId" element={<RequireAuth><LiveRideScreen /></RequireAuth>} />
      <Route path="/ride/summary/:summaryId" element={<RequireAuth><RideSummaryScreen /></RequireAuth>} />
      <Route path="/ride/solo" element={<RequireAuth><SoloRideScreen /></RequireAuth>} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/rides" element={<RidesScreen />} />
        <Route path="/ride/start" element={<StartRideScreen />} />
        <Route path="/ride/join" element={<JoinRideScreen />} />
        <Route path="/join/:code" element={<JoinRideScreen />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/community" element={<CommunityScreen />} />
        <Route path="/events" element={<EventsScreen />} />
        <Route path="/business" element={<BusinessDashboardScreen />} />
        <Route path="/business/register" element={<BusinessRegisterScreen />} />
        <Route path="/business/dashboard" element={<BusinessDashboardScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "Rider's Hub — Every Road. Every Rider. One Hub.";
  }, []);
  return (
    <BrowserRouter>
      <AppProvider>
        <RideSharingProvider>
          <AppRoutes />
        </RideSharingProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
