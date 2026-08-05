import React, { useState } from 'react';
import { ChkItem } from '../types';
import { Clipboard, Upload, X, Check, AlertCircle, Sparkles, FileSpreadsheet } from 'lucide-react';

interface PasteChkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportBulkChkItems: (items: ChkItem[], append?: boolean) => void;
}

export const PasteChkModal: React.FC<PasteChkModalProps> = ({
  isOpen,
  onClose,
  onImportBulkChkItems,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [appendMode, setAppendMode] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  // Parser helper
  const parsePastedData = (text: string): ChkItem[] => {
    const lines = text.trim().split(/\r?\n/);
    const parsedItems: ChkItem[] = [];

    lines.forEach((lineStr, index) => {
      const trimmed = lineStr.trim();
      if (!trimmed) return;

      const cols = trimmed.split(/\t|,/).map((c) => c.trim().replace(/^["']|["']$/g, ''));

      // Skip header row if first column is "week" or fourth column is "line" or "spo"
      if (
        index === 0 &&
        (cols[0].toLowerCase().includes('week') ||
          cols[3]?.toLowerCase() === 'line' ||
          cols[0].toLowerCase().includes('line'))
      ) {
        return;
      }

      let week = 31;
      let day = 1;
      let jamKe = 1;
      let line = 'A01';
      let spo = '';
      let size = '';
      let output = 0;
      let date = new Date().toISOString().split('T')[0];

      if (cols.length >= 7 && !isNaN(Number(cols[0]))) {
        // Format: Week | Day | Jam Ke | Line | Spo | Size | Output | Tanggal
        week = Number(cols[0]) || 31;
        day = Number(cols[1]) || 1;
        jamKe = Number(cols[2]) || 1;
        line = cols[3] || 'A01';
        spo = cols[4] || '';
        size = cols[5] || '';
        output = Number(cols[6]) || 0;
        if (cols[7]) date = cols[7];
      } else if (cols.length >= 4) {
        // Short Format: Line | Spo | Size | Output | Tanggal
        line = cols[0] || 'A01';
        spo = cols[1] || '';
        size = cols[2] || '';
        output = Number(cols[3]) || 0;
        if (cols[4]) date = cols[4];
      }

      if (spo) {
        parsedItems.push({
          id: `chk-paste-${Date.now()}-${index}`,
          week,
          day,
          jamKe,
          line: line.toUpperCase(),
          spo: spo.trim(),
          size: size.trim(),
          output: Number(output) || 0,
          date: date.trim(),
          createdAt: new Date().toISOString(),
        });
      }
    });

    return parsedItems;
  };

  const previewItems = parsePastedData(pasteText);

  const handleApply = () => {
    if (previewItems.length === 0) {
      setError('Tidak ada data valid yang terdeteksi. Pastikan Anda menyalin tabel dari Google Sheets/Excel.');
      return;
    }

    onImportBulkChkItems(previewItems, appendMode);
    setSuccess(`Berhasil mengimpor ${previewItems.length} baris data CHK10!`);
    setError('');

    setTimeout(() => {
      setSuccess('');
      setPasteText('');
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 space-y-4 max-h-[90vh] flex flex-col card-shadow">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Paste / Import Data CHK10 (Google Sheets / Excel)
              </h3>
              <p className="text-xs text-slate-500">
                Salin baris tabel dari Google Sheets lalu tempel di bawah ini.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-purple-50/80 border border-purple-200 p-3 rounded-xl text-xs text-purple-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <strong>Format Kolom Google Sheets:</strong><br />
            <code>Week | Day | Jam Ke | Line | SPO | Size | Output | Tanggal</code><br />
            <span className="text-[11px] text-purple-700">Contoh: <code>31	1	1	A03	R1774/26	14Y-PR	106	2026-08-03</code></span>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 flex flex-col space-y-1.5 min-h-[180px]">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span>Tempel Teks Salinan Google Sheets / Excel di Sini:</span>
            {previewItems.length > 0 && (
              <span className="font-bold text-purple-700 font-mono">
                {previewItems.length} baris terdeteksi
              </span>
            )}
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setError('');
            }}
            placeholder="31	1	1	A03	R1774/26	14Y-PR	106	2026-08-03&#10;31	1	2	A03	R1774/26	14Y-PR	106	2026-08-03"
            className="flex-1 w-full p-3 font-mono text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none leading-relaxed transition-all"
          />
        </div>

        {/* Mode options */}
        <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
          <span className="font-semibold text-slate-700">Opsi Import:</span>
          <div className="flex items-center space-x-4">
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="importMode"
                checked={appendMode}
                onChange={() => setAppendMode(true)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span>Tambahkan ke data yang ada</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="radio"
                name="importMode"
                checked={!appendMode}
                onChange={() => setAppendMode(false)}
                className="text-purple-600 focus:ring-purple-500"
              />
              <span>Ganti seluruh data CHK</span>
            </label>
          </div>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-semibold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition"
          >
            Batal
          </button>
          <button
            onClick={handleApply}
            disabled={previewItems.length === 0}
            className="flex items-center space-x-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Impor {previewItems.length > 0 ? `${previewItems.length} Baris Data` : 'Data CHK'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
