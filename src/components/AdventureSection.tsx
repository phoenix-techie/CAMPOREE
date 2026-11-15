import React, { useMemo, useState } from 'react';
import { Clock, Compass, Edit3, Plus, QrCode, ShieldAlert, Trash2, X } from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { sanitizeFirestoreId } from '../lib/qrParser';
import { Activity, ActivityImageKey, ActivityStatus } from '../types/camporee';
import { ConfirmDialog } from './ConfirmDialog';
import ropesBaseImg from '../assets/images/adventure_ropes_base_1794774455847.jpg';
import pioneeringBaseImg from '../assets/images/adventure_pioneering_base_1794774456766.jpg';
import groundsBaseImg from '../assets/images/camporee_hero_grounds_1794774454711.jpg';

interface AdventureSectionProps {
  onOpenScannerForActivity: (activityId: string) => void;
}

const IMAGE_MAP: Record<ActivityImageKey, string | null> = {
  ropes: ropesBaseImg,
  pioneering: pioneeringBaseImg,
  grounds: groundsBaseImg,
  none: null,
};

export const AdventureSection: React.FC<AdventureSectionProps> = ({
  onOpenScannerForActivity,
}) => {
  const { role, juryProfile, venues, activities, saveActivity, deleteActivity } = useCamporee();
  const isAdmin = role === 'admin';
  const isJury = role === 'jury';

  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<Activity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState<{
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
    imageKey: ActivityImageKey;
  }>({
    title: '',
    category: 'Rope Traverse',
    description: '',
    venueId: '',
    venueName: '',
    dayLabel: 'Day 1 · All Day',
    startTime: '09:00',
    endTime: '17:00',
    status: 'live',
    safetyNotes: '',
    imageKey: 'ropes',
  });

  const bases = useMemo(
    () => activities.filter((a) => a.type === 'adventure'),
    [activities]
  );

  const openNewBase = () => {
    const firstVenue = venues.find((v) => v.name.toLowerCase().includes('adventure')) || venues[0];
    setEditingBase(null);
    setFormState({
      title: '',
      category: 'Rope Traverse',
      description: '',
      venueId: firstVenue?.id || 'adventure-valley',
      venueName: firstVenue?.name || 'Adventure Valley Canopy',
      dayLabel: 'Day 1 · All Day',
      startTime: '09:00',
      endTime: '17:00',
      status: 'live',
      safetyNotes: '',
      imageKey: 'ropes',
    });
    setModalOpen(true);
  };

  const openEditBase = (act: Activity) => {
    setEditingBase(act);
    setFormState({
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
      imageKey: act.imageKey || 'ropes',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const id = editingBase?.id || sanitizeFirestoreId('adv', formState.title);
      await saveActivity(
        {
          id,
          type: 'adventure',
          title: formState.title,
          category: formState.category,
          description: formState.description,
          venueId: formState.venueId,
          venueName: formState.venueName,
          dayLabel: formState.dayLabel,
          startTime: formState.startTime,
          endTime: formState.endTime,
          status: formState.status,
          safetyNotes: formState.safetyNotes,
          imageKey: formState.imageKey,
          juryDisplayNames: editingBase?.juryDisplayNames || [],
        },
        !editingBase
      );
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
            Adventure Bases
          </h1>
          <p className="text-sm text-[#5C665E]">
            High-ropes, pioneering watchtowers, archery, and compass trails. Base Jury verify Scout
            and Guide QR cards before each dispatch.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openNewBase}
            className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Adventure Base</span>
          </button>
        )}
      </div>

      {bases.length === 0 ? (
        <div className="bg-white border border-dashed border-[#D4DDD4] rounded-2xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-[#141A15]">No adventure bases added yet</p>
          <p className="text-xs text-[#5C665E]">
            Camporee Administrators can add adventure bases and assign base Jury officials.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bases.map((base) => {
            const imgSrc = base.imageKey ? IMAGE_MAP[base.imageKey] : IMAGE_MAP.ropes;
            const showFallback = !imgSrc || imgErrors[base.id];
            const assignedToMe =
              isJury && Boolean(juryProfile?.assignedActivityIds.includes(base.id));

            return (
              <article
                key={base.id}
                className="bg-white border border-[#DDE4DD] rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] bg-[#E8EFE8] relative overflow-hidden">
                    {!showFallback && imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={base.title}
                        referrerPolicy="no-referrer"
                        onError={() => setImgErrors((p) => ({ ...p, [base.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#1B4332] to-[#345E48] flex flex-col items-center justify-center p-6 text-white text-center">
                        <Compass className="h-10 w-10 mb-2 opacity-80" />
                        <span className="font-display text-sm font-bold">{base.title}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C665E]">
                      <span
                        className={`font-semibold ${
                          base.status === 'live'
                            ? 'text-[#1B4332]'
                            : base.status === 'delayed'
                            ? 'text-[#B45309]'
                            : 'text-[#424B44]'
                        }`}
                      >
                        {base.status === 'live'
                          ? 'Open Now'
                          : base.status === 'delayed'
                          ? 'Standby'
                          : base.status === 'completed'
                          ? 'Closed'
                          : 'Scheduled'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{base.category}</span>
                      {assignedToMe && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#B45309]">Your Base</span>
                        </>
                      )}
                    </div>

                    <h2 className="font-display text-lg font-bold text-[#141A15]">{base.title}</h2>

                    {base.description && (
                      <p className="text-sm text-[#424B44] leading-relaxed">{base.description}</p>
                    )}

                    <div className="space-y-1.5 text-xs text-[#5C665E] pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[#141A15] truncate">{base.venueName}</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#141A15] shrink-0">
                          <Clock className="h-3.5 w-3.5 text-[#1B4332]" />
                          {base.startTime} – {base.endTime}
                        </span>
                      </div>
                      {base.juryDisplayNames && base.juryDisplayNames.length > 0 && (
                        <p>Base Jury: {base.juryDisplayNames.join(', ')}</p>
                      )}
                    </div>

                    {base.safetyNotes && (
                      <div className="rounded-lg bg-[#FAF7F0] border border-[#E9DEC7] p-3 text-xs text-[#6B4212] flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-[#B45309]" />
                        <span>{base.safetyNotes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(isAdmin || isJury) && (
                  <div className="px-5 py-3.5 bg-[#FAFBF9] border-t border-[#EEF2EE] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenScannerForActivity(base.id)}
                      className="min-h-[38px] px-3.5 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      <span>Verify Base QR</span>
                    </button>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditBase(base)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-[#424B44] hover:bg-white"
                          title="Edit base"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(base)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-red-700 hover:bg-red-50"
                          title="Delete base"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Admin Adventure Base Modal */}
      {modalOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                {editingBase ? 'Edit Adventure Base' : 'Add Adventure Base'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Adventure Base Name
                  </label>
                  <input
                    required
                    value={formState.title}
                    onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                    placeholder="e.g. Burma Bridge & Canopy High Ropes"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Discipline
                  </label>
                  <input
                    required
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                    placeholder="Rope Traverse, Pioneering..."
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Visual Preset
                  </label>
                  <select
                    value={formState.imageKey}
                    onChange={(e) =>
                      setFormState({ ...formState, imageKey: e.target.value as ActivityImageKey })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="ropes">High Ropes & Canopy</option>
                    <option value="pioneering">Bamboo Pioneering & Range</option>
                    <option value="grounds">Camporee Grounds</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">Venue</label>
                  {venues.length > 0 ? (
                    <select
                      value={formState.venueId}
                      onChange={(e) => {
                        const found = venues.find((v) => v.id === e.target.value);
                        setFormState({
                          ...formState,
                          venueId: e.target.value,
                          venueName: found?.name || formState.venueName,
                        });
                      }}
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                    >
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={formState.venueName}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          venueName: e.target.value,
                          venueId: sanitizeFirestoreId('ven', e.target.value),
                        })
                      }
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">Status</label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({ ...formState, status: e.target.value as ActivityStatus })
                    }
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg bg-white focus:outline-none focus:border-[#1B4332]"
                  >
                    <option value="live">Open Now</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="delayed">Standby / Weather Hold</option>
                    <option value="completed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Open Time
                  </label>
                  <input
                    required
                    value={formState.startTime}
                    onChange={(e) => setFormState({ ...formState, startTime: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Close Time
                  </label>
                  <input
                    required
                    value={formState.endTime}
                    onChange={(e) => setFormState({ ...formState, endTime: e.target.value })}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Base Description
                  </label>
                  <textarea
                    rows={2}
                    value={formState.description}
                    onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                    className="w-full p-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Safety & Gear Requirements
                  </label>
                  <input
                    value={formState.safetyNotes}
                    onChange={(e) => setFormState({ ...formState, safetyNotes: e.target.value })}
                    placeholder="Closed-toe shoes, harness briefing..."
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Adventure Base'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Adventure Base"
        description={`Remove "${deleteTarget?.title || ''}" from Adventure Bases?`}
        confirmLabel="Delete Base"
        tone="danger"
        busy={saving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setSaving(true);
          try {
            await deleteActivity(deleteTarget.id);
            setDeleteTarget(null);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
};
