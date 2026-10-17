interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

/**
 * Original mark: a road converging toward a horizon point, crossed by a
 * speed-chevron, inside a rounded hex badge. Built entirely from SVG paths —
 * no external asset dependency.
 */
export function Logo({ size = 36, withWordmark = false, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rh-badge" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1f232b" />
            <stop offset="100%" stopColor="#0a0b0d" />
          </linearGradient>
          <linearGradient id="rh-ember" x1="10" y1="34" x2="38" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff4d1c" />
            <stop offset="100%" stopColor="#ff8a3d" />
          </linearGradient>
        </defs>
        <path
          d="M24 2 L44 13.5 V34.5 L24 46 L4 34.5 V13.5 Z"
          fill="url(#rh-badge)"
          stroke="#2a2f3a"
          strokeWidth="1"
        />
        {/* converging road */}
        <path d="M18 36 L22 16 H26 L30 36 Z" fill="#20242c" />
        <path d="M23.3 16 L22.4 24 H25.6 L24.7 16 Z" fill="#3a404d" />
        {/* speed chevron / ember accent */}
        <path d="M12 30 L24 13 L36 30 L28.5 30 L24 22.5 L19.5 30 Z" fill="url(#rh-ember)" />
      </svg>
      {withWordmark && (
        <span className="font-display font-bold tracking-wide text-[1.35rem] leading-none text-asphalt-100">
          RIDER'S <span className="text-ember-500">HUB</span>
        </span>
      )}
    </div>
  );
}
