/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import { CamporeeProvider } from './context/CamporeeContext';
import { AdventureSection } from './components/AdventureSection';
import { AdminSection } from './components/AdminSection';
import { CampMapSection } from './components/CampMapSection';
import { JuryScannerSection } from './components/JuryScannerSection';
import { MobileNav } from './components/MobileNav';
import { OverviewSection } from './components/OverviewSection';
import { ProgramsSection } from './components/ProgramsSection';
import { AppSection, TopBar } from './components/TopBar';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Camporee UI ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F8F5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#141A15]">
              Something interrupted the Camporee view
            </h2>
            <p className="text-xs font-mono bg-[#F7F8F5] border border-[#E2E8E2] rounded-lg p-3 text-red-700 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg"
            >
              Reload View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CamporeeShell() {
  const [activeSection, setActiveSection] = useState<AppSection>('overview');
  const [scannerActivityId, setScannerActivityId] = useState<string | null>(null);

  const handleOpenScannerForActivity = (activityId: string) => {
    setScannerActivityId(activityId);
    setActiveSection('scanner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (section: AppSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F5] text-[#141A15] pb-16 md:pb-0">
      <TopBar activeSection={activeSection} onNavigate={handleNavigate} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeSection === 'overview' && <OverviewSection onNavigate={handleNavigate} />}
        {activeSection === 'map' && <CampMapSection />}
        {activeSection === 'programs' && (
          <ProgramsSection onOpenScannerForActivity={handleOpenScannerForActivity} />
        )}
        {activeSection === 'adventure' && (
          <AdventureSection onOpenScannerForActivity={handleOpenScannerForActivity} />
        )}
        {activeSection === 'scanner' && (
          <JuryScannerSection preselectedActivityId={scannerActivityId} />
        )}
        {activeSection === 'admin' && <AdminSection />}
      </main>

      <footer className="border-t border-[#DDE4DD] bg-white/60 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C665E]">
          <span>Kerala State Bharat Scouts and Guides · State Camporee Portal</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleNavigate('map')}
              className="hover:text-[#141A15] transition-colors"
            >
              Camp Map
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('programs')}
              className="hover:text-[#141A15] transition-colors"
            >
              Programs
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('adventure')}
              className="hover:text-[#141A15] transition-colors"
            >
              Adventure Bases
            </button>
          </div>
        </div>
      </footer>

      <MobileNav activeSection={activeSection} onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <CamporeeProvider>
        <CamporeeShell />
      </CamporeeProvider>
    </AppErrorBoundary>
  );
}
