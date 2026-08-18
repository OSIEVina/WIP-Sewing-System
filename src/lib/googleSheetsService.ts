import { WipItem, ChkItem, SpoOption } from '../types';
import { safeGetItem } from '../utils/storage';
import { normalizeDateStr, getTodayDateStr } from '../utils/date';

export const DEFAULT_SPREADSHEET_ID = '1k2Oasyi6qV3OAwaFNn1KfJVZeDaJo2fstezaGWqd3_E';
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;

export const DEFAULT_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbwtaNDAmVKQGCqajuylFICTzjfXQQksfDg-y8U5PxSuWjSXCe6J5HuFPemUIO9lwWN1sQ/exec';

export function getEffectiveWebAppUrl(): string {
  const saved = safeGetItem('custom_google_webapp_url');
  if (saved && saved.trim()) return saved.trim();
  return DEFAULT_WEBAPP_URL;
}

/**
 * Tests Web App connectivity by sending a lightweight probe
 */
export async function testWebAppConnectivity(webAppUrl: string): Promise<{ success: boolean; message: string }> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) return { success: false, message: 'URL Web App masih kosong.' };
  
  if (cleanUrl.includes('docs.google.com/spreadsheets')) {
    return {
      success: false,
      message: 'URL yang dimasukkan adalah link Spreadsheet, bukan URL Web App. Buka Extensions > Apps Script > Deploy > New deployment > Web App.',
    };
  }

  if (cleanUrl.endsWith('/dev')) {
    return {
      success: false,
      message: 'URL Web App berakhiran /dev (mode pengujian). Harap deploy dan gunakan URL berakhiran /exec agar dapat diakses tanpa login.',
    };
  }

  try {
    const url = cleanUrl.includes('?') ? `${cleanUrl}&action=ping` : `${cleanUrl}?action=ping`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      return {
        success: false,
        message: `HTTP ${res.status}: Pastikan Web App diset ke "Who has access: Anyone" (Siapa saja).`,
      };
    }
    const data = await res.json().catch(() => null);
    if (data && data.status === 'success') {
      return { success: true, message: 'Koneksi Web App Berhasil! Terhubung ke Google Apps Script.' };
    }
    return { success: true, message: 'Web App online dan merespons dengan baik!' };
  } catch (err: any) {
    return {
      success: false,
      message:
        'Koneksi GET gagal (CORS/Izin ditolak). Pastikan di Apps Script: Deploy > Manage deployments > Edit > Who has access diatur ke "Anyone" (Siapa saja), lalu pilih "New version".',
    };
  }
}

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
 * Deduplicates WIP items strictly by Line + SPO + Size + Date to prevent duplicate rows in Google Sheets
 */
export function deduplicateWipItemsForExport(items: WipItem[]): WipItem[] {
  const map = new Map<string, WipItem>();
  const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
  const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
  const cleanColor = (c?: string) => (c ? c.replace(/\s+/g, '').toLowerCase() : '');
  const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
  const getItemDate = (i: WipItem) =>
    normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : '')) || getTodayDateStr();

  items.forEach((item) => {
    if (!item.spo || !item.lineId) return;
    const key = `${cleanLine(item.lineId)}|${cleanSpo(item.spo)}|${cleanColor(item.color)}|${cleanSize(item.size)}|${getItemDate(item)}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const exTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const curTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (curTime >= exTime) {
        map.set(key, item);
      }
    }
  });

  return Array.from(map.values());
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
  const cleanWipItems = deduplicateWipItemsForExport(data.wipItems);

  // 1. Format WIP Sewing Data
  const wipHeaders = [
    'ID', 'Line ID', 'SPO', 'Style', 'Color', 'Size', 'Qty Order', 'Unit',
    'In Hari Ini', 'WIP 0', 'WIP 1', 'WIP 2', 'WIP 3', 'WIP 4', 'WIP 5',
    'WIP Sewing', 'Out Sewing', 'CHK 3D', 'WIP Finish', 'Out Packing',
    'Jam Normal', 'MP Normal', 'Jam Lembur', 'MP Lembur', 'Tanggal', 'Created At',
    'Pengisi / Leader', 'Updated At'
  ];

  const wipRows = cleanWipItems.map((item) => [
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
    item.updatedBy || item.leaderNik || '',
    item.updatedAt || item.createdAt || '',
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
  const seenIds = new Set<string>();

  return rows.map((row: any[], i: number) => {
    let itemId = String(row[0] || '');
    if (!itemId || itemId.includes('/') || seenIds.has(itemId)) {
      itemId = `wip-${row[1] || ''}-${row[2] || ''}-${row[5] || ''}-${i}`;
    }
    seenIds.add(itemId);

    return {
      id: itemId,
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
      updatedBy: String(row[26] || ''),
      leaderNik: String(row[26] || ''),
      leaderName: String(row[26] || ''),
      updatedAt: String(row[27] || row[25] || new Date().toISOString()),
    };
  });
}

/**
 * Clears all WIP data rows in Google Spreadsheet via Web App
 */
export async function clearSpreadsheetWipData(webAppUrl?: string): Promise<boolean> {
  const url = webAppUrl || getEffectiveWebAppUrl();
  if (!url) return false;

  const jsonString = JSON.stringify({
    action: 'clearWip',
    clearWip: true,
    timestamp: new Date().toISOString(),
    wipItems: [],
  });

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: jsonString,
    });
  } catch (err) {
    const formData = new URLSearchParams();
    formData.append('data', jsonString);
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  }
  return true;
}

/**
 * Pushes WIP data payload to Google Apps Script Web App
 */
export async function pushWebAppWipData(
  webAppUrl: string,
  payload: { wipItems: WipItem[]; spoOptions: SpoOption[]; chkItems?: ChkItem[] }
): Promise<boolean> {
  const cleanWipItems = deduplicateWipItemsForExport(payload.wipItems);

  const jsonString = JSON.stringify({
    action: 'syncData',
    timestamp: new Date().toISOString(),
    wipItems: cleanWipItems,
    spoOptions: payload.spoOptions,
    chkItems: payload.chkItems || [],
  });

  try {
    // Primary method: POST with text/plain (avoids CORS preflight in modern browsers)
    await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: jsonString,
    });
  } catch (err) {
    // Fallback: POST via URL-encoded form
    const formData = new URLSearchParams();
    formData.append('data', jsonString);
    await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
  }
  return true;
}

/**
 * Reads WIP Sewing Data directly from Google Sheets public CSV export
 */
export async function fetchLiveWipSheetCsv(customSpreadsheetId?: string): Promise<WipItem[]> {
  const savedCustomId = safeGetItem('custom_google_spreadsheet_id');
  const targetId = customSpreadsheetId || savedCustomId || DEFAULT_SPREADSHEET_ID;

  const candidateUrls = [
    `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:csv&gid=52889481`,
    `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:csv&sheet=WIP%20Sewing%20Data`,
    `https://docs.google.com/spreadsheets/d/${targetId}/gviz/tq?tqx=out:csv&gid=0`,
    `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=52889481`,
    `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=WIP%20Sewing%20Data`,
  ];

  let csvText = '';
  for (const candidateUrl of candidateUrls) {
    try {
      const res = await fetch(candidateUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10 && !text.includes('<!DOCTYPE html>')) {
          csvText = text;
          break;
        }
      }
    } catch (e) {
      // Continue to next candidate
    }
  }

  if (!csvText) {
    throw new Error('Tidak dapat membaca data CSV dari Google Spreadsheet. Pastikan Spreadsheet dibagikan ke "Siapa saja yang memiliki link" (Anyone with the link can view).');
  }

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseCsvLine = (lineStr: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < lineStr.length; i++) {
      const c = lineStr[i];
      if (c === '"') {
        if (inQuotes && lineStr[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const clean = (val: string) => (val ? val.replace(/^"|"$/g, '') : '');

  const items: WipItem[] = [];
  const seenIds = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 3 || (!clean(row[0]) && !clean(row[2]))) continue;

    let itemId = clean(row[0]);
    if (!itemId || itemId.includes('/') || seenIds.has(itemId)) {
      itemId = `wip-${clean(row[1])}-${clean(row[2])}-${clean(row[5])}-${i}`;
    }
    seenIds.add(itemId);

    items.push({
      id: itemId,
      lineId: clean(row[1]),
      spo: clean(row[2]),
      style: clean(row[3]),
      color: clean(row[4]),
      size: clean(row[5]),
      qtyOrder: Number(clean(row[6])) || 0,
      unit: clean(row[7]) || 'PCE',
      inHariIni: Number(clean(row[8])) || 0,
      wip0: Number(clean(row[9])) || 0,
      wip1: Number(clean(row[10])) || 0,
      wip2: Number(clean(row[11])) || 0,
      wip3: Number(clean(row[12])) || 0,
      wip4: Number(clean(row[13])) || 0,
      wip5: Number(clean(row[14])) || 0,
      wipSewing: Number(clean(row[15])) || 0,
      outSewing: Number(clean(row[16])) || 0,
      chk3d: Number(clean(row[17])) || 0,
      wipFinish: Number(clean(row[18])) || 0,
      outPacking: Number(clean(row[19])) || 0,
      normalHours: Number(clean(row[20])) || 0,
      normalMp: Number(clean(row[21])) || 0,
      overtimeHours: Number(clean(row[22])) || 0,
      overtimeMp: Number(clean(row[23])) || 0,
      date: normalizeDateStr(clean(row[24])) || (clean(row[25]) ? normalizeDateStr(clean(row[25])) : ''),
      createdAt: clean(row[25]) || new Date().toISOString(),
      updatedBy: clean(row[26]) || '',
      leaderNik: clean(row[26]) || '',
      leaderName: clean(row[26]) || '',
      updatedAt: clean(row[27]) || clean(row[25]) || new Date().toISOString(),
    });
  }
  return mergeDuplicateWipItems(items);
}

/**
 * Smart merge function to combine duplicate records (Line + SPO + Size + Date) and cleanly overwrite with latest edits
 */
export function mergeDuplicateWipItems(items: WipItem[]): WipItem[] {
  const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
  const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
  const cleanColor = (c?: string) => (c ? c.replace(/\s+/g, '').toLowerCase() : '');
  const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
  const getItemDate = (i: WipItem) => normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : '')) || getTodayDateStr();

  const map = new Map<string, WipItem>();
  items.forEach((rawItem) => {
    if (!rawItem || !rawItem.spo || !rawItem.lineId) return;
    const itemDate = getItemDate(rawItem);
    const item: WipItem = {
      ...rawItem,
      date: itemDate,
    };
    const key = `${cleanLine(item.lineId)}_${cleanSpo(item.spo)}_${cleanColor(item.color)}_${cleanSize(item.size)}_${itemDate}`;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key)!;
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();

      if (itemTime >= existingTime) {
        // Newer item fully overwrites previous record in-place
        map.set(key, {
          ...existing,
          ...item,
          date: itemDate,
          id: item.id && !item.id.startsWith('proj-') ? item.id : existing.id,
        });
      } else {
        map.set(key, {
          ...item,
          ...existing,
          date: itemDate,
        });
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Reads WIP Sewing Data from Google Apps Script Web App with CSV fallback
 */
export async function fetchWebAppWipData(webAppUrl: string): Promise<WipItem[] | null> {
  try {
    const url = webAppUrl.includes('?') ? `${webAppUrl}&action=getWip` : `${webAppUrl}?action=getWip`;
    const response = await fetch(url);
    if (response.ok) {
      const result = await response.json();
      if (result && Array.isArray(result.wipItems)) {
        if (result.wipItems.length === 0) {
          return [];
        }
        const seenIds = new Set<string>();
        const mapped = result.wipItems.map((item: WipItem, idx: number) => {
          let itemId = item.id;
          if (!itemId || itemId.includes('/') || seenIds.has(itemId)) {
            itemId = `wip-${item.lineId || ''}-${item.spo || ''}-${item.size || ''}-${idx}`;
          }
          seenIds.add(itemId);
          return {
            ...item,
            id: itemId,
            date: normalizeDateStr(item.date) || (item.createdAt ? normalizeDateStr(item.createdAt) : ''),
          };
        });
        return mergeDuplicateWipItems(mapped);
      }
    }
  } catch (err) {
    console.warn('Apps Script GET failed:', err);
    return null;
  }

  // Fallback: Read directly from Google Sheets public CSV export if webAppUrl is not available
  try {
    const csvResult = await fetchLiveWipSheetCsv();
    return csvResult;
  } catch (err) {
    console.warn('Direct CSV fetch fallback notice:', err);
    return null;
  }
}

