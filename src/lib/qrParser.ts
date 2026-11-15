import { ParsedScoutQr } from '../types/camporee';

export function parseScoutQrPayload(raw: string): ParsedScoutQr {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty QR code content.');
  }

  // 1. Try JSON payload: { uid, name, district, patrol }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const uidCandidate =
        obj.uid || obj.uidNumber || obj.UID || obj.id || obj.scoutId || obj.regNo;
      if (typeof uidCandidate === 'string' && uidCandidate.trim().length >= 2) {
        return {
          uidNumber: uidCandidate.trim().slice(0, 80),
          participantName:
            typeof (obj.name || obj.participantName) === 'string'
              ? String(obj.name || obj.participantName).trim().slice(0, 120)
              : undefined,
          district:
            typeof obj.district === 'string' ? obj.district.trim().slice(0, 80) : undefined,
          patrol: typeof obj.patrol === 'string' ? obj.patrol.trim().slice(0, 80) : undefined,
          rawText: trimmed,
        };
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // 2. Try URL with uid query parameter
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const uidParam =
        url.searchParams.get('uid') ||
        url.searchParams.get('id') ||
        url.searchParams.get('reg');
      if (uidParam && uidParam.trim().length >= 2) {
        return {
          uidNumber: uidParam.trim().slice(0, 80),
          participantName: url.searchParams.get('name')?.trim().slice(0, 120) || undefined,
          district: url.searchParams.get('district')?.trim().slice(0, 80) || undefined,
          patrol: url.searchParams.get('patrol')?.trim().slice(0, 80) || undefined,
          rawText: trimmed,
        };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Try key-value format e.g. "UID:KSBSG-2026-0412 | NAME:Arjun Menon | DISTRICT:Ernakulam"
  if (trimmed.includes(':') && (trimmed.includes('|') || trimmed.includes('\n') || trimmed.includes(';'))) {
    const parts = trimmed.split(/[|\n;]+/);
    let uidNumber = '';
    let participantName: string | undefined;
    let district: string | undefined;
    let patrol: string | undefined;

    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim().toLowerCase();
      const val = part.slice(idx + 1).trim();
      if (!val) continue;
      if (key === 'uid' || key === 'id' || key === 'uid number' || key === 'regno') {
        uidNumber = val.slice(0, 80);
      } else if (key === 'name' || key === 'participant') {
        participantName = val.slice(0, 120);
      } else if (key === 'district') {
        district = val.slice(0, 80);
      } else if (key === 'patrol' || key === 'unit') {
        patrol = val.slice(0, 80);
      }
    }

    if (uidNumber.length >= 2) {
      return {
        uidNumber,
        participantName,
        district,
        patrol,
        rawText: trimmed,
      };
    }
  }

  // 4. Plain UID string (e.g. KSBSG-2026-TVM-0412)
  return {
    uidNumber: trimmed.slice(0, 80),
    rawText: trimmed,
  };
}

export function formatCamporeeTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export function sanitizeFirestoreId(prefix: string, raw?: string): string {
  const base = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${base || 'item'}-${suffix}`.slice(0, 120);
}
