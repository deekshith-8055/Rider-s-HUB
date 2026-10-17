import { Home, Compass, MapPin, Users, User, Zap, ShieldCheck, Store, CalendarDays } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Logo } from '../brand/Logo';

const items = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/rides', icon: Compass, label: 'Rides' },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/events', icon: CalendarDays, label: 'Events' },
  { to: '/business', icon: Store, label: 'Businesses' },
  { to: '/profile', icon: User, label: 'Profile' },
  { to: '/admin', icon: ShieldCheck, label: 'Admin' },
];

export function Sidebar() {
  const navigate = useNavigate();
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-asphalt-700 bg-asphalt-900 px-4 py-6">
      <div className="px-2 mb-8">
        <Logo withWordmark />
        <p className="text-[0.68rem] text-asphalt-400 mt-1 pl-0.5">Every Road. Every Rider. One Hub.</p>
      </div>

      <button
        onClick={() => navigate('/ride/start')}
        className="flex items-center gap-2 justify-center bg-ember-500 hover:bg-ember-400 text-white font-semibold rounded-xl py-3 mb-6 shadow-[0_8px_24px_-8px_rgba(255,77,28,0.6)] active:scale-[0.98] transition-transform"
      >
        <Zap size={18} fill="currentColor" /> Start Ride
      </button>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-asphalt-800 text-ember-500' : 'text-asphalt-300 hover:bg-asphalt-800/60 hover:text-asphalt-100'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4 text-[0.65rem] text-asphalt-500 px-2">Rider's Hub v1.0 · Demo build</div>
    </aside>
  );
}
