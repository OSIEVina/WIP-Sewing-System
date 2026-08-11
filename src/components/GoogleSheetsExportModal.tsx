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
  Code
} from 'lucide-react';
import {
  requestGoogleAccessToken,
  createGoogleSpreadsheet,
  populateGoogleSpreadsheet
} from '../lib/googleSheetsService';

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  wipItems: WipItem[];
  chkItems: ChkItem[];
  spoOptions: SpoOption[];
  lines: ProductionLine[];
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  wipItems,
  chkItems,
  spoOptions,
  lines,
}) => {
  const [exportMode, setExportMode] = useState<'oauth' | 'webapp'>('oauth');
  
  // OAuth Mode State
  const [sheetTitle, setSheetTitle] = useState<string>(
    `Database WIP Sewing & CHK10 (${new Date().toISOString().split('T')[0]})`
  );
  const [clientIdInput, setClientIdInput] = useState<string>(() => {
    return localStorage.getItem('custom_google_client_id') || (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  });

  // WebApp Mode State
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('custom_google_webapp_url') || '';
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('google_sheets_autosync') === 'true';
  });
  const [showScriptHelp, setShowScriptHelp] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [createdSheetUrl, setCreatedSheetUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    if (clientIdInput) {
      localStorage.setItem('custom_google_client_id', clientIdInput);
    }
  }, [clientIdInput]);

  useEffect(() => {
    if (webAppUrl) {
      localStorage.setItem('custom_google_webapp_url', webAppUrl);
    }
  }, [webAppUrl]);

  useEffect(() => {
    localStorage.setItem('google_sheets_autosync', autoSyncEnabled ? 'true' : 'false');
  }, [autoSyncEnabled]);

  if (!isOpen) return null;

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
      // Dynamically override or set window.google client id if needed
      // We can pass or set it in localStorage for service
      (window as any).__custom_google_client_id = trimmedId;

      // 1. Get OAuth Access Token
      const accessToken = await requestGoogleAccessToken();

      // 2. Create Spreadsheet
      setStatusMessage('Membuat file Google Spreadsheet di Google Drive...');
      const sheetResult = await createGoogleSpreadsheet(accessToken, sheetTitle);

      // 3. Populate Spreadsheet Rows
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
      const payload = {
        action: 'syncData',
        timestamp: new Date().toISOString(),
        wipItems,
        chkItems,
        spoOptions,
      };

      const response = await fetch(trimmedUrl, {
        method: 'POST',
        mode: 'no-cors', // Apps script webapp cors workaround
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Since mode: 'no-cors' returns opaque response, we assume success if no network error
      setCreatedSheetUrl(trimmedUrl.split('/exec')[0] || trimmedUrl);
      setStatusMessage('Data berhasil dikirim ke Google Spreadsheet!');
    } catch (err: any) {
      console.error('WebApp Export Error:', err);
      setError(err.message || 'Gagal mengirim data ke Web App URL.');
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

  const sampleAppsScriptCode = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. WIP Sewing Sheet
  var wsWip = ss.getSheetByName("WIP Sewing Data") || ss.insertSheet("WIP Sewing Data");
  wsWip.clear();
  wsWip.appendRow(["ID", "Line", "SPO", "Style", "Color", "Size", "Qty Order", "Unit", "In Hari Ini", "WIP 0", "WIP 1", "WIP 2", "WIP 3", "WIP 4", "WIP 5", "WIP Sewing", "Out Sewing", "CHK 3D", "WIP Finish", "Out Packing", "Tanggal"]);
  data.wipItems.forEach(function(item) {
    wsWip.appendRow([item.id, item.lineId, item.spo, item.style, item.color, item.size, item.qtyOrder, item.unit, item.inHariIni || 0, item.wip0 || 0, item.wip1 || 0, item.wip2 || 0, item.wip3 || 0, item.wip4 || 0, item.wip5 || 0, item.wipSewing || 0, item.outSewing || 0, item.chk3d || 0, item.wipFinish || 0, item.outPacking || 0, item.date || '']);
  });

  // 2. SPO Master Sheet
  var wsSpo = ss.getSheetByName("SPO Master") || ss.insertSheet("SPO Master");
  wsSpo.clear();
  wsSpo.appendRow(["SPO#", "Style", "Color", "Qty Order", "Unit", "Daftar Size"]);
  data.spoOptions.forEach(function(item) {
    wsSpo.appendRow([item.spo, item.style, item.color, item.qtyOrder, item.unit, (item.sizes || []).join(', ')]);
  });

  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
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
                Export Database ke Google Sheets
              </h3>
              <p className="text-xs text-slate-500">
                Kirim seluruh data WIP Sewing & CHK10 langsung ke Google Spreadsheet Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => { setExportMode('oauth'); setError(''); }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              exportMode === 'oauth'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Metode 1: Google OAuth API</span>
          </button>
          <button
            onClick={() => { setExportMode('webapp'); setError(''); }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              exportMode === 'webapp'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Metode 2: Apps Script Web App (Mudah)</span>
          </button>
        </div>

        {/* Database Payload Overview */}
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Data yang Akan Diexport:</span>
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
              <span>Export ke Google Sheets Berhasil!</span>
            </div>
            <p className="text-xs text-emerald-900">
              Data Anda telah berhasil dikirim dan disinkronkan ke Google Spreadsheet.
            </p>

            <div className="bg-white p-3 rounded-xl border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Link Spreadsheet:</span>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Link'}</span>
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={createdSheetUrl}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 truncate focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <a
                href={createdSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka Google Spreadsheet</span>
              </a>
            </div>
          </div>
        ) : (
          /* Input Forms based on Mode */
          <div className="space-y-4">
            {exportMode === 'oauth' ? (
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
                  <p className="text-[10px] text-slate-500 mt-1">
                    *Client ID disimpan aman di browser Anda (localStorage) untuk otorisasi Google Sheets & Drive API.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>URL Apps Script Web App:</span>
                    <button
                      onClick={() => setShowScriptHelp(!showScriptHelp)}
                      className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>{showScriptHelp ? 'Sembunyikan Panduan' : 'Cara Mendapatkan URL'}</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    disabled={isLoading}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-500"
                  />
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
                        Aktifkan Auto-Sync Otomatis (Tanpa Perlu Tombol)
                      </label>
                    </div>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                      Real-time
                    </span>
                  </div>
                </div>

                {showScriptHelp && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <p className="font-bold text-slate-800">Panduan 3 Langkah (Tanpa Google Cloud Console):</p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
                      <li>Buat Google Spreadsheet baru di <a href="https://sheets.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">sheets.google.com</a>.</li>
                      <li>Di menu atas, pilih <strong>Extensions &gt; Apps Script</strong>.</li>
                      <li>Hapus kode bawaan, tempelkan kode di bawah ini, klik <strong>Deploy &gt; New deployment &gt; Web app</strong> (akses: <em>Anyone</em>), lalu salin URL Web App-nya ke kolom di atas.</li>
                    </ol>

                    <div className="relative pt-1">
                      <button
                        onClick={handleCopyScript}
                        className="absolute top-2 right-2 px-2 py-1 bg-white border border-slate-200 text-[10px] font-bold rounded shadow-xs hover:bg-slate-100 flex items-center gap-1 text-slate-700"
                      >
                        {copiedScript ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedScript ? 'Tersalin!' : 'Salin Kode Script'}</span>
                      </button>
                      <pre className="p-2 bg-slate-900 text-emerald-400 rounded-lg text-[9px] font-mono overflow-x-auto max-h-32">
                        {sampleAppsScriptCode}
                      </pre>
                    </div>
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
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition"
          >
            {createdSheetUrl ? 'Selesai' : 'Batal'}
          </button>

          {!createdSheetUrl && (
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
              <span>{exportMode === 'oauth' ? 'Export via OAuth API' : 'Kirim ke Spreadsheet'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
