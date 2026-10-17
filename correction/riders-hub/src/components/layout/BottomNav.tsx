import { Home, Compass, MapPin, Users, User, Zap } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

const items = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/rides', icon: Compass, label: 'Rides' },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="relative glass border-t border-asphalt-600 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5 items-end">
          {items.slice(0, 2).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => navigate('/ride/start')}
              className="w-14 h-14 -mt-7 rounded-full bg-ember-500 flex items-center justify-center shadow-[0_10px_28px_-6px_rgba(255,77,28,0.7)] active:scale-95 transition-transform ember-pulse"
              aria-label="Start Ride"
            >
              <Zap size={24} className="text-white" fill="currentColor" />
            </button>
          </div>
          {items.slice(2).map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: typeof Home; label: string }) {
  return (
    <NavLink to={to} className="flex flex-col items-center gap-1 py-1">
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-ember-500' : 'text-asphalt-400'} />
          <span className={`text-[0.65rem] font-medium ${isActive ? 'text-ember-500' : 'text-asphalt-400'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}
