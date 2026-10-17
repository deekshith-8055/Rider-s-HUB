import React from 'react';
import { X } from 'lucide-react';

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-asphalt-800 border border-asphalt-600 rounded-2xl p-5 rise-fade max-h-[85vh] overflow-y-auto">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-asphalt-700 text-asphalt-300">
              <X size={20} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-asphalt-800 border-t border-asphalt-600 rounded-t-3xl p-5 pb-8 rise-fade max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-asphalt-500 rounded-full mx-auto mb-4" />
        {title && <h3 className="font-display font-semibold text-lg mb-3">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
