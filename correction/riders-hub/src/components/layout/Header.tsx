import { Bell, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Primitives';
import { useApp } from '../../context/AppContext';

export function Header({ unreadCount = 0 }: { unreadCount?: number }) {
  const { user } = useApp();
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-4 md:px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
      <button className="flex items-center gap-2.5" onClick={() => navigate('/profile')}>
        <Avatar name={user?.name ?? 'Rider'} photoUrl={user?.photoUrl} size={40} online />
        <div className="text-left">
          <p className="text-sm font-semibold text-asphalt-100 leading-tight">{user?.name ?? 'Rider'}</p>
          <p className="text-[0.68rem] text-signal-green leading-tight">Online</p>
        </div>
      </button>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-10 h-10 rounded-xl bg-asphalt-800 border border-asphalt-600 flex items-center justify-center text-asphalt-200"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-ember-500 text-white text-[0.6rem] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 rounded-xl bg-asphalt-800 border border-asphalt-600 flex items-center justify-center text-asphalt-200"
        >
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
