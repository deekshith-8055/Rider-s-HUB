import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gps';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-ember-500 hover:bg-ember-400 active:bg-ember-600 text-white shadow-[0_8px_24px_-8px_rgba(255,77,28,0.6)]',
  secondary: 'bg-asphalt-700 hover:bg-asphalt-600 text-asphalt-100 border border-asphalt-500',
  ghost: 'bg-transparent hover:bg-asphalt-800 text-asphalt-100',
  danger: 'bg-signal-red hover:brightness-110 text-white',
  gps: 'bg-gps-500 hover:bg-gps-400 text-asphalt-950 font-semibold',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-5 py-3.5 rounded-2xl gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
