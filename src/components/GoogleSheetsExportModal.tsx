import React, { useState, useEffect } from 'react';
import { WipItem, ChkItem, SpoOption, ProductionLine } from '../types';
import {
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Globe,
  Database,
  HelpCircle,
  Key,
  Code,
  Download,
  ClipboardCopy,
  Radio
} from 'lucide-react';
import {
  requestGoogleAccessToken,
  createGoogleSpreadsheet,
  populateGoogleSpreadsheet,
  fetchWebAppWipData,
  pushWebAppWipData,
  getEffectiveWebAppUrl,
  testWebAppConnectivity,
  DEFAULT_WEBAPP_URL,
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SPREADSHEET_URL,
} from '../lib/googleSheetsService';
import { safeGetItem, safeSetItem } from '../utils/storage';

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItems: WipItem[];
  chkItems: ChkItem[];
  spoOptions: SpoOption[];
  lines: ProductionLine[];
  onImportWipItems?: (items: WipItem[], replaceMode?: boolean) => void;
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  wipItems,
  chkItems,
  spoOptions,
  lines,
  onImportWipItems,
}) => {
  const [exportMode, setExportMode] = useState<'webapp' | 'oauth' | 'manual'>('webapp');
  
  // OAuth Mode State
  const [sheetTitle, setSheetTitle] = useState<string>(
    `Database WIP Sewing & CHK10 (${new Date().toISOString().split('T')[0]})`
  );
  const [clientIdInput, setClientIdInput] = useState<string>(() => {
    return safeGetItem('custom_google_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  });

  // WebApp Mode State
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return getEffectiveWebAppUrl();
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return safeGetItem('google_sheets_autosync') !== 'false';
  });
  const [showScriptHelp, setShowScriptHelp] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [createdSheetUrl, setCreatedSheetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedTsv, setCopiedTsv] = useState(false);

  useEffect(() => {
    if (clientIdInput) {
      safeSetItem('custom_google_client_id', clientIdInput);
    }
  }, [clientIdInput]);

  useEffect(() => {
    if (webAppUrl) {
      safeSetItem('custom_google_webapp_url', webAppUrl);
    }
  }, [webAppUrl]);

  useEffect(() => {
    safeSetItem('google_sheets_autosync', autoSyncEnabled ? 'true' : 'false');
  }, [autoSyncEnabled]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError('');
    try {
      const result = await testWebAppConnectivity(webAppUrl);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Gagal menghubungi Web App. Pastikan URL sudah benar.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyTableTsv = () => {
    const headers = [
      'ID', 'Line', 'SPO', 'Style', 'Color', 'Size', 'Qty Order', 'Unit',
      'In Hari Ini', 'WIP 0', 'WIP 1', 'WIP 2', 'WIP 3', 'WIP 4', 'WIP 5',
      'WIP Sewing', 'Out Sewing', 'CHK 3D', 'WIP Finish', 'Out Packing',
      'Jam Normal', 'MP Normal', 'Jam Lembur', 'MP Lembur', 'Tanggal', 'Created At'
    ];

    const rows = wipItems.map((item) => [
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

    const tsvText = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvText);
    setCopiedTsv(true);
    setTimeout(() => setCopiedTsv(false), 2500);
  };

  const handleDownloadCsv = () => {
    const headers = [
      'ID', 'Line', 'SPO', 'Style', 'Color', 'Size', 'Qty Order', 'Unit',
      'In Hari Ini', 'WIP 0', 'WIP 1', 'WIP 2', 'WIP 3', 'WIP 4', 'WIP 5',
      'WIP Sewing', 'Out Sewing', 'CHK 3D', 'WIP Finish', 'Out Packing',
      'Jam Normal', 'MP Normal', 'Jam Lembur', 'MP Lembur', 'Tanggal', 'Created At'
    ];

    const escapeCsv = (str: any) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const rows = wipItems.map((item) => [
      escapeCsv(item.id),
      escapeCsv(item.lineId),
      escapeCsv(item.spo),
      escapeCsv(item.style),
      escapeCsv(item.color),
      escapeCsv(item.size),
      item.qtyOrder || 0,
      escapeCsv(item.unit),
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
      escapeCsv(item.date),
      escapeCsv(item.createdAt),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WIP_Sewing_Data_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportOAuth = async () => {
    const trimmedId = clientIdInput.trim();
    if (!trimmedId) {
      setError('Masukkan Google Client ID terlebih dahulu, atau gunakan metode Apps Script Web App.');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMessage('Meminta izin Google OAuth...');

    try {
      (window as any).__custom_google_client_id = trimmedId;

      const accessToken = await requestGoogleAccessToken();

      setStatusMessage('Membuat file Google Spreadsheet di Google Drive...');
      const sheetResult = await createGoogleSpreadsheet(accessToken, sheetTitle);

      setStatusMessage('Mengirim data WIP Sewing, CHK10, SPO, & Manpower...');
      await populateGoogleSpreadsheet(accessToken, sheetResult.spreadsheetId, {
        wipItems,
        chkItems,
        spoOptions,
      });

      setCreatedSheetUrl(sheetResult.spreadsheetUrl);
      setStatusMessage('Berhasil diexport ke Google Sheets!');
    } catch (err: any) {
      console.error('Google Sheets Export Error:', err);
      setError(err.message || 'Gagal mengeksport database ke Google Sheets. Pastikan Client ID valid.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportWebApp = async () => {
    const trimmedUrl = webAppUrl.trim();
    if (!trimmedUrl) {
      setError('Masukkan URL Apps Script Web App Anda terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMessage('Mengirim data ke Google Sheets Web App...');

    try {
      await pushWebAppWipData(trimmedUrl, {
        wipItems,
        chkItems,
        spoOptions,
      });

      setCreatedSheetUrl(DEFAULT_SPREADSHEET_URL);
      setStatusMessage('Data berhasil dikirim ke Google Spreadsheet!');
    } catch (err: any) {
      console.error('WebApp Export Error:', err);
      setError(err.message || 'Gagal mengirim data ke Web App URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchWebApp = async () => {
    const trimmedUrl = webAppUrl.trim();
    if (!trimmedUrl) {
      setError('Masukkan URL Apps Script Web App Anda terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError('');
    setStatusMessage('Menarik data terbaru dari Google Spreadsheet...');

    try {
      const fetchedWip = await fetchWebAppWipData(trimmedUrl);
      if (fetchedWip) {
        if (onImportWipItems) {
          onImportWipItems(fetchedWip, true);
        }
        setStatusMessage(`Berhasil memuat ${fetchedWip.length} entri WIP dari Google Spreadsheet!`);
      } else {
        setStatusMessage('Spreadsheet belum memiliki data WIP atau format belum sesuai.');
      }
    } catch (err: any) {
      console.error('WebApp Fetch Error:', err);
      setError(err.message || 'Gagal menarik data dari Web App. Pastikan fungsi doGet sudah di-deploy.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = () => {
    if (!createdSheetUrl) return;
    navigator.clipboard.writeText(createdSheetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleAppsScriptCode = `// ID Spreadsheet Target
var SPREADSHEET_ID = "${DEFAULT_SPREADSHEET_ID}";

function getTargetSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    var wsWip = ss.getSheetByName("WIP Sewing Data");
    if (!wsWip) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", wipItems: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var values = wsWip.getDataRange().getValues();
    if (values.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", wipItems: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var wipItems = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row[0] && !row[2]) continue;
      wipItems.push({
        id: String(row[0] || ('wip-' + i)),
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
        createdAt: String(row[25] || ''),
        updatedBy: String(row[26] || ''),
        leaderNik: String(row[26] || ''),
        leaderName: String(row[26] || ''),
        updatedAt: String(row[27] || row[25] || '')
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", wipItems: wipItems }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var raw = "";
    if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      raw = e.parameter.data;
    }
    if (!raw) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No data payload" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = JSON.parse(raw);
    var ss = getTargetSpreadsheet();
    
    // 1. WIP Sewing Sheet - Smart Merge (Tidak menghapus data line lain)
    var wsWip = ss.getSheetByName("WIP Sewing Data");
    if (!wsWip) {
      wsWip = ss.insertSheet("WIP Sewing Data");
    }
    
    var header = [
      "ID", "Line", "SPO", "Style", "Color", "Size", "Qty Order", "Unit",
      "In Hari Ini", "WIP 0", "WIP 1", "WIP 2", "WIP 3", "WIP 4", "WIP 5",
      "WIP Sewing", "Out Sewing", "CHK 3D", "WIP Finish", "Out Packing",
      "Jam Normal", "MP Normal", "Jam Lembur", "MP Lembur", "Tanggal", "Created At",
      "Pengisi / Leader", "Updated At"
    ];
    
    if (data.wipItems && data.wipItems.length > 0) {
      var existingValues = wsWip.getDataRange().getValues();
      var rowMap = {};
      
      // Index baris yang sudah ada sebelumnya
      if (existingValues.length > 1) {
        for (var r = 1; r < existingValues.length; r++) {
          var row = existingValues[r];
          if (!row[0] && !row[2]) continue;
          var key = String(row[1]).trim().toUpperCase() + "_" + String(row[2]).trim().toLowerCase() + "_" + String(row[5]).trim().toLowerCase() + "_" + String(row[24]).trim();
          rowMap[key] = row;
        }
      }
      
      // Merge data baru/update
      data.wipItems.forEach(function(item) {
        var itemKey = String(item.lineId || '').trim().toUpperCase() + "_" + String(item.spo || '').trim().toLowerCase() + "_" + String(item.size || '').trim().toLowerCase() + "_" + String(item.date || '').trim();
        var rowData = [
          String(item.id || ('wip-' + new Date().getTime())),
          String(item.lineId || ''),
          String(item.spo || ''),
          String(item.style || ''),
          String(item.color || ''),
          String(item.size || ''),
          Number(item.qtyOrder || 0),
          String(item.unit || 'PCE'),
          Number(item.inHariIni || 0),
          Number(item.wip0 || 0),
          Number(item.wip1 || 0),
          Number(item.wip2 || 0),
          Number(item.wip3 || 0),
          Number(item.wip4 || 0),
          Number(item.wip5 || 0),
          Number(item.wipSewing || 0),
          Number(item.outSewing || 0),
          Number(item.chk3d || 0),
          Number(item.wipFinish || 0),
          Number(item.outPacking || 0),
          Number(item.normalHours || 0),
          Number(item.normalMp || 0),
          Number(item.overtimeHours || 0),
          Number(item.overtimeMp || 0),
          String(item.date || ''),
          String(item.createdAt || new Date().toISOString()),
          String(item.updatedBy || item.leaderNik || ''),
          String(item.updatedAt || item.createdAt || new Date().toISOString())
        ];
        rowMap[itemKey] = rowData;
      });

      var uniqueRows = [];
      for (var k in rowMap) {
        uniqueRows.push(rowMap[k]);
      }

      if (uniqueRows.length > 0) {
        wsWip.clear();
        wsWip.appendRow(header);
        wsWip.getRange(2, 1, uniqueRows.length, header.length).setValues(uniqueRows);
        wsWip.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#d9ead3");
      }
    }

    // 2. SPO Master Sheet
    if (data.spoOptions && data.spoOptions.length > 0) {
      var wsSpo = ss.getSheetByName("SPO Master");
      if (!wsSpo) {
        wsSpo = ss.insertSheet("SPO Master");
      }
      wsSpo.clear();
      wsSpo.appendRow(["SPO#", "Style", "Color", "Qty Order", "Unit", "Daftar Size"]);
      data.spoOptions.forEach(function(item) {
        wsSpo.appendRow([item.spo, item.style, item.color, item.qtyOrder, item.unit, (item.sizes || []).join(', ')]);
      });
      wsSpo.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#cfe2f3");
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.wipItems ? data.wipItems.length : 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(sampleAppsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 space-y-5 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Sinkronisasi & Export Google Spreadsheet
              </h3>
              <p className="text-xs text-slate-500">
                Kirim seluruh data WIP Sewing & Manpower langsung ke Google Spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => { setExportMode('webapp'); setError(''); }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'webapp'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>1. Apps Script (Otomatis)</span>
          </button>
          <button
            onClick={() => { setExportMode('manual'); setError(''); }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'manual'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCopy className="w-3.5 h-3.5" />
            <span>2. Salin Cepat / CSV</span>
          </button>
          <button
            onClick={() => { setExportMode('oauth'); setError(''); }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
              exportMode === 'oauth'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>3. Google OAuth API</span>
          </button>
        </div>

        {/* Database Payload Overview */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Data Siap Kirim ({wipItems.length} Baris WIP):</span>
            </div>
            <a
              href={DEFAULT_SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Buka Spreadsheet Target</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-slate-400 text-[10px]">WIP Sewing</span>
              <strong className="text-blue-700 font-bold text-sm">{wipItems.length}</strong>
              <span className="text-[10px] text-slate-400 block">baris</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-slate-400 text-[10px]">SPO Options</span>
              <strong className="text-emerald-700 font-bold text-sm">{spoOptions.length}</strong>
              <span className="text-[10px] text-slate-400 block">item</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-200/80">
              <span className="block text-slate-400 text-[10px]">Lines</span>
              <strong className="text-slate-800 font-bold text-sm">{lines.length}</strong>
              <span className="text-[10px] text-slate-400 block">line</span>
            </div>
          </div>
        </div>

        {/* Success View */}
        {createdSheetUrl ? (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Kirim Data ke Google Sheets Berhasil!</span>
            </div>
            <p className="text-xs text-emerald-900">
              Perubahan data Anda telah dikirim dan disinkronkan ke tab <strong>WIP Sewing Data</strong> di Google Spreadsheet.
            </p>

            <div className="pt-2">
              <a
                href={createdSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka Google Spreadsheet Sekarang</span>
              </a>
            </div>
          </div>
        ) : (
          /* Input Forms based on Mode */
          <div className="space-y-4">
            {exportMode === 'manual' ? (
              <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Metode Instan: Salin & Tempel (Langsung Masuk 100%)</span>
                </h4>
                <p className="text-xs text-slate-600">
                  Jika Anda ingin data masuk seketika tanpa perlu setup script:
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleCopyTableTsv}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    {copiedTsv ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-600" />}
                    <span>{copiedTsv ? 'Tersalin ke Clipboard!' : '1. Salin Tabel (Siap Paste)'}</span>
                  </button>

                  <a
                    href={DEFAULT_SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>2. Buka Sheet (Ctrl+V)</span>
                  </a>
                </div>

                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Atau simpan file backup offline:</span>
                  <button
                    onClick={handleDownloadCsv}
                    className="flex items-center gap-1.5 text-xs text-blue-700 font-bold hover:underline cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            ) : exportMode === 'oauth' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Spreadsheet Baru di Google Drive:
                  </label>
                  <input
                    type="text"
                    value={sheetTitle}
                    onChange={(e) => setSheetTitle(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Google OAuth Client ID:</span>
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <span>Buat di Google Cloud</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </label>
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="Contoh: 123456789-abc...apps.googleusercontent.com"
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      URL Apps Script Web App:
                    </label>
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="flex items-center gap-1 text-[11px] text-blue-700 font-bold hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3 text-blue-600" />}
                      <span>Test Koneksi</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                  />

                  {testResult && (
                    <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between bg-emerald-50/80 border border-emerald-200/80 p-2.5 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="autoSyncCheckbox"
                        checked={autoSyncEnabled}
                        onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <label htmlFor="autoSyncCheckbox" className="text-xs font-bold text-emerald-900 cursor-pointer">
                        Auto-Sync Aktif (Otomatis kirim saat tekan Simpan Laporan)
                      </label>
                    </div>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                      Real-time
                    </span>
                  </div>
                </div>

                {showScriptHelp && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-800">📋 Kode Script untuk Google Spreadsheet:</p>
                      <button
                        onClick={handleCopyScript}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedScript ? 'Tersalin!' : 'Salin Kode Script'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Buka spreadsheet &gt; menu <strong>Extensions &gt; Apps Script</strong> &gt; tempel kode di bawah &gt; klik <strong>Deploy &gt; Manage deployments &gt; Edit &gt; New version &gt; Who has access: Anyone &gt; Deploy</strong>.
                    </p>

                    <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-lg text-[9.5px] font-mono overflow-x-auto max-h-36 leading-tight">
                      {sampleAppsScriptCode}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading / Status */}
        {isLoading && (
          <div className="flex items-center gap-2.5 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-medium">
            <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
            >
              {createdSheetUrl ? 'Tutup' : 'Batal'}
            </button>

            {!createdSheetUrl && exportMode !== 'manual' && (
              <>
                {exportMode === 'webapp' && (
                  <button
                    onClick={handleFetchWebApp}
                    disabled={isLoading}
                    className="flex items-center space-x-1.5 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition disabled:opacity-50 cursor-pointer"
                    title="Tarik & Muat Data WIP Terbaru dari Google Spreadsheet"
                  >
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span>Tarik Data Terbaru</span>
                  </button>
                )}
                <button
                  onClick={exportMode === 'oauth' ? handleExportOAuth : handleExportWebApp}
                  disabled={isLoading}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{exportMode === 'oauth' ? 'Export via OAuth API' : 'Sync Sekarang'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

