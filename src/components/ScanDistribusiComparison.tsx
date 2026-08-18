import React, { useState, useMemo } from 'react';
import { WipItem, ScanDistribusiItem } from '../types';
import { normalizeDateStr } from '../utils/date';
import { getCanonicalSizeKey, compareSizes } from '../utils/size';
import {
  ArrowRightLeft,
  Search,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ScanDistribusiComparisonProps {
  wipItems: WipItem[];
  scanItems: ScanDistribusiItem[];
  onRefreshScan?: () => Promise<void>;
  isRefreshingScan?: boolean;
}

interface ComparisonRow {
  key: string;
  line: string;
  spo: string;
  size: string;
  date: string;
  scanInQty: number;
  scanDistQty: number;
  selisih: number; // scanInQty - scanDistQty
  isMatch: boolean;
}

export const ScanDistribusiComparison: React.FC<ScanDistribusiComparisonProps> = ({
  wipItems,
  scanItems,
  onRefreshScan,
  isRefreshingScan = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'match' | 'mismatch'>('all');

  const cleanKey = (str?: string) => (str ? str.trim().toUpperCase() : '');
  const cleanSpo = (spo?: string) => (spo ? spo.replace(/\s+/g, '').toLowerCase() : '');
  const cleanColor = (c?: string) => (c ? c.replace(/\s+/g, '').toLowerCase() : '');
  const cleanSize = (sz?: string) => (sz ? getCanonicalSizeKey(sz) : '');

  const getWipDate = (item: WipItem) => {
    return normalizeDateStr(item.date || (item.createdAt ? item.createdAt.split('T')[0] : ''));
  };

  // Extract all available dates
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    wipItems.forEach((i) => {
      const d = getWipDate(i);
      if (d) set.add(d);
    });
    scanItems.forEach((s) => {
      const d = normalizeDateStr(s.date);
      if (d) set.add(d);
    });
    return Array.from(set).sort().reverse();
  }, [wipItems, scanItems]);

  // Extract all available lines
  const availableLines = useMemo(() => {
    const set = new Set<string>();
    wipItems.forEach((i) => {
      if (i.lineId) set.add(cleanKey(i.lineId));
    });
    scanItems.forEach((s) => {
      if (s.line) set.add(cleanKey(s.line));
    });
    return Array.from(set).sort();
  }, [wipItems, scanItems]);

  // Merge and compare Scan In (WIP) vs Scan Distribusi per Line, SPO, Size, Date
  const comparisonRows = useMemo(() => {
    const map = new Map<string, { line: string; spo: string; size: string; date: string; scanIn: number; scanDist: number }>();

    // 1. Accumulate Scan In (from wipItems inHariIni)
    wipItems.forEach((w) => {
      const line = cleanKey(w.lineId) || 'A01';
      const spo = w.spo ? w.spo.trim() : '';
      const color = w.color ? w.color.trim() : '';
      const size = w.size ? w.size.trim() : '';
      const date = getWipDate(w) || '2026-08-01';
      if (!spo || !size) return;

      const key = `${line}_${cleanSpo(spo)}_${cleanColor(color)}_${cleanSize(size)}_${date}`;
      if (!map.has(key)) {
        map.set(key, { line, spo, size, date, scanIn: 0, scanDist: 0 });
      }
      map.get(key)!.scanIn += w.inHariIni || 0;
    });

    // 2. Accumulate Scan Distribusi (from scanItems qtyPcs)
    scanItems.forEach((s) => {
      const line = cleanKey(s.line) || 'A01';
      const spo = s.spo ? s.spo.trim() : '';
      const color = s.color ? s.color.trim() : '';
      const size = s.size ? s.size.trim() : '';
      const date = s.date || '2026-08-01';
      if (!spo || !size) return;

      const key = `${line}_${cleanSpo(spo)}_${cleanColor(color)}_${cleanSize(size)}_${date}`;
      if (!map.has(key)) {
        map.set(key, { line, spo, size, date, scanIn: 0, scanDist: 0 });
      }
      map.get(key)!.scanDist += s.qtyPcs || 0;
    });

    const rows: ComparisonRow[] = [];
    map.forEach((val, key) => {
      const selisih = val.scanIn - val.scanDist;
      const isMatch = selisih === 0;
      rows.push({
        key,
        line: val.line,
        spo: val.spo,
        size: val.size,
        date: val.date,
        scanInQty: val.scanIn,
        scanDistQty: val.scanDist,
        selisih,
        isMatch,
      });
    });

    return rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.line.localeCompare(b.line) ||
        a.spo.localeCompare(b.spo, undefined, { numeric: true }) ||
        compareSizes(a.size, b.size)
    );
  }, [wipItems, scanItems]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return comparisonRows.filter((r) => {
      if (selectedDate && r.date !== selectedDate) return false;
      if (selectedLine && r.line !== selectedLine) return false;
      if (filterStatus === 'match' && !r.isMatch) return false;
      if (filterStatus === 'mismatch' && r.isMatch) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSpo = r.spo.toLowerCase().includes(q);
        const matchSize = r.size.toLowerCase().includes(q);
        const matchLine = r.line.toLowerCase().includes(q);
        const matchDate = r.date.toLowerCase().includes(q);
        if (!matchSpo && !matchSize && !matchLine && !matchDate) return false;
      }
      return true;
    });
  }, [comparisonRows, selectedDate, selectedLine, filterStatus, searchQuery]);

  // Totals stats
  const stats = useMemo(() => {
    let totalScanIn = 0;
    let totalScanDist = 0;
    let matchCount = 0;
    let mismatchCount = 0;

    filteredRows.forEach((r) => {
      totalScanIn += r.scanInQty;
      totalScanDist += r.scanDistQty;
      if (r.isMatch) matchCount++;
      else mismatchCount++;
    });

    return { totalScanIn, totalScanDist, matchCount, mismatchCount };
  }, [filteredRows]);

  const handleExportExcel = () => {
    const exportData = filteredRows.map((r, idx) => ({
      No: idx + 1,
      Tanggal: r.date,
      Line: r.line,
      SPO: r.spo,
      Size: r.size,
      'Scan In (WIP)': r.scanInQty,
      'Scan Distribusi': r.scanDistQty,
      'Selisih (In - Dist)': r.selisih,
      Status: r.isMatch ? 'MATCH' : 'SELISIH',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Compare Scan In vs Dist');
    XLSX.writeFile(wb, `Compare_ScanIn_vs_ScanDistribusi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Compare Scan In vs Scan Distribusi
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onRefreshScan && (
            <button
              onClick={onRefreshScan}
              disabled={isRefreshingScan}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition disabled:opacity-50"
              title="Sinkronisasi ulang data Scan Distribusi dari Google Sheets"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshingScan ? 'animate-spin' : ''}`} />
              <span>{isRefreshingScan ? 'Memuat...' : 'Refresh Sheet Scan Distribusi'}</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Scan In (WIP)</div>
          <div className="text-2xl font-black text-blue-900 mt-1 font-mono">{stats.totalScanIn.toLocaleString()} Pcs</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Akumulasi dari modul WIP</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Total Scan Distribusi</div>
          <div className="text-2xl font-black text-purple-900 mt-1 font-mono">{stats.totalScanDist.toLocaleString()} Pcs</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Dari spreadsheet Scan Distribusi</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Match Sesuai</div>
          <div className="text-2xl font-black text-emerald-900 mt-1 font-mono">{stats.matchCount} Baris</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Selisih 0 Pcs (Sama persis)</div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 p-4 rounded-2xl shadow-xs">
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Penyimpangan / Selisih</div>
          <div className="text-2xl font-black text-rose-900 mt-1 font-mono">{stats.mismatchCount} Baris</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Ada perbedaan kuantitas</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Search */}
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari SPO, Size, atau Line..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">Tanggal:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Tanggal</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Line Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">Line:</span>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer uppercase"
            >
              <option value="">Semua Line</option>
              {availableLines.map((l) => (
                <option key={l} value={l}>
                  LINE {l}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="match">Match (Sama)</option>
              <option value="mismatch">Selisih (Tidak Sama)</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 px-1">
          Menampilkan {filteredRows.length} dari {comparisonRows.length} data
        </div>
      </div>

      {/* Comparison Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider">
                <th className="p-3 border-r border-slate-200 text-center w-12">No</th>
                <th className="p-3 border-r border-slate-200">Tanggal</th>
                <th className="p-3 border-r border-slate-200">Line</th>
                <th className="p-3 border-r border-slate-200">SPO#</th>
                <th className="p-3 border-r border-slate-200 text-center">Size</th>
                <th className="p-3 border-r border-slate-200 text-right bg-blue-50/50 text-blue-900">
                  Scan In (WIP)
                </th>
                <th className="p-3 border-r border-slate-200 text-right bg-purple-50/50 text-purple-900">
                  Scan Distribusi
                </th>
                <th className="p-3 border-r border-slate-200 text-right">Selisih (In - Dist)</th>
                <th className="p-3 text-center">Status Rekonsiliasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-sans italic font-medium">
                    Tidak ada data perbandingan Scan In vs Scan Distribusi yang ditemukan untuk filter tersebut.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr
                    key={row.key}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !row.isMatch ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    <td className="p-3 border-r border-slate-200 text-center font-sans font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-semibold text-slate-700">
                      {row.date}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/50">
                      LINE {row.line}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-bold text-blue-900">
                      {row.spo}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-800">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 text-slate-700">
                        {row.size}
                      </span>
                    </td>
                    <td className="p-3 border-r border-slate-200 text-right font-bold text-blue-900 bg-blue-50/20">
                      {row.scanInQty.toLocaleString()} Pcs
                    </td>
                    <td className="p-3 border-r border-slate-200 text-right font-bold text-purple-900 bg-purple-50/20">
                      {row.scanDistQty.toLocaleString()} Pcs
                    </td>
                    <td
                      className={`p-3 border-r border-slate-200 text-right font-black ${
                        row.selisih === 0
                          ? 'text-slate-600'
                          : row.selisih > 0
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {row.selisih > 0 ? `+${row.selisih.toLocaleString()}` : row.selisih.toLocaleString()} Pcs
                    </td>
                    <td className="p-3 text-center">
                      {row.isMatch ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 font-sans">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>MATCH</span>
                        </span>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1 font-sans"
                          title={`Scan In (${row.scanInQty}) vs Scan Distribusi (${row.scanDistQty}) selisih ${row.selisih}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>SELISIH</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
