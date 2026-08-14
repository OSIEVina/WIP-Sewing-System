import { WipItem, ChkItem, SpoOption } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

/**
 * Dynamically loads Google Identity Services (GIS) library script if not present.
 */
export function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

/**
 * Triggers Google OAuth Popup to request access token for Google Sheets & Drive
 */
export async function requestGoogleAccessToken(): Promise<string> {
  await loadGoogleGsiScript();

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services SDK tidak dapat dimuat.'));
      return;
    }

    const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
      callback: (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          resolve(tokenResponse.access_token);
        } else if (tokenResponse && tokenResponse.error) {
          reject(new Error(`Otentikasi Google gagal: ${tokenResponse.error_description || tokenResponse.error}`));
        } else {
          reject(new Error('Izin Google OAuth tidak diberikan.'));
        }
      },
      error_callback: (err: any) => {
        reject(new Error(`Google OAuth error: ${err.message || 'Gagal membuka popup otentikasi'}`));
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Creates a brand new Google Spreadsheet in Google Drive
 */
export async function createGoogleSpreadsheet(accessToken: string, title?: string) {
  const sheetTitle = title || `Database WIP Sewing (${new Date().toISOString().split('T')[0]})`;

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
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
        { properties: { title: 'WIP Sewing Data' } },
        { properties: { title: 'SPO Master' } },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat Google Spreadsheet baru: ${errText}`);
  }

  const result = await response.json();
  return {
    spreadsheetId: result.spreadsheetId as string,
    spreadsheetUrl: result.spreadsheetUrl as string || `https://docs.google.com/spreadsheets/d/${result.spreadsheetId}`,
  };
}

/**
 * Populates data rows into the Google Spreadsheet
 */
export async function populateGoogleSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  data: {
    wipItems: WipItem[];
    chkItems: ChkItem[];
    spoOptions: SpoOption[];
  }
) {
  // 1. Format WIP Sewing Data
  const wipHeaders = [
    'ID', 'Line ID', 'SPO', 'Style', 'Color', 'Size', 'Qty Order', 'Unit',
    'In Hari Ini', 'WIP 0', 'WIP 1', 'WIP 2', 'WIP 3', 'WIP 4', 'WIP 5',
    'WIP Sewing', 'Out Sewing', 'CHK 3D', 'WIP Finish', 'Out Packing',
    'Jam Normal', 'MP Normal', 'Jam Lembur', 'MP Lembur', 'Tanggal', 'Created At'
  ];

  const wipRows = data.wipItems.map((item) => [
    item.id,
    item.lineId,
    item.spo,
    item.style,
    item.color,
    item.size,
    item.qtyOrder,
    item.unit,
    item.inHariIni || 0,
    item.wip0 || 0,
    item.wip1 || 0,
    item.wip2 || 0,
    item.wip3 || 0,
    item.wip4 || 0,
    item.wip5 || 0,
    item.wipSewing || 0,
    item.outSewing || 0,
    item.chk3d || 0,
    item.wipFinish || 0,
    item.outPacking || 0,
    item.normalHours || 0,
    item.normalMp || 0,
    item.overtimeHours || 0,
    item.overtimeMp || 0,
    item.date || '',
    item.createdAt || '',
  ]);

  // 2. Format SPO Master Data
  const spoHeaders = ['SPO#', 'Style', 'Color', 'Qty Order', 'Unit', 'Daftar Size'];
  const spoRows = data.spoOptions.map((item) => [
    item.spo,
    item.style,
    item.color,
    item.qtyOrder,
    item.unit,
    (item.sizes || []).join(', '),
  ]);

  const valueData = [
    {
      range: "'WIP Sewing Data'!A1",
      majorDimension: 'ROWS',
      values: [wipHeaders, ...wipRows],
    },
    {
      range: "'SPO Master'!A1",
      majorDimension: 'ROWS',
      values: [spoHeaders, ...spoRows],
    },
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueData,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengeksport data ke Google Sheets: ${errText}`);
  }

  return true;
}

/**
 * Reads WIP Sewing Data directly from Google Sheets via Google Sheets API (v4)
 */
export async function fetchSpreadsheetWipData(accessToken: string, spreadsheetId: string): Promise<WipItem[]> {
  const range = encodeURIComponent("'WIP Sewing Data'!A2:Z1000");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengambil data dari Google Sheets: ${errText}`);
  }

  const result = await response.json();
  const rows = result.values || [];

  return rows.map((row: any[]) => ({
    id: String(row[0] || `wip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
    lineId: String(row[1] || ''),
    spo: String(row[2] || ''),
    style: String(row[3] || ''),
    color: String(row[4] || ''),
    size: String(row[5] || ''),
    qtyOrder: Number(row[6] || 0),
    unit: String(row[7] || 'PCE'),
    inHariIni: Number(row[8] || 0),
    wip0: Number(row[9] || 0),
    wip1: Number(row[10] || 0),
    wip2: Number(row[11] || 0),
    wip3: Number(row[12] || 0),
    wip4: Number(row[13] || 0),
    wip5: Number(row[14] || 0),
    wipSewing: Number(row[15] || 0),
    outSewing: Number(row[16] || 0),
    chk3d: Number(row[17] || 0),
    wipFinish: Number(row[18] || 0),
    outPacking: Number(row[19] || 0),
    normalHours: Number(row[20] || 0),
    normalMp: Number(row[21] || 0),
    overtimeHours: Number(row[22] || 0),
    overtimeMp: Number(row[23] || 0),
    date: String(row[24] || ''),
    createdAt: String(row[25] || new Date().toISOString()),
  }));
}

/**
 * Pushes WIP data payload to Google Apps Script Web App
 */
export async function pushWebAppWipData(
  webAppUrl: string,
  payload: { wipItems: WipItem[]; spoOptions: SpoOption[]; chkItems?: ChkItem[] }
): Promise<boolean> {
  const response = await fetch(webAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'syncData',
      timestamp: new Date().toISOString(),
      wipItems: payload.wipItems,
      spoOptions: payload.spoOptions,
      chkItems: payload.chkItems || [],
    }),
  });
  return true;
}

/**
 * Reads WIP Sewing Data from Google Apps Script Web App
 */
export async function fetchWebAppWipData(webAppUrl: string): Promise<WipItem[]> {
  const url = webAppUrl.includes('?') ? `${webAppUrl}&action=getWip` : `${webAppUrl}?action=getWip`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (result && Array.isArray(result.wipItems)) {
    return result.wipItems;
  }
  return [];
}

