import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  getAccessToken,
  googleSignIn,
  handleFirestoreError,
  initAuth,
  logout,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AdminEmailRecord,
  Activity,
  AttendanceRecord,
  CampLocation,
  CamporeeGeneralConfig,
  CamporeeSheetsConfig,
  JuryMember,
  UserRole,
  Venue,
} from '../types/camporee';
import {
  SAMPLE_ACTIVITIES,
  SAMPLE_LOCATIONS,
  SAMPLE_VENUES,
} from '../data/seedCamporee';
import { sanitizeFirestoreId } from '../lib/qrParser';

interface CamporeeContextValue {
  user: User | null;
  authReady: boolean;
  role: UserRole;
  juryProfile: JuryMember | null;
  accessToken: string | null;
  hasWorkspaceToken: boolean;
  locations: CampLocation[];
  venues: Venue[];
  activities: Activity[];
  juryMembers: JuryMember[];
  adminEmails: AdminEmailRecord[];
  attendanceRecords: AttendanceRecord[];
  generalConfig: CamporeeGeneralConfig | null;
  sheetsConfig: CamporeeSheetsConfig | null;
  loadingPublic: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<string | null>;
  signOutUser: () => Promise<void>;
  seedStarterCamporeeData: () => Promise<void>;
  saveLocation: (loc: Omit<CampLocation, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  saveVenue: (venue: Omit<Venue, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteVenue: (id: string) => Promise<void>;
  saveActivity: (act: Omit<Activity, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  saveJuryMember: (jury: Omit<JuryMember, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteJuryMember: (email: string) => Promise<void>;
  saveAdminEmail: (adminRec: Omit<AdminEmailRecord, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  deleteAdminEmail: (email: string) => Promise<void>;
  saveGeneralConfig: (camporeeTitle: string, locationNote: string) => Promise<void>;
  saveSheetsConfig: (config: Omit<CamporeeSheetsConfig, 'configType' | 'updatedAt' | 'updatedBy'>) => Promise<void>;
  recordAttendance: (
    payload: Omit<AttendanceRecord, 'createdAt' | 'verifiedByUid' | 'verifiedByEmail' | 'verifiedByName'>
  ) => Promise<AttendanceRecord>;
  markAttendanceSynced: (
    recordId: string,
    sheetRowRange: string,
    driveFileId?: string
  ) => Promise<void>;
}

const CamporeeContext = createContext<CamporeeContextValue | null>(null);

export const CamporeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('guest');
  const [juryProfile, setJuryProfile] = useState<JuryMember | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [locations, setLocations] = useState<CampLocation[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [juryMembers, setJuryMembers] = useState<JuryMember[]>([]);
  const [adminEmails, setAdminEmails] = useState<AdminEmailRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [generalConfig, setGeneralConfig] = useState<CamporeeGeneralConfig | null>(null);
  const [sheetsConfig, setSheetsConfig] = useState<CamporeeSheetsConfig | null>(null);
  const [loadingPublic, setLoadingPublic] = useState(true);

  // Test Firestore connection on mount
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  // Auth listener & role resolution
  useEffect(() => {
    const unsubscribe = initAuth(async (nextUser, token) => {
      setUser(nextUser);
      setAccessToken(token || getAccessToken());

      if (!nextUser || !nextUser.email || !nextUser.emailVerified) {
        setRole('guest');
        setJuryProfile(null);
        setAuthReady(true);
        return;
      }

      const emailLower = nextUser.email.toLowerCase();

      try {
        // 1. Check bootstrapped admin or admins/{uid} or adminEmails/{email}
        if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
          setRole('admin');
        } else {
          const [uidAdminSnap, emailAdminSnap] = await Promise.all([
            getDoc(doc(db, 'admins', nextUser.uid)).catch(() => null),
            getDoc(doc(db, 'adminEmails', emailLower)).catch(() => null),
          ]);
          const isEmailAdmin =
            emailAdminSnap?.exists() && Boolean((emailAdminSnap.data() as AdminEmailRecord).active);
          if (uidAdminSnap?.exists() || isEmailAdmin) {
            setRole('admin');
          } else {
            // 2. Check juryMembers/{email}
            const jurySnap = await getDoc(doc(db, 'juryMembers', emailLower)).catch(() => null);
            if (jurySnap?.exists()) {
              const jData = jurySnap.data() as JuryMember;
              if (jData.active) {
                setRole('jury');
                setJuryProfile(jData);
              } else {
                setRole('guest');
                setJuryProfile(null);
              }
            } else {
              setRole('guest');
              setJuryProfile(null);
            }
          }
        }
      } catch (err) {
        console.error('Role resolution check failed:', err);
        setRole('guest');
        setJuryProfile(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Public real-time listeners (Map locations, Venues, Activities, General Config)
  useEffect(() => {
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) {
        setLoadingPublic(false);
      }
    };

    const unsubLocations = onSnapshot(
      query(collection(db, 'campLocations'), orderBy('name')),
      (snap) => {
        setLocations(snap.docs.map((d) => d.data() as CampLocation));
        markLoaded();
      },
      (err) => {
        setLoadingPublic(false);
        handleFirestoreError(err, OperationType.LIST, 'campLocations');
      }
    );

    const unsubVenues = onSnapshot(
      query(collection(db, 'venues'), orderBy('name')),
      (snap) => {
        setVenues(snap.docs.map((d) => d.data() as Venue));
        markLoaded();
      },
      (err) => {
        setLoadingPublic(false);
        handleFirestoreError(err, OperationType.LIST, 'venues');
      }
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'activities'), orderBy('startTime')),
      (snap) => {
        setActivities(snap.docs.map((d) => d.data() as Activity));
        markLoaded();
      },
      (err) => {
        setLoadingPublic(false);
        handleFirestoreError(err, OperationType.LIST, 'activities');
      }
    );

    const unsubGeneral = onSnapshot(
      doc(db, 'camporeeConfig', 'general'),
      (snap) => {
        if (snap.exists()) {
          setGeneralConfig(snap.data() as CamporeeGeneralConfig);
        } else {
          setGeneralConfig(null);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'camporeeConfig/general');
      }
    );

    return () => {
      unsubLocations();
      unsubVenues();
      unsubActivities();
      unsubGeneral();
    };
  }, []);

  // Role-gated listeners: Jury & Admin see attendance & sheets config; Admin sees juryMembers & adminEmails
  useEffect(() => {
    if (!authReady || !user || (role !== 'admin' && role !== 'jury')) {
      setAttendanceRecords([]);
      setSheetsConfig(null);
      return;
    }

    const unsubAttendance = onSnapshot(
      query(collection(db, 'attendance'), orderBy('timestampIso', 'desc')),
      (snap) => {
        setAttendanceRecords(snap.docs.map((d) => d.data() as AttendanceRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
    );

    const unsubSheetsConfig = onSnapshot(
      doc(db, 'camporeeConfig', 'sheets'),
      (snap) => {
        setSheetsConfig(snap.exists() ? (snap.data() as CamporeeSheetsConfig) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'camporeeConfig/sheets')
    );

    return () => {
      unsubAttendance();
      unsubSheetsConfig();
    };
  }, [authReady, user, role]);

  useEffect(() => {
    if (!authReady || !user || role !== 'admin') {
      setJuryMembers([]);
      setAdminEmails([]);
      return;
    }

    const unsubJury = onSnapshot(
      query(collection(db, 'juryMembers'), orderBy('name')),
      (snap) => {
        setJuryMembers(snap.docs.map((d) => d.data() as JuryMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'juryMembers')
    );

    const unsubAdmins = onSnapshot(
      query(collection(db, 'adminEmails'), orderBy('name')),
      (snap) => {
        setAdminEmails(snap.docs.map((d) => d.data() as AdminEmailRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'adminEmails')
    );

    return () => {
      unsubJury();
      unsubAdmins();
    };
  }, [authReady, user, role]);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const { user: signedInUser, accessToken: token } = await googleSignIn();
      setUser(signedInUser);
      setAccessToken(token);
      if (signedInUser.email) {
        const emailLower = signedInUser.email.toLowerCase();
        if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
          setRole('admin');
        } else {
          const [uidAdminSnap, emailAdminSnap, jurySnap] = await Promise.all([
            getDoc(doc(db, 'admins', signedInUser.uid)).catch(() => null),
            getDoc(doc(db, 'adminEmails', emailLower)).catch(() => null),
            getDoc(doc(db, 'juryMembers', emailLower)).catch(() => null),
          ]);
          const isEmailAdmin =
            emailAdminSnap?.exists() && Boolean((emailAdminSnap.data() as AdminEmailRecord).active);
          if (uidAdminSnap?.exists() || isEmailAdmin) {
            setRole('admin');
          } else if (jurySnap?.exists() && (jurySnap.data() as JuryMember).active) {
            setRole('jury');
            setJuryProfile(jurySnap.data() as JuryMember);
          } else {
            setRole('guest');
            setJuryProfile(null);
          }
        }
      }
      return token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setRole('guest');
    setJuryProfile(null);
  }, []);

  const seedStarterCamporeeData = useCallback(async () => {
    try {
      const batch = writeBatch(db);
      for (const loc of SAMPLE_LOCATIONS) {
        batch.set(doc(db, 'campLocations', loc.id), {
          ...loc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const ven of SAMPLE_VENUES) {
        batch.set(doc(db, 'venues', ven.id), {
          ...ven,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const act of SAMPLE_ACTIVITIES) {
        batch.set(doc(db, 'activities', act.id), {
          ...act,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'camporeeConfig', 'general'), {
        configType: 'general',
        camporeeTitle: 'Kerala State Bharat Scouts & Guides — State Camporee',
        locationNote:
          'Camp map coordinates and sub-camp pins are live and can be updated anytime by State Camporee Admins.',
        updatedBy: user?.email || BOOTSTRAPPED_ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seedStarterCamporeeData');
    }
  }, [user]);

  const saveLocation = useCallback(
    async (loc: Omit<CampLocation, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const path = `campLocations/${loc.id}`;
      try {
        const ref = doc(db, 'campLocations', loc.id);
        const payload: Record<string, unknown> = {
          id: loc.id,
          name: loc.name.trim().slice(0, 120),
          category: loc.category,
          sector: loc.sector.trim().slice(0, 60),
          mapX: Math.max(0, Math.min(100, Number(loc.mapX))),
          mapY: Math.max(0, Math.min(100, Number(loc.mapY))),
          status: loc.status,
          updatedAt: serverTimestamp(),
        };
        if (loc.description?.trim()) payload.description = loc.description.trim().slice(0, 600);
        if (loc.directions?.trim()) payload.directions = loc.directions.trim().slice(0, 400);
        if (loc.coordinatesLabel?.trim())
          payload.coordinatesLabel = loc.coordinatesLabel.trim().slice(0, 80);

        if (isNew) {
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          const existingSnap = await getDoc(ref);
          payload.createdAt = existingSnap.data()?.createdAt || serverTimestamp();
          await setDoc(ref, payload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    []
  );

  const deleteLocation = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'campLocations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `campLocations/${id}`);
    }
  }, []);

  const saveVenue = useCallback(
    async (venue: Omit<Venue, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const path = `venues/${venue.id}`;
      try {
        const ref = doc(db, 'venues', venue.id);
        const payload: Record<string, unknown> = {
          id: venue.id,
          name: venue.name.trim().slice(0, 120),
          zone: venue.zone.trim().slice(0, 80),
          capacity: Math.max(1, Math.min(50000, Math.round(Number(venue.capacity)))),
          status: venue.status,
          updatedAt: serverTimestamp(),
        };
        if (venue.locationId?.trim()) payload.locationId = venue.locationId.trim().slice(0, 128);
        if (venue.facilities?.trim()) payload.facilities = venue.facilities.trim().slice(0, 300);

        if (isNew) {
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          const existingSnap = await getDoc(ref);
          payload.createdAt = existingSnap.data()?.createdAt || serverTimestamp();
          await setDoc(ref, payload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    []
  );

  const deleteVenue = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'venues', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `venues/${id}`);
    }
  }, []);

  const saveActivity = useCallback(
    async (act: Omit<Activity, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const path = `activities/${act.id}`;
      try {
        const ref = doc(db, 'activities', act.id);
        const payload: Record<string, unknown> = {
          id: act.id,
          title: act.title.trim().slice(0, 140),
          type: act.type,
          category: act.category.trim().slice(0, 60),
          venueId: act.venueId.trim().slice(0, 128),
          venueName: act.venueName.trim().slice(0, 120),
          dayLabel: act.dayLabel.trim().slice(0, 60),
          startTime: act.startTime.trim().slice(0, 40),
          endTime: act.endTime.trim().slice(0, 40),
          status: act.status,
          imageKey: act.imageKey || (act.type === 'adventure' ? 'ropes' : 'grounds'),
          updatedAt: serverTimestamp(),
        };
        if (act.description?.trim()) payload.description = act.description.trim().slice(0, 800);
        if (act.safetyNotes?.trim()) payload.safetyNotes = act.safetyNotes.trim().slice(0, 400);
        if (act.juryDisplayNames && act.juryDisplayNames.length > 0) {
          payload.juryDisplayNames = act.juryDisplayNames.slice(0, 10).map((n) => n.slice(0, 120));
        }

        if (isNew) {
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          const existingSnap = await getDoc(ref);
          payload.createdAt = existingSnap.data()?.createdAt || serverTimestamp();
          await setDoc(ref, payload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    []
  );

  const deleteActivity = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `activities/${id}`);
    }
  }, []);

  const syncJuryDisplayNamesToActivities = useCallback(
    async (updatedJuryList: JuryMember[]) => {
      const activeJuries = updatedJuryList.filter((j) => j.active);
      const batch = writeBatch(db);
      let hasChanges = false;
      for (const act of activities) {
        const names = activeJuries
          .filter((j) => j.assignedActivityIds.includes(act.id))
          .map((j) => j.name)
          .slice(0, 10);
        const currentNames = act.juryDisplayNames || [];
        if (JSON.stringify(names) !== JSON.stringify(currentNames)) {
          batch.update(doc(db, 'activities', act.id), {
            juryDisplayNames: names,
            updatedAt: serverTimestamp(),
          });
          hasChanges = true;
        }
      }
      if (hasChanges) {
        await batch.commit();
      }
    },
    [activities]
  );

  const saveJuryMember = useCallback(
    async (jury: Omit<JuryMember, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const emailLower = jury.email.trim().toLowerCase();
      const path = `juryMembers/${emailLower}`;
      try {
        const ref = doc(db, 'juryMembers', emailLower);
        const payload: Record<string, unknown> = {
          email: emailLower,
          name: jury.name.trim().slice(0, 120),
          assignedActivityIds: (jury.assignedActivityIds || []).slice(0, 50),
          active: Boolean(jury.active),
          updatedAt: serverTimestamp(),
        };
        if (jury.district?.trim()) payload.district = jury.district.trim().slice(0, 80);
        if (jury.roleTitle?.trim()) payload.roleTitle = jury.roleTitle.trim().slice(0, 80);

        if (isNew) {
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          const existingSnap = await getDoc(ref);
          payload.createdAt = existingSnap.data()?.createdAt || serverTimestamp();
          await setDoc(ref, payload);
        }

        const merged = [
          ...juryMembers.filter((j) => j.email !== emailLower),
          {
            email: emailLower,
            name: String(payload.name),
            district: payload.district as string | undefined,
            roleTitle: payload.roleTitle as string | undefined,
            assignedActivityIds: payload.assignedActivityIds as string[],
            active: Boolean(payload.active),
          },
        ];
        await syncJuryDisplayNamesToActivities(merged);
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    [juryMembers, syncJuryDisplayNamesToActivities]
  );

  const deleteJuryMember = useCallback(
    async (email: string) => {
      const emailLower = email.trim().toLowerCase();
      try {
        await deleteDoc(doc(db, 'juryMembers', emailLower));
        await syncJuryDisplayNamesToActivities(
          juryMembers.filter((j) => j.email !== emailLower)
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `juryMembers/${emailLower}`);
      }
    },
    [juryMembers, syncJuryDisplayNamesToActivities]
  );

  const saveAdminEmail = useCallback(
    async (adminRec: Omit<AdminEmailRecord, 'createdAt' | 'updatedAt'>, isNew: boolean) => {
      const emailLower = adminRec.email.trim().toLowerCase();
      const path = `adminEmails/${emailLower}`;
      try {
        const ref = doc(db, 'adminEmails', emailLower);
        const payload: Record<string, unknown> = {
          email: emailLower,
          name: adminRec.name.trim().slice(0, 120),
          active: Boolean(adminRec.active),
          updatedAt: serverTimestamp(),
        };
        if (adminRec.district?.trim()) payload.district = adminRec.district.trim().slice(0, 80);

        if (isNew) {
          payload.createdAt = serverTimestamp();
          await setDoc(ref, payload);
        } else {
          const existingSnap = await getDoc(ref);
          payload.createdAt = existingSnap.data()?.createdAt || serverTimestamp();
          await setDoc(ref, payload);
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
      }
    },
    []
  );

  const deleteAdminEmail = useCallback(async (email: string) => {
    const emailLower = email.trim().toLowerCase();
    try {
      await deleteDoc(doc(db, 'adminEmails', emailLower));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `adminEmails/${emailLower}`);
    }
  }, []);

  const saveGeneralConfig = useCallback(
    async (camporeeTitle: string, locationNote: string) => {
      try {
        await setDoc(doc(db, 'camporeeConfig', 'general'), {
          configType: 'general',
          camporeeTitle: camporeeTitle.trim().slice(0, 140),
          locationNote: locationNote.trim().slice(0, 300),
          updatedBy: user?.email?.toLowerCase() || BOOTSTRAPPED_ADMIN_EMAIL,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'camporeeConfig/general');
      }
    },
    [user]
  );

  const saveSheetsConfig = useCallback(
    async (config: Omit<CamporeeSheetsConfig, 'configType' | 'updatedAt' | 'updatedBy'>) => {
      try {
        const payload: Record<string, unknown> = {
          configType: 'sheets',
          updatedBy: user?.email?.toLowerCase() || BOOTSTRAPPED_ADMIN_EMAIL,
          updatedAt: serverTimestamp(),
        };
        if (config.spreadsheetId) payload.spreadsheetId = config.spreadsheetId.slice(0, 160);
        if (config.spreadsheetTitle) payload.spreadsheetTitle = config.spreadsheetTitle.slice(0, 160);
        if (config.spreadsheetUrl) payload.spreadsheetUrl = config.spreadsheetUrl.slice(0, 300);
        if (config.folderId) payload.folderId = config.folderId.slice(0, 160);
        if (config.sheetTabName) payload.sheetTabName = config.sheetTabName.slice(0, 80);

        await setDoc(doc(db, 'camporeeConfig', 'sheets'), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'camporeeConfig/sheets');
      }
    },
    [user]
  );

  const recordAttendance = useCallback(
    async (
      payload: Omit<
        AttendanceRecord,
        'createdAt' | 'verifiedByUid' | 'verifiedByEmail' | 'verifiedByName'
      >
    ): Promise<AttendanceRecord> => {
      if (!user || !user.email) {
        throw new Error('Authentication required to verify attendance.');
      }
      const id = payload.id || sanitizeFirestoreId('att', payload.uidNumber);
      const path = `attendance/${id}`;
      try {
        const docData: Record<string, unknown> = {
          id,
          activityId: payload.activityId,
          activityName: payload.activityName.trim().slice(0, 140),
          activityType: payload.activityType,
          uidNumber: payload.uidNumber.trim().slice(0, 80),
          verifiedByUid: user.uid,
          verifiedByEmail: user.email.toLowerCase(),
          timestampIso: payload.timestampIso,
          sheetSynced: Boolean(payload.sheetSynced),
          createdAt: serverTimestamp(),
        };
        if (payload.venueName?.trim()) docData.venueName = payload.venueName.trim().slice(0, 120);
        if (payload.participantName?.trim())
          docData.participantName = payload.participantName.trim().slice(0, 120);
        if (payload.district?.trim()) docData.district = payload.district.trim().slice(0, 80);
        if (payload.patrol?.trim()) docData.patrol = payload.patrol.trim().slice(0, 80);
        if (user.displayName?.trim())
          docData.verifiedByName = user.displayName.trim().slice(0, 120);
        if (payload.sheetRowRange?.trim())
          docData.sheetRowRange = payload.sheetRowRange.trim().slice(0, 120);
        if (payload.driveFileId?.trim())
          docData.driveFileId = payload.driveFileId.trim().slice(0, 128);

        await setDoc(doc(db, 'attendance', id), docData);

        return {
          ...payload,
          id,
          verifiedByUid: user.uid,
          verifiedByEmail: user.email.toLowerCase(),
          verifiedByName: user.displayName || undefined,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const markAttendanceSynced = useCallback(
    async (recordId: string, sheetRowRange: string, driveFileId?: string) => {
      const path = `attendance/${recordId}`;
      try {
        const updatePayload: Record<string, unknown> = {
          sheetSynced: true,
          sheetRowRange: sheetRowRange.slice(0, 120),
        };
        if (driveFileId) {
          updatePayload.driveFileId = driveFileId.slice(0, 128);
        }
        await updateDoc(doc(db, 'attendance', recordId), updatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    []
  );

  const value = useMemo<CamporeeContextValue>(
    () => ({
      user,
      authReady,
      role,
      juryProfile,
      accessToken,
      hasWorkspaceToken: Boolean(accessToken),
      locations,
      venues,
      activities,
      juryMembers,
      adminEmails,
      attendanceRecords,
      generalConfig,
      sheetsConfig,
      loadingPublic,
      signingIn,
      authError,
      signInWithGoogle,
      signOutUser,
      seedStarterCamporeeData,
      saveLocation,
      deleteLocation,
      saveVenue,
      deleteVenue,
      saveActivity,
      deleteActivity,
      saveJuryMember,
      deleteJuryMember,
      saveAdminEmail,
      deleteAdminEmail,
      saveGeneralConfig,
      saveSheetsConfig,
      recordAttendance,
      markAttendanceSynced,
    }),
    [
      user,
      authReady,
      role,
      juryProfile,
      accessToken,
      locations,
      venues,
      activities,
      juryMembers,
      adminEmails,
      attendanceRecords,
      generalConfig,
      sheetsConfig,
      loadingPublic,
      signingIn,
      authError,
      signInWithGoogle,
      signOutUser,
      seedStarterCamporeeData,
      saveLocation,
      deleteLocation,
      saveVenue,
      deleteVenue,
      saveActivity,
      deleteActivity,
      saveJuryMember,
      deleteJuryMember,
      saveAdminEmail,
      deleteAdminEmail,
      saveGeneralConfig,
      saveSheetsConfig,
      recordAttendance,
      markAttendanceSynced,
    ]
  );

  return <CamporeeContext.Provider value={value}>{children}</CamporeeContext.Provider>;
};

export function useCamporee() {
  const ctx = useContext(CamporeeContext);
  if (!ctx) {
    throw new Error('useCamporee must be used within CamporeeProvider');
  }
  return ctx;
}
