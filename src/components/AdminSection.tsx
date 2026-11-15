import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../lib/firebase';
import {
  createCamporeeDriveAndSheet,
  inspectExistingSpreadsheet,
} from '../lib/googleWorkspace';
import { AdminEmailRecord, JuryMember } from '../types/camporee';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleSignInButton } from './GoogleSignInButton';

export const AdminSection: React.FC = () => {
  const {
    role,
    user,
    accessToken,
    hasWorkspaceToken,
    signingIn,
    signInWithGoogle,
    activities,
    locations,
    venues,
    juryMembers,
    adminEmails,
    attendanceRecords,
    generalConfig,
    sheetsConfig,
    seedStarterCamporeeData,
    saveJuryMember,
    deleteJuryMember,
    saveAdminEmail,
    deleteAdminEmail,
    saveGeneralConfig,
    saveSheetsConfig,
  } = useCamporee();

  const [activeTab, setActiveTab] = useState<'users' | 'sheets' | 'camp'>('users');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Jury Form Modal
  const [juryModalOpen, setJuryModalOpen] = useState(false);
  const [editingJury, setEditingJury] = useState<JuryMember | null>(null);
  const [juryDeleteTarget, setJuryDeleteTarget] = useState<JuryMember | null>(null);
  const [juryForm, setJuryForm] = useState<{
    email: string;
    name: string;
    district: string;
    roleTitle: string;
    assignedActivityIds: string[];
    active: boolean;
  }>({
    email: '',
    name: '',
    district: '',
    roleTitle: 'Program & Base Jury',
    assignedActivityIds: [],
    active: true,
  });

  // Admin Form Modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminDeleteTarget, setAdminDeleteTarget] = useState<AdminEmailRecord | null>(null);
  const [adminForm, setAdminForm] = useState<{
    email: string;
    name: string;
    district: string;
    active: boolean;
  }>({
    email: '',
    name: '',
    district: 'State HQ',
    active: true,
  });

  // Google Sheets config state
  const [customSheetTitle, setCustomSheetTitle] = useState(
    'KSBSG State Camporee - Centralized Attendance'
  );
  const [existingSheetInput, setExistingSheetInput] = useState('');
  const [inspectedSheet, setInspectedSheet] = useState<{
    spreadsheetId: string;
    spreadsheetTitle: string;
    spreadsheetUrl: string;
    tabNames: string[];
    selectedTab: string;
  } | null>(null);
  const [confirmCreateSheet, setConfirmCreateSheet] = useState(false);
  const [confirmLinkSheet, setConfirmLinkSheet] = useState(false);

  // Camporee general settings
  const [campTitle, setCampTitle] = useState(
    generalConfig?.camporeeTitle || 'Kerala State Bharat Scouts & Guides — State Camporee'
  );
  const [locationNote, setLocationNote] = useState(
    generalConfig?.locationNote ||
      'Camp map coordinates and sub-camp pins are live and can be updated anytime by State Camporee Admins.'
  );

  const [busy, setBusy] = useState(false);

  if (role !== 'admin') {
    return (
      <div className="bg-white border border-[#DDE4DD] rounded-2xl p-8 max-w-xl mx-auto text-center space-y-3">
        <ShieldCheck className="h-8 w-8 text-[#1B4332] mx-auto" />
        <h1 className="font-display text-xl font-bold text-[#141A15]">Admin Access Required</h1>
        <p className="text-sm text-[#5C665E]">
          Only authorized Kerala State Camporee Administrators can manage Jury assignments,
          delegated Admins, and centralized Google Sheet configuration.
        </p>
      </div>
    );
  }

  const openNewJury = () => {
    setEditingJury(null);
    setJuryForm({
      email: '',
      name: '',
      district: '',
      roleTitle: 'Camporee Jury',
      assignedActivityIds: [],
      active: true,
    });
    setJuryModalOpen(true);
  };

  const openEditJury = (j: JuryMember) => {
    setEditingJury(j);
    setJuryForm({
      email: j.email,
      name: j.name,
      district: j.district || '',
      roleTitle: j.roleTitle || 'Camporee Jury',
      assignedActivityIds: j.assignedActivityIds || [],
      active: j.active,
    });
    setJuryModalOpen(true);
  };

  const toggleJuryActivity = (actId: string) => {
    setJuryForm((prev) => {
      const exists = prev.assignedActivityIds.includes(actId);
      return {
        ...prev,
        assignedActivityIds: exists
          ? prev.assignedActivityIds.filter((id) => id !== actId)
          : [...prev.assignedActivityIds, actId],
      };
    });
  };

  const handleSaveJury = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    try {
      await saveJuryMember(juryForm, !editingJury);
      setStatusMessage(`Saved Jury assignment for ${juryForm.name} (${juryForm.email.toLowerCase()}).`);
      setJuryModalOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save Jury member.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMessage(null);
    try {
      await saveAdminEmail(adminForm, true);
      setStatusMessage(`Added Camporee Admin: ${adminForm.name} (${adminForm.email.toLowerCase()}).`);
      setAdminModalOpen(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save Admin.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCentralSheet = async () => {
    if (!accessToken) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const res = await createCamporeeDriveAndSheet(accessToken, customSheetTitle);
      await saveSheetsConfig(res);
      setStatusMessage(
        `Created "${res.spreadsheetTitle}" in Google Drive and linked it for all Jury QR scans.`
      );
      setConfirmCreateSheet(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Google Sheet creation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleInspectSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !existingSheetInput.trim()) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const meta = await inspectExistingSpreadsheet(accessToken, existingSheetInput);
      setInspectedSheet({
        ...meta,
        selectedTab: meta.tabNames[0] || 'Sheet1',
      });
      setConfirmLinkSheet(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not inspect Google Sheet.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmLinkSheet = async () => {
    if (!inspectedSheet) return;
    setBusy(true);
    try {
      await saveSheetsConfig({
        spreadsheetId: inspectedSheet.spreadsheetId,
        spreadsheetTitle: inspectedSheet.spreadsheetTitle,
        spreadsheetUrl: inspectedSheet.spreadsheetUrl,
        sheetTabName: inspectedSheet.selectedTab,
      });
      setStatusMessage(
        `Linked existing sheet "${inspectedSheet.spreadsheetTitle}" (Tab: ${inspectedSheet.selectedTab}).`
      );
      setConfirmLinkSheet(false);
      setExistingSheetInput('');
      setInspectedSheet(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
            Camporee Admin Console
          </h1>
          <p className="text-sm text-[#5C665E]">
            Manage Jury officials for Programs & Adventure Bases, delegated Admins, and the
            centralized Google Drive & Sheets integration.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white border border-[#DDE4DD] rounded-xl shrink-0">
          {(
            [
              { id: 'users', label: 'Users & Jury' },
              { id: 'sheets', label: 'Google Sheets' },
              { id: 'camp', label: 'Site Settings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#424B44] hover:bg-[#F1F4F1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-xl bg-[#EEF4EE] border border-[#B7D1B9] p-4 flex items-center justify-between gap-4 text-sm text-[#143325]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between gap-4 text-sm text-red-800">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: USERS & JURY */}
      {activeTab === 'users' && (
        <div className="space-y-8">
          {/* Jury Assignment Section */}
          <section className="bg-white border border-[#DDE4DD] rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-[#EEF2EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141A15]">
                  Jury Officials (Programs & Adventure Bases)
                </h2>
                <p className="text-xs text-[#5C665E]">
                  Assigned Jury sign in with Google to scan participant QR cards and verify
                  attendance.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewJury}
                className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Jury Official</span>
              </button>
            </div>

            {juryMembers.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-[#141A15]">No Jury officials added yet</p>
                <p className="text-xs text-[#5C665E]">
                  Add Jury officials by their Google email and assign them to specific Programs or
                  Adventure Bases.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EEF2EE]">
                {juryMembers.map((j) => {
                  const assignedTitles = j.assignedActivityIds
                    .map((id) => activities.find((a) => a.id === id)?.title || id)
                    .slice(0, 6);

                  return (
                    <div
                      key={j.email}
                      className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C665E]">
                          <span
                            className={`font-semibold ${
                              j.active ? 'text-[#1B4332]' : 'text-[#B45309]'
                            }`}
                          >
                            {j.active ? 'Active Jury' : 'Inactive'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{j.email}</span>
                          {j.district && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{j.district}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-base font-bold text-[#141A15]">{j.name}</h3>
                        <p className="text-xs text-[#424B44]">
                          {assignedTitles.length > 0
                            ? `Assigned: ${assignedTitles.join(', ')}`
                            : 'No specific activities assigned yet'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditJury(j)}
                          className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-[#141A15] bg-white border border-[#CFD8CF] rounded-lg hover:bg-[#F1F4F1] inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit Assignments</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setJuryDeleteTarget(j)}
                          className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-red-700 hover:bg-red-50"
                          title="Remove Jury"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Delegated Admins Section */}
          <section className="bg-white border border-[#DDE4DD] rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-[#EEF2EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#141A15]">
                  Camporee Administrators
                </h2>
                <p className="text-xs text-[#5C665E]">
                  Full edit control over map locations, venues, program schedules, adventure bases,
                  and user roles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminForm({ email: '', name: '', district: 'State HQ', active: true });
                  setAdminModalOpen(true);
                }}
                className="min-h-[40px] px-4 py-2 bg-white text-[#141A15] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#F1F4F1] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Add Admin</span>
              </button>
            </div>

            <div className="divide-y divide-[#EEF2EE]">
              <div className="p-5 flex items-center justify-between gap-4 bg-[#FAFBF9]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-[#1B4332] font-semibold">
                    <span>Primary State Admin</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#424B44]">{BOOTSTRAPPED_ADMIN_EMAIL}</span>
                  </div>
                  <p className="text-sm font-bold text-[#141A15]">
                    {user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
                      ? user.displayName || 'Camporee Chief Admin'
                      : 'Camporee Chief Admin'}
                  </p>
                </div>
                <span className="text-xs font-medium text-[#5C665E]">Root Account</span>
              </div>

              {adminEmails.map((adm) => (
                <div
                  key={adm.email}
                  className="p-5 flex items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-[#5C665E]">
                      <span className="font-semibold text-[#1B4332]">Delegated Admin</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{adm.email}</span>
                      {adm.district && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{adm.district}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[#141A15]">{adm.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminDeleteTarget(adm)}
                    className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-[#D4DDD4] text-red-700 hover:bg-red-50"
                    title="Remove Admin"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: GOOGLE SHEETS & DRIVE */}
      {activeTab === 'sheets' && (
        <div className="space-y-6">
          {!hasWorkspaceToken && (
            <div className="bg-[#FAF5EB] border border-[#E7CFA2] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-[#6B4212]">
                  Connect Google Drive & Sheets Session
                </h2>
                <p className="text-xs text-[#6B4212]">
                  Sign in with Google to authorize creating or linking the centralized Camporee
                  attendance spreadsheet in your Drive.
                </p>
              </div>
              <GoogleSignInButton
                onClick={() => {
                  void signInWithGoogle();
                }}
                disabled={signingIn}
                label={signingIn ? 'Connecting...' : 'Connect Drive & Sheets'}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Option A: Create New Sheet */}
            <div className="bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#141A15]">
                  Provision New Centralized Sheet
                </h2>
              </div>
              <p className="text-xs text-[#5C665E] leading-relaxed">
                Automatically creates a Camporee folder and centralized Google Sheet with pre-set
                headers (`Timestamp`, `Activity Name`, `Type`, `Venue`, `UID Number`, `Participant
                Name`, `District`, `Verified By Jury`, `Record ID`).
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Spreadsheet Title
                </label>
                <input
                  value={customSheetTitle}
                  onChange={(e) => setCustomSheetTitle(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <button
                type="button"
                onClick={() => setConfirmCreateSheet(true)}
                disabled={!hasWorkspaceToken || busy}
                className="min-h-[42px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] disabled:opacity-50"
              >
                Create Folder & Sheet in Drive
              </button>
            </div>

            {/* Option B: Link Existing Sheet */}
            <form
              onSubmit={handleInspectSheet}
              className="bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <Database className="h-5 w-5 text-[#1B4332]" />
                <h2 className="font-display text-lg font-bold text-[#141A15]">
                  Link Existing Google Sheet
                </h2>
              </div>
              <p className="text-xs text-[#5C665E] leading-relaxed">
                Paste the URL or Spreadsheet ID of an existing Google Sheet shared with your Jury
                accounts. The app inspects exact tab names automatically.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Google Sheet URL or ID
                </label>
                <input
                  required
                  value={existingSheetInput}
                  onChange={(e) => setExistingSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>

              <button
                type="submit"
                disabled={!hasWorkspaceToken || !existingSheetInput.trim() || busy}
                className="min-h-[42px] px-4 py-2 bg-[#141A15] text-white text-xs font-semibold rounded-lg hover:bg-[#2B332C] disabled:opacity-50"
              >
                {busy ? 'Inspecting...' : 'Inspect & Link Sheet'}
              </button>
            </form>
          </div>

          {sheetsConfig?.spreadsheetId && (
            <div className="bg-white border border-[#DDE4DD] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#1B4332]">Active Centralized Sheet</p>
                <h3 className="font-display text-base font-bold text-[#141A15]">
                  {sheetsConfig.spreadsheetTitle}
                </h3>
                <p className="text-xs font-mono text-[#5C665E]">
                  ID: {sheetsConfig.spreadsheetId} · Tab: {sheetsConfig.sheetTabName || 'All_Attendance'}
                </p>
              </div>
              {sheetsConfig.spreadsheetUrl && (
                <a
                  href={sheetsConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-4 py-2 bg-[#EEF4EE] text-[#1B4332] text-xs font-semibold rounded-lg hover:bg-[#DFEBDF] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CAMPOREE SITE SETTINGS & SEEDING */}
      {activeTab === 'camp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await saveGeneralConfig(campTitle, locationNote);
                setStatusMessage('Updated Camporee general info and map banner note.');
              } finally {
                setBusy(false);
              }
            }}
            className="lg:col-span-7 bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-bold text-[#141A15]">
              Camporee Title & Map Update Notice
            </h2>
            <div>
              <label className="block text-xs font-semibold text-[#424B44] mb-1">
                Camporee Heading
              </label>
              <input
                required
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#424B44] mb-1">
                Map & Ground Notice
              </label>
              <textarea
                rows={3}
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                className="w-full p-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[40px] px-5 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325]"
            >
              {busy ? 'Saving...' : 'Save Site Info'}
            </button>
          </form>

          <div className="lg:col-span-5 bg-white border border-[#DDE4DD] rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#141A15]">
              Camporee Database Summary
            </h2>
            <dl className="divide-y divide-[#EEF2EE] text-sm">
              <div className="py-2.5 flex justify-between">
                <dt className="text-[#5C665E]">Mapped Locations</dt>
                <dd className="font-mono font-bold tabular-nums">{locations.length}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-[#5C665E]">Venues</dt>
                <dd className="font-mono font-bold tabular-nums">{venues.length}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-[#5C665E]">Programs & Adventure Bases</dt>
                <dd className="font-mono font-bold tabular-nums">{activities.length}</dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-[#5C665E]">Active Jury Officials</dt>
                <dd className="font-mono font-bold tabular-nums">
                  {juryMembers.filter((j) => j.active).length}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between">
                <dt className="text-[#5C665E]">Verified QR Check-ins</dt>
                <dd className="font-mono font-bold tabular-nums">{attendanceRecords.length}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  await seedStarterCamporeeData();
                  setStatusMessage('Starter Kerala State BSG Camporee locations, venues, and programs loaded.');
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="w-full min-h-[42px] px-4 py-2 bg-[#F7F8F5] text-[#1B4332] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#EEF4EE]"
            >
              Load / Restore Starter Camporee Data
            </button>
          </div>
        </div>
      )}

      {/* Jury Editor Modal */}
      {juryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveJury}
            className="w-full max-w-lg bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                {editingJury ? 'Edit Jury Assignment' : 'Assign Jury Official'}
              </h3>
              <button
                type="button"
                onClick={() => setJuryModalOpen(false)}
                className="p-1.5 rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Google Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingJury)}
                    value={juryForm.email}
                    onChange={(e) => setJuryForm({ ...juryForm, email: e.target.value })}
                    placeholder="jury.official@gmail.com"
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg disabled:bg-[#F1F4F1] focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Full Name
                  </label>
                  <input
                    required
                    value={juryForm.name}
                    onChange={(e) => setJuryForm({ ...juryForm, name: e.target.value })}
                    placeholder="e.g. V. Vijayan"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    District
                  </label>
                  <input
                    value={juryForm.district}
                    onChange={(e) => setJuryForm({ ...juryForm, district: e.target.value })}
                    placeholder="e.g. Kozhikode"
                    className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#424B44]">
                  Assign to Programs & Adventure Bases
                </p>
                {activities.length === 0 ? (
                  <p className="text-xs text-[#5C665E]">
                    No programs or adventure bases created yet.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-[#DCE3DC] rounded-xl divide-y divide-[#EEF2EE]">
                    {activities.map((act) => {
                      const checked = juryForm.assignedActivityIds.includes(act.id);
                      return (
                        <label
                          key={act.id}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-xs hover:bg-[#FAFBF9] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleJuryActivity(act.id)}
                            className="h-4 w-4 accent-[#1B4332]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[#141A15] truncate">{act.title}</p>
                            <p className="text-[11px] text-[#5C665E] truncate">
                              {act.type === 'adventure' ? 'Adventure Base' : 'Program'} ·{' '}
                              {act.venueName}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-[#141A15] cursor-pointer">
                <input
                  type="checkbox"
                  checked={juryForm.active}
                  onChange={(e) => setJuryForm({ ...juryForm, active: e.target.checked })}
                  className="h-4 w-4 accent-[#1B4332]"
                />
                <span>Active Jury Permission (can scan QR codes)</span>
              </label>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setJuryModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {busy ? 'Saving...' : 'Save Jury'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Delegated Admin Modal */}
      {adminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveAdmin}
            className="w-full max-w-md bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-lg font-bold text-[#141A15]">
                Add Delegated Camporee Admin
              </h3>
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="p-1.5 rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  Google Email Address
                </label>
                <input
                  type="email"
                  required
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="coordinator@gmail.com"
                  className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">Full Name</label>
                <input
                  required
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#424B44] mb-1">
                  District / Wing
                </label>
                <input
                  value={adminForm.district}
                  onChange={(e) => setAdminForm({ ...adminForm, district: e.target.value })}
                  className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAdminModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-5 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325]"
              >
                {busy ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmations */}
      <ConfirmDialog
        open={confirmCreateSheet}
        title="Create Centralized Google Sheet & Drive Folder"
        description="Create a new Google Drive folder and centralized Google Sheet for Camporee attendance tracking?"
        details={[
          { label: 'Folder', value: 'Kerala State BSG Camporee - Attendance Logs' },
          { label: 'Sheet Title', value: customSheetTitle },
        ]}
        confirmLabel="Create Sheet"
        busy={busy}
        onCancel={() => setConfirmCreateSheet(false)}
        onConfirm={handleCreateCentralSheet}
      />

      <ConfirmDialog
        open={confirmLinkSheet}
        title="Link Existing Google Sheet"
        description={`Set "${inspectedSheet?.spreadsheetTitle || ''}" as the centralized Camporee attendance spreadsheet?`}
        details={[
          { label: 'Spreadsheet ID', value: inspectedSheet?.spreadsheetId || '' },
          { label: 'Target Tab', value: inspectedSheet?.selectedTab || '' },
        ]}
        confirmLabel="Link Spreadsheet"
        busy={busy}
        onCancel={() => setConfirmLinkSheet(false)}
        onConfirm={handleConfirmLinkSheet}
      />

      <ConfirmDialog
        open={Boolean(juryDeleteTarget)}
        title="Remove Jury Official"
        description={`Revoke Jury QR scanning access for ${juryDeleteTarget?.name || ''} (${
          juryDeleteTarget?.email || ''
        })?`}
        confirmLabel="Remove Jury"
        tone="danger"
        busy={busy}
        onCancel={() => setJuryDeleteTarget(null)}
        onConfirm={async () => {
          if (!juryDeleteTarget) return;
          setBusy(true);
          try {
            await deleteJuryMember(juryDeleteTarget.email);
            setJuryDeleteTarget(null);
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(adminDeleteTarget)}
        title="Remove Delegated Admin"
        description={`Revoke Admin privileges for ${adminDeleteTarget?.name || ''} (${
          adminDeleteTarget?.email || ''
        })?`}
        confirmLabel="Remove Admin"
        tone="danger"
        busy={busy}
        onCancel={() => setAdminDeleteTarget(null)}
        onConfirm={async () => {
          if (!adminDeleteTarget) return;
          setBusy(true);
          try {
            await deleteAdminEmail(adminDeleteTarget.email);
            setAdminDeleteTarget(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
};
