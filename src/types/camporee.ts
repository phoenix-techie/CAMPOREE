export type UserRole = 'admin' | 'jury' | 'guest';

export type LocationCategory = 'subcamp' | 'venue' | 'adventure' | 'facility' | 'hq';
export type LocationStatus = 'open' | 'busy' | 'closed' | 'updating';

export interface CampLocation {
  id: string;
  name: string;
  category: LocationCategory;
  sector: string;
  description?: string;
  directions?: string;
  mapX: number;
  mapY: number;
  coordinatesLabel?: string;
  status: LocationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VenueStatus = 'active' | 'standby' | 'closed';

export interface Venue {
  id: string;
  name: string;
  zone: string;
  capacity: number;
  locationId?: string;
  facilities?: string;
  status: VenueStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ActivityType = 'program' | 'adventure';
export type ActivityStatus = 'scheduled' | 'live' | 'completed' | 'delayed';
export type ActivityImageKey = 'grounds' | 'ropes' | 'pioneering' | 'none';

export interface Activity {
  id: string;
  title: string;
  type: ActivityType;
  category: string;
  description?: string;
  venueId: string;
  venueName: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  status: ActivityStatus;
  safetyNotes?: string;
  imageKey?: ActivityImageKey;
  juryDisplayNames?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JuryMember {
  email: string;
  name: string;
  district?: string;
  roleTitle?: string;
  assignedActivityIds: string[];
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminEmailRecord {
  email: string;
  name: string;
  district?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  activityId: string;
  activityName: string;
  activityType: ActivityType;
  venueName?: string;
  uidNumber: string;
  participantName?: string;
  district?: string;
  patrol?: string;
  verifiedByUid: string;
  verifiedByEmail: string;
  verifiedByName?: string;
  timestampIso: string;
  sheetSynced: boolean;
  sheetRowRange?: string;
  driveFileId?: string;
  createdAt?: unknown;
}

export interface CamporeeGeneralConfig {
  configType: 'general';
  camporeeTitle?: string;
  locationNote?: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface CamporeeSheetsConfig {
  configType: 'sheets';
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  folderId?: string;
  sheetTabName?: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface ParsedScoutQr {
  uidNumber: string;
  participantName?: string;
  district?: string;
  patrol?: string;
  rawText: string;
}
