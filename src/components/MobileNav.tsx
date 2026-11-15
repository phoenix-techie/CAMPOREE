import React from 'react';
import { Calendar, Compass, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { AppSection } from './TopBar';

interface MobileNavProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeSection, onNavigate }) => {
  const { role } = useCamporee();

  const items: Array<{ id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Home', icon: Compass },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'programs', label: 'Programs', icon: Calendar },
    { id: 'scanner', label: 'Scan QR', icon: QrCode },
  ];

  if (role === 'admin') {
    items.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  } else {
    items.splice(3, 0, { id: 'adventure', label: 'Adventure', icon: Compass });
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#DDE4DD]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5 h-14 items-center">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-[#1B4332] font-semibold' : 'text-[#5C665E]'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
