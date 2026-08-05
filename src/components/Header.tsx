import React from 'react';
import { Factory, Database, RefreshCw, Layers } from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'line_detail';
  selectedLineId?: string;
  leaderNik?: string;
  onOpenDataSource: () => void;
  onResetData: () => void;
  totalLines: number;
  activeLinesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  selectedLineId,
  leaderNik,
  onOpenDataSource,
  onResetData,
  totalLines,
  activeLinesCount,
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
