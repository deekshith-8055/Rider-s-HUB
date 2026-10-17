import React from 'react';
import { initials } from '../../utils/format';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-asphalt-800/90 border border-asphalt-600/60 rounded-2xl ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

const badgeVariants = {
  neutral: 'bg-asphalt-700 text-asphalt-200',
  ember: 'bg-ember-500/15 text-ember-400 border border-ember-500/30',
  gps: 'bg-gps-500/15 text-gps-400 border border-gps-500/30',
  amber: 'bg-signal-amber/15 text-signal-amber border border-signal-amber/30',
  red: 'bg-signal-red/15 text-signal-red border border-signal-red/30',
};

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badgeVariants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  photoUrl,
  size = 40,
  ring = false,
  online,
}: {
  name: string;
  photoUrl?: string;
  size?: number;
  ring?: boolean;
  online?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`w-full h-full rounded-full flex items-center justify-center font-display font-bold text-asphalt-950 bg-gradient-to-br from-gps-400 to-gps-600 overflow-hidden ${ring ? 'ring-2 ring-ember-500 ring-offset-2 ring-offset-asphalt-900' : ''}`}
        style={{ fontSize: size * 0.38 }}
      >
        {photoUrl ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" /> : initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-asphalt-900 ${online ? 'bg-signal-green' : 'bg-asphalt-400'}`}
        />
      )}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-display font-semibold text-lg tracking-wide text-asphalt-100">{children}</h2>
      {action}
    </div>
  );
}
