import React, { useState } from 'react';
import { ArrowRight, Calendar, Compass, MapPin, QrCode, ShieldCheck, Tent } from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { AppSection } from './TopBar';
import heroGroundsImg from '../assets/images/camporee_hero_grounds_1794774454711.jpg';

interface OverviewSectionProps {
  onNavigate: (section: AppSection) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
  const {
    role,
    locations,
    venues,
    activities,
    generalConfig,
    loadingPublic,
    seedStarterCamporeeData,
  } = useCamporee();

  const [seeding, setSeeding] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);

  const livePrograms = activities.filter((a) => a.type === 'program' && a.status === 'live');
  const allPrograms = activities.filter((a) => a.type === 'program');
  const adventureBases = activities.filter((a) => a.type === 'adventure');
  const activeVenues = venues.filter((v) => v.status === 'active');

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterCamporeeData();
    } finally {
      setSeeding(false);
    }
  };

  const isEmpty = !loadingPublic && locations.length === 0 && activities.length === 0;

  return (
    <div className="space-y-10">
      {/* Admin First-Run Starter Data Callout */}
      {isEmpty && role === 'admin' && (
        <section className="rounded-xl bg-[#EEF4EE] border border-[#C7D8C8] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#141A15]">
              Initialize Kerala State Camporee Grounds & Schedule
            </h2>
            <p className="text-sm text-[#424B44]">
              Your Firestore database is ready. Load starter Kerala BSG Camporee map sectors,
              venues, scheduled programs, and adventure bases in one click, or add them manually.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="min-h-[44px] px-5 py-2.5 bg-[#1B4332] text-white text-sm font-semibold rounded-lg hover:bg-[#143325] transition-colors whitespace-nowrap shrink-0"
          >
            {seeding ? 'Populating Data...' : 'Load Starter Camporee Data'}
          </button>
        </section>
      )}

      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between bg-white border border-[#DDE4DD] rounded-2xl p-6 sm:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#525E54]">
              <span>Kerala State Bharat Scouts & Guides</span>
              <span aria-hidden="true">·</span>
              <span>State Camporee Field Portal</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#1B4332] font-semibold">
                {role === 'admin'
                  ? 'Admin Access'
                  : role === 'jury'
                  ? 'Jury Access'
                  : 'Guest View'}
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#141A15] leading-[1.15] text-balance">
              {generalConfig?.camporeeTitle ||
                'Kerala State Bharat Scouts & Guides Camporee'}
            </h1>

            <p className="text-base text-[#424B44] leading-relaxed max-w-xl">
              Navigate sub-camps, live program venues, and adventure bases across the camporee
              grounds. Authorized Jury officials verify Scout and Guide ID QR cards with automated
              attendance logging to Google Drive and Sheets.
            </p>
          </div>

          <div className="pt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('map')}
              className="min-h-[44px] px-5 py-2.5 bg-[#1B4332] text-white text-sm font-semibold rounded-lg hover:bg-[#143325] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <MapPin className="h-4 w-4" />
              <span>Explore Camp Map</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('programs')}
              className="min-h-[44px] px-5 py-2.5 bg-white text-[#141A15] border border-[#CFD8CF] text-sm font-semibold rounded-lg hover:bg-[#F1F4F1] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Calendar className="h-4 w-4" />
              <span>View Current Programs</span>
            </button>
            {(role === 'jury' || role === 'admin') && (
              <button
                type="button"
                onClick={() => onNavigate('scanner')}
                className="min-h-[44px] px-5 py-2.5 bg-[#B45309] text-white text-sm font-semibold rounded-lg hover:bg-[#92400E] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <QrCode className="h-4 w-4" />
                <span>Open QR Scanner</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-[#DDE4DD] bg-[#1B4332] min-h-[280px] relative">
          {!heroImgError ? (
            <img
              src={heroGroundsImg}
              alt="Kerala State Bharat Scouts and Guides Camporee grounds with patrol tents and Western Ghats hills"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="w-full h-full lg:h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[280px] bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#143325] flex flex-col items-center justify-center p-8 text-white text-center">
              <Tent className="h-12 w-12 mb-3 opacity-80" />
              <p className="font-display text-lg font-bold">Kerala State Camporee Grounds</p>
              <p className="text-sm text-white/75 mt-1">Central Parade Arena & Sub-Camps</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
            <p className="text-xs font-medium text-white/85">
              Camporee Grounds Overview · Sectors A through E
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {generalConfig?.locationNote ||
                'Interactive map pins and venue coordinates can be updated anytime by Camporee Admins.'}
            </p>
          </div>
        </div>
      </section>

      {/* 4-Column Summary Strip (placed below Hero Split per layout contract) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DDE4DD] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5C665E]">Live & Scheduled Programs</p>
          <p className="mt-2 font-display text-3xl font-bold text-[#141A15] tabular-nums">
            {allPrograms.length}
          </p>
          <p className="mt-1 text-xs text-[#1B4332] font-medium tabular-nums">
            {livePrograms.length} active right now
          </p>
        </div>
        <div className="bg-white border border-[#DDE4DD] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5C665E]">Adventure Bases</p>
          <p className="mt-2 font-display text-3xl font-bold text-[#141A15] tabular-nums">
            {adventureBases.length}
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Ropes, pioneering & orienteering</p>
        </div>
        <div className="bg-white border border-[#DDE4DD] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5C665E]">Mapped Camp Zones</p>
          <p className="mt-2 font-display text-3xl font-bold text-[#141A15] tabular-nums">
            {locations.length}
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Sub-camps, HQ & medical posts</p>
        </div>
        <div className="bg-white border border-[#DDE4DD] rounded-xl p-5">
          <p className="text-xs font-medium text-[#5C665E]">Active Program Venues</p>
          <p className="mt-2 font-display text-3xl font-bold text-[#141A15] tabular-nums">
            {activeVenues.length}
          </p>
          <p className="mt-1 text-xs text-[#5C665E]">Managed by State Camporee Admin</p>
        </div>
      </section>

      {/* Live Programs & Role Access Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-[#141A15]">
                Happening Across Grounds
              </h2>
              <p className="text-sm text-[#5C665E]">
                Live and upcoming programs & adventure bases charted by Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('programs')}
              className="text-sm font-semibold text-[#1B4332] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span>Full Schedule</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-[#D4DDD4] rounded-xl space-y-2">
              <p className="text-sm font-semibold text-[#141A15]">No programs charted yet</p>
              <p className="text-xs text-[#5C665E]">
                Camporee Administrators can chart programs and adventure bases from the Programs or
                Admin panels.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEF2EE]">
              {activities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#5C665E]">
                      <span className="font-semibold text-[#1B4332]">
                        {act.status === 'live'
                          ? 'Live Now'
                          : act.status === 'delayed'
                          ? 'Delayed'
                          : act.status === 'completed'
                          ? 'Completed'
                          : 'Scheduled'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{act.type === 'adventure' ? 'Adventure Base' : 'Program'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{act.venueName}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#141A15] truncate">{act.title}</h3>
                  </div>
                  <div className="font-mono text-xs font-medium text-[#424B44] tabular-nums whitespace-nowrap shrink-0">
                    {act.dayLabel} · {act.startTime} – {act.endTime}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-xl font-bold text-[#141A15]">
              Camporee Access & Roles
            </h2>
            <p className="text-sm text-[#5C665E]">
              Permissions enforced across all modules.
            </p>
          </div>

          <div className="space-y-4 divide-y divide-[#EEF2EE]">
            <div className="pt-1 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#141A15]">
                <Compass className="h-4 w-4 text-[#1B4332]" />
                <span>Guest (Scouts, Guides & Visitors)</span>
              </div>
              <p className="text-xs text-[#5C665E] leading-relaxed">
                Read-only access to the Camp Map, Location Finder, Venues, Current Programs, and
                Adventure Base timings without needing to sign in.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#141A15]">
                <QrCode className="h-4 w-4 text-[#B45309]" />
                <span>Jury Official</span>
              </div>
              <p className="text-xs text-[#5C665E] leading-relaxed">
                Assigned by Admin to specific Programs and Adventure Bases. Scans participant ID
                card QR codes to verify attendance and log Activity Name, UID, and Timestamp to
                Google Sheets and Drive.
              </p>
            </div>

            <div className="pt-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#141A15]">
                <ShieldCheck className="h-4 w-4 text-[#1B4332]" />
                <span>Camporee Admin</span>
              </div>
              <p className="text-xs text-[#5C665E] leading-relaxed">
                Full control over map pins, venues, program schedules, adventure bases, Jury &
                Admin assignments, and centralized Google Sheet linkage.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
