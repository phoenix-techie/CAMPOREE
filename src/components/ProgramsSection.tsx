import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Clock,
  Edit3,
  Plus,
  QrCode,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { sanitizeFirestoreId } from '../lib/qrParser';
import { Activity, ActivityStatus, Venue, VenueStatus } from '../types/camporee';
import { ConfirmDialog } from './ConfirmDialog';

interface ProgramsSectionProps {
  onOpenScannerForActivity: (activityId: string) => void;
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  live: 'Live Now',
  scheduled: 'Scheduled',
  delayed: 'Delayed',
  completed: 'Completed',
};

export const ProgramsSection: React.FC<ProgramsSectionProps> = ({
  onOpenScannerForActivity,
}) => {
  const {
    role,
    juryProfile,
    venues,
    activities,
    saveVenue,
    deleteVenue,
    saveActivity,
    deleteActivity,
  } = useCamporee();
  const isAdmin = role === 'admin';
  const isJury = role === 'jury';

  const [statusFilter, setStatusFilter] = useState<'all' | ActivityStatus>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Program Editor Modal
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Activity | null>(null);
  const [deleteProgramTarget, setDeleteProgramTarget] = useState<Activity | null>(null);

  // Venue Editor Modal
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<Venue | null>(null);

  const [saving, setSaving] = useState(false);

  const [progForm, setProgForm] = useState<{
    title: string;
    category: string;
    description: string;
    venueId: string;
    venueName: string;
    dayLabel: string;
    startTime: string;
    endTime: string;
    status: ActivityStatus;
    safetyNotes: string;
  }>({
    title: '',
    category: 'Ceremonial',
    description: '',
    venueId: '',
    venueName: '',
    dayLabel: 'Day 1 · Morning',
    startTime: '09:00',
    endTime: '11:00',
    status: 'scheduled',
    safetyNotes: '',
  });

  const [venueForm, setVenueForm] = useState<{
    name: string;
    zone: string;
    capacity: number;
    facilities: string;
    status: VenueStatus;
  }>({
    name: '',
    zone: 'Sector A · Central',
    capacity: 500,
    facilities: '',
    status: 'active',
  });

  const programList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activities
      .filter((a) => a.type === 'program')
      .filter((a) => {
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (venueFilter !== 'all' && a.venueId !== venueFilter) return false;
        if (!q) return true;
        return (
          a.title.toLowerCase().includes(q) ||
          a.venueName.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        );
      });
  }, [activities, statusFilter, venueFilter, searchQuery]);

  const openNewProgram = () => {
    const firstVenue = venues[0];
    setEditingProgram(null);
    setProgForm({
      title: '',
      category: 'Skill Craft',
      description: '',
      venueId: firstVenue?.id || 'main-arena',
      venueName: firstVenue?.name || 'Central Flag & Parade Arena',
      dayLabel: 'Day 1 · Morning',
      startTime: '09:00',
      endTime: '11:00',
      status: 'scheduled',
      safetyNotes: '',
    });
    setProgramModalOpen(true);
  };

  const openEditProgram = (act: Activity) => {
    setEditingProgram(act);
    setProgForm({
      title: act.title,
      category: act.category,
      description: act.description || '',
      venueId: act.venueId,
      venueName: act.venueName,
      dayLabel: act.dayLabel,
      startTime: act.startTime,
      endTime: act.endTime,
      status: act.status,
      safetyNotes: act.safetyNotes || '',
    });
    setProgramModalOpen(true);
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const id = editingProgram?.id || sanitizeFirestoreId('prog', progForm.title);
      await saveActivity(
        {
          id,
          type: 'program',
          title: progForm.title,
          category: progForm.category,
          description: progForm.description,
          venueId: progForm.venueId,
          venueName: progForm.venueName,
          dayLabel: progForm.dayLabel,
          startTime: progForm.startTime,
          endTime: progForm.endTime,
          status: progForm.status,
          safetyNotes: progForm.safetyNotes,
          imageKey: 'grounds',
          juryDisplayNames: editingProgram?.juryDisplayNames || [],
        },
        !editingProgram
      );
      setProgramModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const openNewVenue = () => {
    setEditingVenue(null);
    setVenueForm({
      name: '',
      zone: 'Sector A · Central',
      capacity: 500,
      facilities: '',
      status: 'active',
    });
    setVenueModalOpen(true);
  };

  const openEditVenue = (v: Venue) => {
    setEditingVenue(v);
    setVenueForm({
      name: v.name,
      zone: v.zone,
      capacity: v.capacity,
      facilities: v.facilities || '',
      status: v.status,
    });
    setVenueModalOpen(true);
  };

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const id = editingVenue?.id || sanitizeFirestoreId('ven', venueForm.name);
      await saveVenue(
        {
          id,
          ...venueForm,
        },
        !editingVenue
      );
      setVenueModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
            Venues & Current Programs
          </h1>
          <p className="text-sm text-[#5C665E]">
            Official Camporee schedule charted by Admin. Guests have read-only access; only Admins
            can edit venues and timings.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openNewVenue}
              className="min-h-[40px] px-4 py-2 bg-white text-[#141A15] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#F1F4F1] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Add Venue</span>
            </button>
            <button
              type="button"
              onClick={openNewProgram}
              className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Chart Program</span>
            </button>
          </div>
        )}
      </div>

      {/* Venues Strip */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[#141A15]">Camporee Venues</h2>
          <span className="text-xs text-[#5C665E] tabular-nums">{venues.length} venues</span>
        </div>

        {venues.length === 0 ? (
          <div className="bg-white border border-dashed border-[#D4DDD4] rounded-xl p-8 text-center text-sm text-[#5C665E]">
            No venues configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white border border-[#DDE4DD] rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-[#5C665E] truncate">
                      {venue.zone}
                    </span>
                    <span
                      className={`text-[11px] font-semibold shrink-0 ${
                        venue.status === 'active'
                          ? 'text-[#1B4332]'
                          : venue.status === 'standby'
                          ? 'text-[#B45309]'
                          : 'text-red-700'
                      }`}
                    >
                      {venue.status === 'active'
                        ? 'Active'
                        : venue.status === 'standby'
                        ? 'Standby'
                        : 'Closed'}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-[#141A15]">{venue.name}</h3>
                  {venue.facilities && (
                    <p className="text-xs text-[#5C665E] line-clamp-2">{venue.facilities}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-[#EEF2EE] flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-[#424B44] tabular-nums">
                    Cap. {venue.capacity.toLocaleString()}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditVenue(venue)}
                        className="p-1.5 rounded text-[#424B44] hover:bg-[#F1F4F1]"
                        title="Edit venue"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteVenueTarget(venue)}
                        className="p-1.5 rounded text-red-700 hover:bg-red-50"
                        title="Delete venue"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filter Toolbar */}
      <section className="space-y-4">
        <div className="bg-white border border-[#DDE4DD] rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                { id: 'all', label: 'All Programs' },
                { id: 'live', label: 'Live Now' },
                { id: 'scheduled', label: 'Scheduled' },
                { id: 'delayed', label: 'Delayed' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-[#1B4332] text-white'
                    : 'text-[#424B44] hover:bg-[#F1F4F1]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={venueFilter}
              onChange={(e) => setVenueFilter(e.target.value)}
              className="h-10 px-3 text-xs font-medium bg-[#F7F8F5] border border-[#D4DDD4] rounded-lg focus:outline-none focus:border-[#1B4332]"
            >
              <option value="all">All Venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            <div className="relative sm:w-64">
              <Search className="h-4 w-4 text-[#5C665E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search programs..."
                className="w-full h-10 pl-9 pr-3 text-sm bg-[#F7F8F5] border border-[#D4DDD4] rounded-lg focus:outline-none focus:border-[#1B4332]"
              />
            </div>
          </div>
        </div>

        {/* Programs Table / List */}
        {programList.length === 0 ? (
          <div className="bg-white border border-dashed border-[#D4DDD4] rounded-2xl p-10 text-center space-y-2">
            <p className="text-sm font-semibold text-[#141A15]">No programs match this filter</p>
            <p className="text-xs text-[#5C665E]">
              Try switching status or venue filters, or check back for Admin updates.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#DDE4DD] rounded-2xl divide-y divide-[#EEF2EE]">
            {programList.map((prog) => {
              const assignedToCurrentJury =
                isJury && Boolean(juryProfile?.assignedActivityIds.includes(prog.id));

              return (
                <div
                  key={prog.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C665E]">
                      <span
                        className={`font-semibold ${
                          prog.status === 'live'
                            ? 'text-[#1B4332]'
                            : prog.status === 'delayed'
                            ? 'text-[#B45309]'
                            : 'text-[#424B44]'
                        }`}
                      >
                        {STATUS_LABELS[prog.status]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{prog.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{prog.venueName}</span>
                      {assignedToCurrentJury && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#B45309]">Assigned to you</span>
                        </>
                      )}
                    </div>

                    <h3 className="font-display text-base font-bold text-[#141A15]">
                      {prog.title}
                    </h3>

                    {prog.description && (
                      <p className="text-sm text-[#424B44] leading-relaxed max-w-3xl">
                        {prog.description}
                      </p>
                    )}

                    <div className="pt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#5C665E]">
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#141A15]">
                        <Calendar className="h-3.5 w-3.5 text-[#1B4332]" />
                        {prog.dayLabel}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#141A15]">
                        <Clock className="h-3.5 w-3.5 text-[#1B4332]" />
                        {prog.startTime} – {prog.endTime}
                      </span>
                      {prog.juryDisplayNames && prog.juryDisplayNames.length > 0 && (
                        <span>Jury: {prog.juryDisplayNames.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {(isAdmin || isJury) && (
                      <button
                        type="button"
                        onClick={() => onOpenScannerForActivity(prog.id)}
                        className="min-h-[38px] px-3.5 py-2 bg-[#F7F8F5] text-[#1B4332] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#EEF4EE] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span>Scan Attendance</span>
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditProgram(prog)}
                          className="min-h-[38px] px-3 py-2 bg-white text-[#141A15] border border-[#D4DDD4] text-xs font-semibold rounded-lg hover:bg-[#F1F4F1] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit Venue / Time</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteProgramTarget(prog)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-red-700 hover:bg-red-50"
                          title="Delete program"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Admin Program Modal */}
      {programModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveProgram}
            className="w-full max-w-lg bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                {editingProgram ? 'Edit Program Venue & Time' : 'Chart New Program'}
              </h3>
              <button
                type="button"
                onClick={() => setProgramModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Program Title
                  </label>
                  <input
                    required
                    value={progForm.title}
                    onChange={(e) => setProgForm({ ...progForm, title: e.target.value })}
                    placeholder="e.g. State Camporee Flag Break"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Category
                  </label>
                  <input
                    required
                    value={progForm.category}
                    onChange={(e) => setProgForm({ ...progForm, category: e.target.value })}
                    placeholder="Ceremonial, Cultural, Skill Craft..."
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">Status</label>
                  <select
                    value={progForm.status}
                    onChange={(e) =>
                      setProgForm({ ...progForm, status: e.target.value as ActivityStatus })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live Now</option>
                    <option value="delayed">Delayed</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">Venue</label>
                  {venues.length > 0 ? (
                    <select
                      value={progForm.venueId}
                      onChange={(e) => {
                        const found = venues.find((v) => v.id === e.target.value);
                        setProgForm({
                          ...progForm,
                          venueId: e.target.value,
                          venueName: found?.name || progForm.venueName,
                        });
                      }}
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.zone})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={progForm.venueName}
                      onChange={(e) =>
                        setProgForm({
                          ...progForm,
                          venueName: e.target.value,
                          venueId: sanitizeFirestoreId('ven', e.target.value),
                        })
                      }
                      placeholder="Venue Name"
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                    />
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Day / Session Label
                  </label>
                  <input
                    required
                    value={progForm.dayLabel}
                    onChange={(e) => setProgForm({ ...progForm, dayLabel: e.target.value })}
                    placeholder="e.g. Day 1 · Morning"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Start Time
                  </label>
                  <input
                    required
                    value={progForm.startTime}
                    onChange={(e) => setProgForm({ ...progForm, startTime: e.target.value })}
                    placeholder="09:00"
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    End Time
                  </label>
                  <input
                    required
                    value={progForm.endTime}
                    onChange={(e) => setProgForm({ ...progForm, endTime: e.target.value })}
                    placeholder="11:00"
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Program Details
                  </label>
                  <textarea
                    rows={3}
                    value={progForm.description}
                    onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
                    placeholder="Participant instructions, uniform rules, or evaluation notes..."
                    className="w-full p-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProgramModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Program'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Venue Modal */}
      {venueModalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveVenue}
            className="w-full max-w-md bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                {editingVenue ? 'Edit Venue Details' : 'Add Camporee Venue'}
              </h3>
              <button
                type="button"
                onClick={() => setVenueModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Venue Name
                </label>
                <input
                  required
                  value={venueForm.name}
                  onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                  placeholder="e.g. Sahyadri Cultural Amphitheatre"
                  className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Zone / Sector
                </label>
                <input
                  required
                  value={venueForm.zone}
                  onChange={(e) => setVenueForm({ ...venueForm, zone: e.target.value })}
                  placeholder="e.g. Sector A · West Terrace"
                  className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    required
                    value={venueForm.capacity}
                    onChange={(e) =>
                      setVenueForm({ ...venueForm, capacity: Number(e.target.value) })
                    }
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">Status</label>
                  <select
                    value={venueForm.status}
                    onChange={(e) =>
                      setVenueForm({ ...venueForm, status: e.target.value as VenueStatus })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="active">Active</option>
                    <option value="standby">Standby</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Facilities Available
                </label>
                <textarea
                  rows={2}
                  value={venueForm.facilities}
                  onChange={(e) => setVenueForm({ ...venueForm, facilities: e.target.value })}
                  placeholder="PA sound system, shaded seating, water point..."
                  className="w-full p-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setVenueModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Venue'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteProgramTarget)}
        title="Delete Scheduled Program"
        description={`Remove "${deleteProgramTarget?.title || ''}" from the Camporee schedule?`}
        confirmLabel="Delete Program"
        tone="danger"
        busy={saving}
        onCancel={() => setDeleteProgramTarget(null)}
        onConfirm={async () => {
          if (!deleteProgramTarget) return;
          setSaving(true);
          try {
            await deleteActivity(deleteProgramTarget.id);
            setDeleteProgramTarget(null);
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteVenueTarget)}
        title="Delete Camporee Venue"
        description={`Remove "${deleteVenueTarget?.name || ''}" from the venues list?`}
        confirmLabel="Delete Venue"
        tone="danger"
        busy={saving}
        onCancel={() => setDeleteVenueTarget(null)}
        onConfirm={async () => {
          if (!deleteVenueTarget) return;
          setSaving(true);
          try {
            await deleteVenue(deleteVenueTarget.id);
            setDeleteVenueTarget(null);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
};
