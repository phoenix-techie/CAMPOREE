import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderUp,
  ImageUp,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useCamporee } from '../context/CamporeeContext';
import {
  appendAttendanceRowsToSheet,
  createCamporeeDriveAndSheet,
  uploadActivityCsvToDrive,
} from '../lib/googleWorkspace';
import {
  formatCamporeeTimestamp,
  parseScoutQrPayload,
  sanitizeFirestoreId,
} from '../lib/qrParser';
import { AttendanceRecord, ParsedScoutQr } from '../types/camporee';
import { ConfirmDialog } from './ConfirmDialog';
import { GoogleSignInButton } from './GoogleSignInButton';

interface JuryScannerSectionProps {
  preselectedActivityId: string | null;
}

export const JuryScannerSection: React.FC<JuryScannerSectionProps> = ({
  preselectedActivityId,
}) => {
  const {
    user,
    role,
    juryProfile,
    accessToken,
    hasWorkspaceToken,
    activities,
    attendanceRecords,
    sheetsConfig,
    signingIn,
    signInWithGoogle,
    saveSheetsConfig,
    recordAttendance,
    markAttendanceSynced,
  } = useCamporee();

  const isAuthorized = role === 'admin' || role === 'jury';

  // Ordered activities: assigned to jury first
  const orderedActivities = useMemo(() => {
    if (role !== 'jury' || !juryProfile) return activities;
    const assignedSet = new Set(juryProfile.assignedActivityIds);
    return [...activities].sort((a, b) => {
      const aAssigned = assignedSet.has(a.id) ? 0 : 1;
      const bAssigned = assignedSet.has(b.id) ? 0 : 1;
      return aAssigned - bAssigned;
    });
  }, [activities, role, juryProfile]);

  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  useEffect(() => {
    if (preselectedActivityId && activities.some((a) => a.id === preselectedActivityId)) {
      setSelectedActivityId(preselectedActivityId);
      return;
    }
    if (!selectedActivityId && orderedActivities.length > 0) {
      setSelectedActivityId(orderedActivities[0].id);
    }
  }, [preselectedActivityId, activities, orderedActivities, selectedActivityId]);

  const selectedActivity = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) || null,
    [activities, selectedActivityId]
  );

  // Camera Scanner state
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Manual & Test QR Card state
  const [manualInput, setManualInput] = useState('');
  const [testQrOpen, setTestQrOpen] = useState(false);
  const [testUid, setTestUid] = useState('KSBSG-2026-EKM-0412');
  const [testName, setTestName] = useState('Arjun Menon');
  const [testDistrict, setTestDistrict] = useState('Ernakulam');

  // Pending Verification Modal state (after QR scan)
  const [pendingScan, setPendingScan] = useState<{
    parsed: ParsedScoutQr;
    timestampIso: string;
    isDuplicate: boolean;
  } | null>(null);
  const [editUid, setEditUid] = useState('');
  const [editName, setEditName] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [submittingScan, setSubmittingScan] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Confirm dialogs for Workspace mutations
  const [confirmCreateSheet, setConfirmCreateSheet] = useState(false);
  const [confirmBatchSync, setConfirmBatchSync] = useState(false);
  const [confirmDriveBackup, setConfirmDriveBackup] = useState(false);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  // Table filter
  const [logSearch, setLogSearch] = useState('');
  const [filterBySelected, setFilterBySelected] = useState(true);

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setCameraRunning(false);
  };

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  const handleDecodedText = (rawText: string) => {
    if (!selectedActivity) {
      setFeedbackBanner({
        tone: 'error',
        message: 'Select a scheduled Program or Adventure Base before scanning.',
      });
      return;
    }
    try {
      const parsed = parseScoutQrPayload(rawText);
      const isDuplicate = attendanceRecords.some(
        (r) =>
          r.activityId === selectedActivity.id &&
          r.uidNumber.toLowerCase() === parsed.uidNumber.toLowerCase()
      );
      setEditUid(parsed.uidNumber);
      setEditName(parsed.participantName || '');
      setEditDistrict(parsed.district || '');
      setPendingScan({
        parsed,
        timestampIso: formatCamporeeTimestamp(new Date()),
        isDuplicate,
      });
      setFeedbackBanner(null);
      if (cameraRunning) {
        void stopCamera();
      }
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Invalid QR code payload.',
      });
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setFeedbackBanner(null);
    if (!selectedActivity) {
      setCameraError('Select a Program or Adventure Base first.');
      return;
    }
    try {
      await stopCamera();
      const qr = new Html5Qrcode('camporee-qr-reader');
      scannerRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // Ignore per-frame decode misses
        }
      );
      setCameraRunning(true);
    } catch (err) {
      setCameraRunning(false);
      setCameraError(
        err instanceof Error
          ? `${err.message}. You can also scan a QR image file or enter UID manually.`
          : 'Camera unavailable. Use QR image upload or manual UID entry below.'
      );
    }
  };

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    try {
      const qr = new Html5Qrcode('camporee-qr-file-temp');
      const decoded = await qr.scanFile(file, false);
      qr.clear();
      handleDecodedText(decoded);
    } catch {
      setCameraError('No readable QR code found in the selected image.');
    }
  };

  const handleConfirmAttendance = async () => {
    if (!pendingScan || !selectedActivity || !editUid.trim()) return;
    setSubmittingScan(true);
    setFeedbackBanner(null);

    try {
      const tempRecord: Omit<
        AttendanceRecord,
        'createdAt' | 'verifiedByUid' | 'verifiedByEmail' | 'verifiedByName'
      > = {
        id: sanitizeFirestoreId('att', editUid),
        activityId: selectedActivity.id,
        activityName: selectedActivity.title,
        activityType: selectedActivity.type,
        venueName: selectedActivity.venueName,
        uidNumber: editUid.trim(),
        participantName: editName.trim() || undefined,
        district: editDistrict.trim() || undefined,
        patrol: pendingScan.parsed.patrol,
        timestampIso: pendingScan.timestampIso,
        sheetSynced: false,
      };

      const saved = await recordAttendance(tempRecord);

      if (accessToken && sheetsConfig?.spreadsheetId) {
        try {
          const syncRes = await appendAttendanceRowsToSheet(
            accessToken,
            sheetsConfig.spreadsheetId,
            sheetsConfig.sheetTabName || 'All_Attendance',
            [saved]
          );
          await markAttendanceSynced(saved.id, syncRes.updatedRange);
          setFeedbackBanner({
            tone: 'success',
            message: `Verified UID ${saved.uidNumber} for ${saved.activityName} and logged row to Google Sheet (${syncRes.updatedRange}).`,
          });
        } catch (sheetErr) {
          setFeedbackBanner({
            tone: 'warning',
            message: `Saved UID ${saved.uidNumber} to Camporee database, but Google Sheet sync failed: ${
              sheetErr instanceof Error ? sheetErr.message : 'Token expired'
            }. Use "Sync Pending Rows" after reconnecting Google.`,
          });
        }
      } else {
        setFeedbackBanner({
          tone: 'warning',
          message: `Verified UID ${saved.uidNumber} in Camporee database. Connect Google Drive & Sheets (or initialize a centralized Sheet) to push rows automatically.`,
        });
      }

      setPendingScan(null);
      setManualInput('');
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Failed to verify attendance.',
      });
    } finally {
      setSubmittingScan(false);
    }
  };

  const pendingUnsynced = useMemo(
    () => attendanceRecords.filter((r) => !r.sheetSynced),
    [attendanceRecords]
  );

  const handleBatchSync = async () => {
    if (!accessToken || !sheetsConfig?.spreadsheetId || pendingUnsynced.length === 0) return;
    setWorkspaceBusy(true);
    try {
      const res = await appendAttendanceRowsToSheet(
        accessToken,
        sheetsConfig.spreadsheetId,
        sheetsConfig.sheetTabName || 'All_Attendance',
        pendingUnsynced
      );
      for (const rec of pendingUnsynced) {
        await markAttendanceSynced(rec.id, res.updatedRange);
      }
      setFeedbackBanner({
        tone: 'success',
        message: `Synced ${pendingUnsynced.length} pending attendance row(s) to Google Sheet (${res.updatedRange}).`,
      });
      setConfirmBatchSync(false);
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Batch sync failed.',
      });
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleCreateSheetFromScanner = async () => {
    if (!accessToken) return;
    setWorkspaceBusy(true);
    try {
      const created = await createCamporeeDriveAndSheet(accessToken);
      await saveSheetsConfig(created);
      setFeedbackBanner({
        tone: 'success',
        message: `Created "${created.spreadsheetTitle}" in Google Drive and linked it as the centralized Camporee attendance sheet.`,
      });
      setConfirmCreateSheet(false);
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Could not create Google Sheet.',
      });
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return attendanceRecords.filter((r) => {
      if (filterBySelected && selectedActivity && r.activityId !== selectedActivity.id) {
        return false;
      }
      if (!q) return true;
      return (
        r.uidNumber.toLowerCase().includes(q) ||
        r.activityName.toLowerCase().includes(q) ||
        (r.participantName || '').toLowerCase().includes(q) ||
        (r.district || '').toLowerCase().includes(q)
      );
    });
  }, [attendanceRecords, filterBySelected, selectedActivity, logSearch]);

  const handleBackupToDrive = async () => {
    if (!accessToken || filteredLogs.length === 0) return;
    setWorkspaceBusy(true);
    try {
      const title =
        filterBySelected && selectedActivity ? selectedActivity.title : 'All_Camporee_Activities';
      const uploaded = await uploadActivityCsvToDrive(
        accessToken,
        title,
        filteredLogs,
        sheetsConfig?.folderId
      );
      setFeedbackBanner({
        tone: 'success',
        message: `Saved "${uploaded.fileName}" (${filteredLogs.length} rows) to Google Drive.`,
      });
      setConfirmDriveBackup(false);
    } catch (err) {
      setFeedbackBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Drive backup upload failed.',
      });
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const downloadSampleQrPng = () => {
    const canvas = document.getElementById('sample-scout-qr-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${testUid}.png`;
    a.click();
  };

  if (!isAuthorized) {
    return (
      <div className="space-y-8">
        <div className="bg-white border border-[#DDE4DD] rounded-2xl p-6 sm:p-10 max-w-2xl mx-auto text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#EEF4EE] text-[#1B4332] flex items-center justify-center">
            <QrCode className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-[#141A15]">
              Jury QR Attendance Verification
            </h1>
            <p className="text-sm text-[#424B44] leading-relaxed">
              {user
                ? `Signed in as ${user.email} (Guest role). Only Jury officials assigned by the Camporee Admin or Administrators can scan participant ID QR codes and write to the centralized attendance sheet.`
                : 'Sign in with an authorized Jury or Admin Google account to scan participant ID QR codes and log verified attendance to Google Drive and Sheets.'}
            </p>
          </div>

          {!user && (
            <div className="flex justify-center">
              <GoogleSignInButton
                onClick={() => {
                  void signInWithGoogle();
                }}
                disabled={signingIn}
                label={signingIn ? 'Signing in...' : 'Sign in with Google'}
              />
            </div>
          )}

          <div className="pt-4 border-t border-[#EEF2EE]">
            <button
              type="button"
              onClick={() => setTestQrOpen(true)}
              className="text-xs font-semibold text-[#1B4332] hover:underline"
            >
              Preview Sample Scout ID Card QR Format
            </button>
          </div>
        </div>

        {/* Sample Scout ID QR Card Modal */}
        {testQrOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm bg-white border border-[#DCE3DC] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-[#141A15]">
                  Sample Scout ID Card QR
                </h3>
                <button
                  type="button"
                  onClick={() => setTestQrOpen(false)}
                  className="p-1.5 rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex justify-center p-4 bg-[#F7F8F5] rounded-xl border border-[#E2E8E2]">
                <QRCodeCanvas
                  id="sample-scout-qr-canvas"
                  value={JSON.stringify({
                    uid: testUid,
                    name: testName,
                    district: testDistrict,
                  })}
                  size={180}
                />
              </div>
              <p className="text-xs text-[#5C665E] text-center font-mono">
                {testUid} · {testName} ({testDistrict})
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
            Jury QR Attendance Scanner
          </h1>
          <p className="text-sm text-[#5C665E]">
            Scan Scout or Guide ID card QR codes to verify attendance with Activity Name, UID
            Number, and Timestamp, synced to Google Sheets & Drive.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTestQrOpen(true)}
          className="min-h-[40px] px-4 py-2 bg-white text-[#141A15] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#F1F4F1] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>Test ID QR Generator</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <div
          className={`rounded-xl border p-4 flex items-start justify-between gap-3 text-sm ${
            feedbackBanner.tone === 'success'
              ? 'bg-[#EEF4EE] border-[#B7D1B9] text-[#143325]'
              : feedbackBanner.tone === 'warning'
              ? 'bg-[#FAF5EB] border-[#E7CFA2] text-[#6B4212]'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedbackBanner.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Google Drive & Centralized Sheet Status Strip */}
      <div className="bg-white border border-[#DDE4DD] rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EEF4EE] text-[#1B4332] flex items-center justify-center shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C665E]">
              <span className="font-semibold text-[#141A15]">Centralized Google Sheet</span>
              <span aria-hidden="true">·</span>
              <span className={hasWorkspaceToken ? 'text-[#1B4332] font-semibold' : 'text-[#B45309] font-semibold'}>
                {hasWorkspaceToken ? 'Google Drive Session Active' : 'Drive Session Not Connected'}
              </span>
            </div>
            {sheetsConfig?.spreadsheetId ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#141A15] truncate">
                  {sheetsConfig.spreadsheetTitle || 'Camporee Attendance Sheet'}
                </p>
                {sheetsConfig.spreadsheetUrl && (
                  <a
                    href={sheetsConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B4332] hover:underline whitespace-nowrap"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5C665E]">
                No centralized Google Sheet linked yet. Admin can initialize one in Google Drive.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!hasWorkspaceToken && (
            <GoogleSignInButton
              onClick={() => {
                void signInWithGoogle();
              }}
              disabled={signingIn}
              label={signingIn ? 'Connecting...' : 'Connect Drive & Sheets'}
            />
          )}

          {hasWorkspaceToken && role === 'admin' && !sheetsConfig?.spreadsheetId && (
            <button
              type="button"
              onClick={() => setConfirmCreateSheet(true)}
              className="min-h-[40px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] transition-colors whitespace-nowrap"
            >
              Create Centralized Sheet in Drive
            </button>
          )}

          {hasWorkspaceToken && sheetsConfig?.spreadsheetId && pendingUnsynced.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBatchSync(true)}
              className="min-h-[40px] px-4 py-2 bg-[#B45309] text-white text-xs font-semibold rounded-lg hover:bg-[#92400E] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync {pendingUnsynced.length} Pending Row(s)</span>
            </button>
          )}
        </div>
      </div>

      {/* Scanner Workspace Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Activity Picker + QR Camera / Upload / Manual */}
        <div className="lg:col-span-5 bg-white border border-[#DDE4DD] rounded-2xl p-5 space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="scanner-activity-select"
              className="block text-xs font-semibold text-[#424B44]"
            >
              Active Program or Adventure Base
            </label>
            <select
              id="scanner-activity-select"
              value={selectedActivityId}
              onChange={(e) => setSelectedActivityId(e.target.value)}
              className="w-full h-11 px-3 text-sm font-medium bg-[#F7F8F5] border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
            >
              {orderedActivities.length === 0 ? (
                <option value="">No programs or bases available</option>
              ) : (
                orderedActivities.map((act) => {
                  const isMine =
                    role === 'jury' && juryProfile?.assignedActivityIds.includes(act.id);
                  return (
                    <option key={act.id} value={act.id}>
                      {isMine ? '★ ' : ''}
                      {act.title} ({act.type === 'adventure' ? 'Adventure' : 'Program'} ·{' '}
                      {act.venueName})
                    </option>
                  );
                })
              )}
            </select>
            {selectedActivity && (
              <p className="text-xs text-[#5C665E]">
                Venue: <strong className="text-[#141A15]">{selectedActivity.venueName}</strong> ·{' '}
                <span className="font-mono tabular-nums">
                  {selectedActivity.startTime}–{selectedActivity.endTime}
                </span>
              </p>
            )}
          </div>

          {/* Live QR Viewfinder */}
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border border-[#D4DDD4] bg-[#141A15] min-h-[240px] flex flex-col items-center justify-center relative">
              <div id="camporee-qr-reader" className="w-full" />
              {!cameraRunning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white/85 gap-2 pointer-events-none">
                  <Camera className="h-8 w-8 opacity-75" />
                  <p className="text-sm font-semibold">Camera Ready for ID Card QR</p>
                  <p className="text-xs text-white/65 max-w-xs">
                    Start the camera to scan a participant&apos;s Scout/Guide ID badge, or upload a
                    QR image below.
                  </p>
                </div>
              )}
            </div>
            <div id="camporee-qr-file-temp" className="hidden" />

            {cameraError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                {cameraError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              {!cameraRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    void startCamera();
                  }}
                  disabled={!selectedActivity}
                  className="min-h-[44px] px-4 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#143325] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  <Camera className="h-4 w-4" />
                  <span>Start Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void stopCamera();
                  }}
                  className="min-h-[44px] px-4 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 inline-flex items-center justify-center gap-1.5"
                >
                  <CameraOff className="h-4 w-4" />
                  <span>Stop Camera</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedActivity}
                className="min-h-[44px] px-4 py-2 bg-white text-[#141A15] border border-[#CFD8CF] text-xs font-semibold rounded-lg hover:bg-[#F1F4F1] disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <ImageUp className="h-4 w-4" />
                <span>Scan QR Image</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQrImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Manual UID / QR Payload Entry */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualInput.trim()) handleDecodedText(manualInput);
            }}
            className="pt-4 border-t border-[#EEF2EE] space-y-2"
          >
            <label className="block text-xs font-semibold text-[#424B44]">
              Manual UID Entry / QR Text Fallback
            </label>
            <div className="flex gap-2">
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. KSBSG-2026-EKM-0412"
                className="flex-1 h-10 px-3 text-sm font-mono bg-[#F7F8F5] border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
              />
              <button
                type="submit"
                disabled={!selectedActivity || !manualInput.trim()}
                className="min-h-[40px] px-4 py-2 bg-[#141A15] text-white text-xs font-semibold rounded-lg hover:bg-[#2B332C] disabled:opacity-40 whitespace-nowrap"
              >
                Verify UID
              </button>
            </div>
          </form>
        </div>

        {/* Right: Real-Time Attendance Log Table */}
        <div className="lg:col-span-7 bg-white border border-[#DDE4DD] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#EEF2EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#141A15]">
                Verified Attendance Ledger
              </h2>
              <p className="text-xs text-[#5C665E] tabular-nums">
                {filteredLogs.length} verified check-in(s)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterBySelected((p) => !p)}
                className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filterBySelected
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-white text-[#424B44] border-[#CFD8CF]'
                }`}
              >
                {filterBySelected ? 'Selected Activity Only' : 'All Activities'}
              </button>

              {hasWorkspaceToken && filteredLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDriveBackup(true)}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-[#F7F8F5] text-[#1B4332] border border-[#CFD8CF] rounded-lg hover:bg-[#EEF4EE] inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FolderUp className="h-3.5 w-3.5" />
                  <span>Save CSV to Drive</span>
                </button>
              )}
            </div>
          </div>

          <div className="px-5 py-3 bg-[#FAFBF9] border-b border-[#EEF2EE]">
            <div className="relative">
              <Search className="h-4 w-4 text-[#5C665E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter by UID number, participant name, or district..."
                className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-[#D4DDD4] rounded-lg focus:outline-none focus:border-[#1B4332]"
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-10 text-center space-y-1.5">
              <p className="text-sm font-semibold text-[#141A15]">No attendance recorded yet</p>
              <p className="text-xs text-[#5C665E]">
                Scan a participant&apos;s ID QR code or enter a UID to log their attendance row.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EEF2EE] text-[11px] font-semibold text-[#5C665E]">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">UID Number</th>
                    <th className="py-2.5 px-4">Participant</th>
                    <th className="py-2.5 px-4">Activity</th>
                    <th className="py-2.5 px-4 text-right">Google Sheet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EE] text-xs">
                  {filteredLogs.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#FAFBF9]">
                      <td className="py-3 px-4 font-mono text-[#424B44] tabular-nums whitespace-nowrap">
                        {rec.timestampIso}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[#141A15] tabular-nums whitespace-nowrap">
                        {rec.uidNumber}
                      </td>
                      <td className="py-3 px-4 text-[#141A15]">
                        <div className="font-medium">{rec.participantName || 'Scout / Guide'}</div>
                        {rec.district && (
                          <div className="text-[11px] text-[#5C665E]">{rec.district}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#424B44] max-w-[180px] truncate">
                        {rec.activityName}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {rec.sheetSynced ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#1B4332]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Synced</span>
                          </span>
                        ) : (
                          <span className="font-medium text-[#B45309]">Queued</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Explicit Participant Verification & Google Sheet Confirmation Modal */}
      {pendingScan && selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#1B4332]" />
                <h3 className="font-display text-base font-bold text-[#141A15]">
                  Verify Participant Attendance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingScan(null)}
                disabled={submittingScan}
                className="p-1.5 rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {pendingScan.isDuplicate && (
                <div className="rounded-lg bg-[#FAF5EB] border border-[#E7CFA2] p-3 text-xs text-[#6B4212] flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#B45309]" />
                  <span>
                    UID <strong>{pendingScan.parsed.uidNumber}</strong> already has a verified
                    record for <strong>{selectedActivity.title}</strong>. Confirm only if logging
                    a re-entry.
                  </span>
                </div>
              )}

              <dl className="rounded-xl bg-[#F7F8F5] border border-[#E2E8E2] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5C665E]">Activity Name</dt>
                  <dd className="font-semibold text-[#141A15] text-right">
                    {selectedActivity.title}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5C665E]">Venue</dt>
                  <dd className="text-[#141A15] text-right">{selectedActivity.venueName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5C665E]">Timestamp</dt>
                  <dd className="font-mono tabular-nums text-[#141A15]">
                    {pendingScan.timestampIso}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5C665E]">Destination Sheet</dt>
                  <dd className="text-[#1B4332] font-semibold text-right truncate">
                    {sheetsConfig?.spreadsheetId
                      ? sheetsConfig.spreadsheetTitle || 'Centralized Camporee Sheet'
                      : 'Database Queue (Link Sheet in Admin)'}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#424B44] mb-1">
                    Participant UID Number
                  </label>
                  <input
                    required
                    value={editUid}
                    onChange={(e) => setEditUid(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#424B44] mb-1">
                      Name (Optional)
                    </label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Scout / Guide Name"
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#424B44] mb-1">
                      District (Optional)
                    </label>
                    <input
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      placeholder="e.g. Thrissur"
                      className="w-full h-10 px-3 text-sm border border-[#CFD8CF] rounded-lg focus:outline-none focus:border-[#1B4332]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFBF9] border-t border-[#EEF2EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingScan(null)}
                disabled={submittingScan}
                className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#424B44] bg-white border border-[#D4DDD4] rounded-lg hover:bg-[#F1F4F1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAttendance}
                disabled={submittingScan || !editUid.trim()}
                className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-60"
              >
                {submittingScan
                  ? 'Logging...'
                  : hasWorkspaceToken && sheetsConfig?.spreadsheetId
                  ? 'Confirm & Append to Sheet'
                  : 'Confirm Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Scout ID QR Card Generator Modal */}
      {testQrOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#DCE3DC] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF2EE]">
              <h3 className="font-display text-base font-bold text-[#141A15]">
                Test Scout ID Card QR Generator
              </h3>
              <button
                type="button"
                onClick={() => setTestQrOpen(false)}
                className="p-1.5 rounded-lg text-[#5C665E] hover:bg-[#F1F4F1]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#424B44] mb-1">
                    UID Number
                  </label>
                  <input
                    value={testUid}
                    onChange={(e) => setTestUid(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs font-mono border border-[#CFD8CF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#424B44] mb-1">
                    Name
                  </label>
                  <input
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-[#CFD8CF] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#424B44] mb-1">
                    District
                  </label>
                  <input
                    value={testDistrict}
                    onChange={(e) => setTestDistrict(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs border border-[#CFD8CF] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-center p-5 bg-[#F7F8F5] border border-[#E2E8E2] rounded-xl">
                <QRCodeCanvas
                  id="sample-scout-qr-canvas"
                  value={JSON.stringify({
                    uid: testUid,
                    name: testName,
                    district: testDistrict,
                  })}
                  size={180}
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={downloadSampleQrPng}
                  className="min-h-[38px] px-4 py-2 text-xs font-semibold text-[#141A15] bg-white border border-[#CFD8CF] rounded-lg hover:bg-[#F1F4F1]"
                >
                  Download QR PNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const payload = JSON.stringify({
                      uid: testUid,
                      name: testName,
                      district: testDistrict,
                    });
                    setTestQrOpen(false);
                    handleDecodedText(payload);
                  }}
                  disabled={!selectedActivity}
                  className="min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-[#1B4332] rounded-lg hover:bg-[#143325] disabled:opacity-50"
                >
                  Scan This Card Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmations for Google Workspace Mutations */}
      <ConfirmDialog
        open={confirmCreateSheet}
        title="Create Centralized Sheet in Google Drive"
        description="This will create a dedicated Camporee Attendance folder and centralized Google Sheet in your Google Drive for all Jury check-ins."
        details={[
          { label: 'Folder', value: 'Kerala State BSG Camporee - Attendance Logs' },
          { label: 'Spreadsheet', value: 'KSBSG State Camporee - Centralized Attendance' },
          { label: 'Columns', value: 'Timestamp, Activity, Venue, UID, Jury' },
        ]}
        confirmLabel="Create Folder & Sheet"
        busy={workspaceBusy}
        onCancel={() => setConfirmCreateSheet(false)}
        onConfirm={handleCreateSheetFromScanner}
      />

      <ConfirmDialog
        open={confirmBatchSync}
        title="Append Pending Attendance Rows to Google Sheet"
        description={`Append ${pendingUnsynced.length} queued attendance record(s) to "${
          sheetsConfig?.spreadsheetTitle || 'Centralized Camporee Sheet'
        }"?`}
        details={[
          { label: 'Pending Rows', value: String(pendingUnsynced.length) },
          { label: 'Target Tab', value: sheetsConfig?.sheetTabName || 'All_Attendance' },
        ]}
        confirmLabel="Append Rows"
        busy={workspaceBusy}
        onCancel={() => setConfirmBatchSync(false)}
        onConfirm={handleBatchSync}
      />

      <ConfirmDialog
        open={confirmDriveBackup}
        title="Save Activity Attendance CSV to Google Drive"
        description={`Upload a CSV snapshot of ${filteredLogs.length} verified attendance row(s) to your Camporee Google Drive folder?`}
        details={[
          {
            label: 'Scope',
            value:
              filterBySelected && selectedActivity
                ? selectedActivity.title
                : 'All Activities',
          },
          { label: 'Rows Included', value: String(filteredLogs.length) },
        ]}
        confirmLabel="Upload CSV to Drive"
        busy={workspaceBusy}
        onCancel={() => setConfirmDriveBackup(false)}
        onConfirm={handleBackupToDrive}
      />
    </div>
  );
};
