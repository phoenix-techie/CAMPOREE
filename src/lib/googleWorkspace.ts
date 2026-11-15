import { AttendanceRecord } from '../types/camporee';

export interface ProvisionedSheetResult {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  folderId: string;
  sheetTabName: string;
}

function parseSpreadsheetIdFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export async function createCamporeeDriveAndSheet(
  accessToken: string,
  customTitle?: string
): Promise<ProvisionedSheetResult> {
  const folderName = 'Kerala State BSG Camporee - Attendance Logs';
  const sheetTitle =
    customTitle?.trim() || 'KSBSG State Camporee - Centralized Attendance';

  // 1. Create dedicated Google Drive folder
  const folderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!folderRes.ok) {
    const errText = await folderRes.text();
    throw new Error(`Google Drive folder creation failed (${folderRes.status}): ${errText}`);
  }
  const folderData = (await folderRes.json()) as { id: string };

  // 2. Create centralized Google Sheet with Attendance & Summary tabs
  const sheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: sheetTitle,
      },
      sheets: [
        {
          properties: {
            title: 'All_Attendance',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
        {
          properties: {
            title: 'Activity_Notes',
          },
        },
      ],
    }),
  });

  if (!sheetRes.ok) {
    const errText = await sheetRes.text();
    throw new Error(`Google Sheet creation failed (${sheetRes.status}): ${errText}`);
  }

  const sheetData = (await sheetRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
  };

  // 3. Move spreadsheet into the Camporee Drive folder
  const moveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${sheetData.spreadsheetId}?addParents=${encodeURIComponent(
      folderData.id
    )}&fields=id,parents`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!moveRes.ok) {
    console.warn('Could not move sheet into folder, continuing with root placement.');
  }

  // 4. Write header row in All_Attendance
  const headerRange = encodeURIComponent('All_Attendance!A1:I1');
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheetId}/values/${headerRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [
            'Timestamp',
            'Activity Name',
            'Activity Type',
            'Venue',
            'UID Number',
            'Participant Name',
            'District',
            'Verified By Jury',
            'Record ID',
          ],
        ],
      }),
    }
  );

  if (!headerRes.ok) {
    const errText = await headerRes.text();
    throw new Error(`Failed to initialize sheet headers (${headerRes.status}): ${errText}`);
  }

  return {
    spreadsheetId: sheetData.spreadsheetId,
    spreadsheetTitle: sheetData.properties?.title || sheetTitle,
    spreadsheetUrl: sheetData.spreadsheetUrl,
    folderId: folderData.id,
    sheetTabName: 'All_Attendance',
  };
}

export async function inspectExistingSpreadsheet(
  accessToken: string,
  spreadsheetIdOrUrl: string
): Promise<{
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  tabNames: string[];
}> {
  const spreadsheetId = parseSpreadsheetIdFromInput(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('Please provide a valid Google Sheet ID or URL.');
  }

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,properties.title,spreadsheetUrl,sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Could not inspect Google Sheet (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const tabNames =
    data.sheets?.map((s) => s.properties?.title).filter((t): t is string => Boolean(t)) || [];

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetTitle: data.properties?.title || 'Camporee Attendance Sheet',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    tabNames,
  };
}

export async function appendAttendanceRowsToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTabName: string,
  records: AttendanceRecord[]
): Promise<{ updatedRange: string; updatedRows: number }> {
  // Fetch spreadsheet metadata to verify exact sheet tab name exists
  const meta = await inspectExistingSpreadsheet(accessToken, spreadsheetId);
  const targetTab = meta.tabNames.includes(sheetTabName)
    ? sheetTabName
    : meta.tabNames[0] || sheetTabName;

  const range = encodeURIComponent(`${targetTab}!A:I`);
  const rows = records.map((r) => [
    r.timestampIso,
    r.activityName,
    r.activityType === 'adventure' ? 'Adventure Base' : 'Scheduled Program',
    r.venueName || '',
    r.uidNumber,
    r.participantName || '',
    r.district || '',
    r.verifiedByEmail,
    r.id,
  ]);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Sheets append failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    updates?: { updatedRange?: string; updatedRows?: number };
  };

  return {
    updatedRange: data.updates?.updatedRange || `${targetTab}!A:I`,
    updatedRows: data.updates?.updatedRows || records.length,
  };
}

export async function uploadActivityCsvToDrive(
  accessToken: string,
  activityName: string,
  records: AttendanceRecord[],
  folderId?: string
): Promise<{ fileId: string; fileName: string; webViewLink?: string }> {
  const safeName = activityName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48);
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `KSBSG_${safeName}_${datePart}.csv`;

  const csvHeader = [
    'Timestamp',
    'Activity Name',
    'Type',
    'Venue',
    'UID Number',
    'Participant Name',
    'District',
    'Verified By',
  ].join(',');

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const csvRows = records.map((r) =>
    [
      escapeCsv(r.timestampIso),
      escapeCsv(r.activityName),
      escapeCsv(r.activityType),
      escapeCsv(r.venueName || ''),
      escapeCsv(r.uidNumber),
      escapeCsv(r.participantName || ''),
      escapeCsv(r.district || ''),
      escapeCsv(r.verifiedByEmail),
    ].join(',')
  );

  const csvBody = [csvHeader, ...csvRows].join('\n');

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType: 'text/csv',
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------ksbsg_camporee_boundary_2026';
  const multipartRequestBody =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: text/csv\r\n\r\n' +
    csvBody +
    `\r\n--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive backup upload failed (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    id: string;
    name: string;
    webViewLink?: string;
  };

  return {
    fileId: data.id,
    fileName: data.name,
    webViewLink: data.webViewLink,
  };
}
