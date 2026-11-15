import React from 'react';
import { LogOut, ShieldCheck, UserCheck } from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { GoogleSignInButton } from './GoogleSignInButton';

export type AppSection = 'overview' | 'map' | 'programs' | 'adventure' | 'scanner' | 'admin';

interface TopBarProps {
  activeSection: AppSection;
  onNavigate: (section: AppSection) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeSection, onNavigate }) => {
  const { user, role, signingIn, signInWithGoogle, signOutUser } = useCamporee();

  const navItems: Array<{ id: AppSection; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'map', label: 'Camp Map' },
    { id: 'programs', label: 'Programs' },
    { id: 'adventure', label: 'Adventure' },
    { id: 'scanner', label: 'QR Attendance' },
  ];

  if (role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-40 bg-[#F7F8F5]/95 backdrop-blur-md border-b border-[#DDE4DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('overview')}
          className="text-left font-display text-lg font-extrabold tracking-tight text-[#1B4332] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#1B4332] rounded"
        >
          Kerala BSG Camporee
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#1B4332] text-[#141A15] font-semibold'
                    : 'border-transparent text-[#525E54] hover:text-[#141A15] hover:border-[#C2CEC2]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action / Account Status */}
        <div className="flex items-center gap-3 shrink-0">
          {!user ? (
            <GoogleSignInButton
              onClick={() => {
                void signInWithGoogle();
              }}
              disabled={signingIn}
              label={signingIn ? 'Signing in...' : 'Sign in with Google'}
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2 text-right">
                <span className="text-xs font-semibold text-[#141A15] max-w-[140px] truncate">
                  {user.displayName || user.email}
                </span>
                <span className="text-[#8E9B90]" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4332] whitespace-nowrap shrink-0">
                  {role === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                  {role === 'jury' && <UserCheck className="h-3.5 w-3.5" />}
                  {role === 'admin' ? 'Admin' : role === 'jury' ? 'Jury' : 'Guest'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void signOutUser();
                }}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[#3C463E] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#EEF2EE] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
