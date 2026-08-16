import React from 'react';
import { Factory, Database, RefreshCw, FileSpreadsheet } from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'line_detail';
  selectedLineId?: string;
  leaderNik?: string;
  onOpenDataSource: () => void;
  onOpenGoogleSheets?: () => void;
  onResetData: () => void;
  onRetrySync?: () => void;
  totalLines: number;
  activeLinesCount: number;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  selectedLineId,
  leaderNik,
  onOpenDataSource,
  onOpenGoogleSheets,
  onResetData,
  onRetrySync,
  totalLines,
  activeLinesCount,
  syncStatus = 'idle',
}) => {
  return (
    <header className="bg-white border-b border-slate-200 text-slate-800 px-6 py-4 sticky top-0 z-30 card-shadow">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-600/20">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                WIP Sewing System
              </h1>
              <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full border border-blue-100">
                Syncora WIP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Leader Production Input &bull; Factory Monitoring
            </p>
          </div>
        </div>

        {/* Center / Stats info */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Total Lines: <strong className="text-slate-900 font-bold">{totalLines}</strong></span>
          </div>
          <span className="text-slate-300">|</span>
          <div>
            Active Today: <strong className="text-emerald-600 font-bold">{activeLinesCount}</strong>
          </div>
          {currentView === 'line_detail' && (
            <>
              <span className="text-slate-300">|</span>
              <div className="text-blue-700 font-mono font-semibold">
                Line: {selectedLineId} {leaderNik ? `(NIK: ${leaderNik})` : ''}
              </div>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {syncStatus !== 'idle' && (
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition ${
                syncStatus === 'syncing'
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-ping'
                    : syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
                }`}
              ></span>
              <span>
                {syncStatus === 'syncing'
                  ? 'Menyimpan...'
                  : syncStatus === 'synced'
                  ? 'Tersimpan di Sheet'
                  : 'Gagal Simpan'}
              </span>
              {syncStatus === 'error' && onRetrySync && (
                <button
                  type="button"
                  onClick={onRetrySync}
                  className="ml-1 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded transition cursor-pointer"
                >
                  Ulangi
                </button>
              )}
            </div>
          )}

          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              id="btn-google-sheets-sync"
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition shadow-xs"
              title="Koneksi & Sync Google Spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Sheets</span>
            </button>
          )}

          <button
            onClick={onOpenDataSource}
            id="btn-data-source"
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition"
            title="Konfigurasi / Export Data Source JSON"
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Data Source</span>
          </button>

          <button
            onClick={onResetData}
            id="btn-reset-data"
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition"
            title="Reset ke data default"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
