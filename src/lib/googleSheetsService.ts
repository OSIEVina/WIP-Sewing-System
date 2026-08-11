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
