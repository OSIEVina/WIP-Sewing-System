import React, { useState } from 'react';
import { ProductionLine, WipItem, SpoOption, ChkItem } from '../types';
import { Database, Copy, Upload, Check, AlertCircle, X, FileSpreadsheet } from 'lucide-react';

interface DataSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lines: ProductionLine[];
  wipItems: WipItem[];
  spoOptions: SpoOption[];
  chkItems?: ChkItem[];
  onImportData: (data: {
    lines?: ProductionLine[];
    wipItems?: WipItem[];
    spoOptions?: SpoOption[];
    chkItems?: ChkItem[];
  }) => void;
}

export const DataSourceModal: React.FC<DataSourceModalProps> = ({
  isOpen,
  onClose,
  lines,
  wipItems,
  spoOptions,
  chkItems = [],
  onImportData,
}) => {
  const currentDataObj = {
    lines,
    spoOptions,
    wipItems,
    chkItems,
  };

  const [jsonString, setJsonString] = useState(JSON.stringify(currentDataObj, null, 2));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSON tidak valid.');
      }
      onImportData(parsed);
      setError('');
      setSuccess('Data berhasil diperbarui!');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(`Gagal import JSON: ${err.message || 'Format tidak valid'}`);
      setSuccess('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl p-6 text-slate-900 space-y-4 max-h-[90vh] flex flex-col card-shadow">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Integrasi Sumber Data (JSON Data Source)
              </h3>
              <p className="text-xs text-slate-400">
                Salin skema JSON atau tempel sumber data kustom dari API/database Anda.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
            id="btn-close-datasource"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-950 space-y-1">
          <div className="flex items-center justify-between font-bold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Terhubung dengan Google Sheets:</span>
            </span>
            <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-mono px-2 py-0.5 rounded-full">
              Live OAuth Connected
            </span>
          </div>
          <p className="text-[11px] text-emerald-800">
            &bull; <strong>CHK10 Data Sheet:</strong> ID <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">1k2Oasyi...qd3_E</code> (GID: <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">1420133113</code>)
          </p>
          <p className="text-[11px] text-emerald-800">
            &bull; <strong>SPO Options Sheet:</strong> ID <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">1k2Oasyi...qd3_E</code> (GID: <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">672991499</code>)
          </p>
        </div>

        {/* Editor Textarea */}
        <div className="flex-1 min-h-[280px] flex flex-col space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span>Payload Data JSON Saat Ini:</span>
            <span>{lines.length} Lines &bull; {wipItems.length} WIP Records</span>
          </div>
          <textarea
            value={jsonString}
            onChange={(e) => setJsonString(e.target.value)}
            id="textarea-datasource-json"
            className="flex-1 w-full p-4 font-mono text-xs bg-slate-50 text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed transition-all"
          />
        </div>

        {/* Status Feedback */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-semibold">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              id="btn-copy-json"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Tersalin!' : 'Salin JSON Data'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition"
            >
              Tutup
            </button>
            <button
              onClick={handleApplyImport}
              id="btn-apply-import"
              className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Terapkan Data Source</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
