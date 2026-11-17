import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-primary/60 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Drawer content */}
      <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-primary h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 z-20"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
        <Sidebar onCloseMobile={onClose} />
      </div>
    </div>
  );
};
