import React, { useState } from 'react';
import { WipItem, ChkItem } from '../types';
import { PasteChkModal } from './PasteChkModal';
import { getLineManpower, getAllLineManpower, checkManpowerDeviation } from '../utils/manpower';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Search,
  Filter,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Users,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface OutputReconciliationProps {
  wipItems: WipItem[];
  chkItems: ChkItem[];
  onSyncWipOutput?: (spo: string, size: string, newOutSewing: number) => void;
  onImportBulkChkItems?: (newItems: ChkItem[], append?: boolean) => void;
  onRefreshChkSheet?: () => Promise<void>;
  isRefreshingChkSheet?: boolean;
}

interface ReconciliationRow {
  key: string;
  line: string;
  spo: string;
  style: string;
  color: string;
  size: string;
  date?: string;
  wipOutSewing: number;
  hasWipEntry: boolean;
  chkTotalOutput: number;
  hasChkEntry: boolean;
  selisih: number; // wipOutSewing - chkTotalOutput
  isMatch: boolean;
  relatedChkLogs: ChkItem[];
}

export const OutputReconciliation: React.FC<OutputReconciliationProps> = ({
  wipItems,
  chkItems,
  onSyncWipOutput,
  onImportBulkChkItems,
  onRefreshChkSheet,
  isRefreshingChkSheet = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [matchMode, setMatchMode] = useState<'auto' | 'strict_date' | 'total'>('auto');
  const [filterStatus, setFilterStatus] = useState<'all' | 'match' | 'mismatch'>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

  // Normalize date string (e.g. "2026-08-03", "27-July-2027", "2026-8-3") to standard "YYYY-MM-DD"
  const normalizeDate = (rawDate?: string): string => {
    if (!rawDate) return '';
    const trimmed = rawDate.trim();
    if (!trimmed) return '';

    const dateOnly = trimmed.split('T')[0].trim();

    // 1. YYYY-M-D or YYYY-MM-DD
    const isoMatch = dateOnly.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
      const yyyy = isoMatch[1];
      const mm = isoMatch[2].padStart(2, '0');
      const dd = isoMatch[3].padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = dateOnly.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const dd = dmyMatch[1].padStart(2, '0');
      const mm = dmyMatch[2].padStart(2, '0');
      const yyyy = dmyMatch[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // 3. DD-Month-YYYY (e.g., 27-July-2027 or 27-Jul-2027)
    const monthNames: Record<string, string> = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12',
    };
    const textMonthMatch = dateOnly.match(/^(\d{1,2})[-/\s]+([a-zA-Z]+)[-/\s]+(\d{4})$/);
    if (textMonthMatch) {
      const dd = textMonthMatch[1].padStart(2, '0');
      const mStr = textMonthMatch[2].toLowerCase();
      const yyyy = textMonthMatch[3];
      const mm = monthNames[mStr];
      if (mm) return `${yyyy}-${mm}-${dd}`;
    }

    // 4. Safe fallback using local date parsing
    const parsed = new Date(dateOnly.replace(/-/g, '/'));
    if (!isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    return dateOnly.toLowerCase();
  };

  const getWipDate = (item: WipItem) => {
    if (item.date) return item.date.trim();
    if (item.createdAt) return item.createdAt.split('T')[0].trim();
    return '';
  };

  const getChkDate = (item: ChkItem) => {
    if (item.date) return item.date.trim();
    if (item.createdAt) return item.createdAt.split('T')[0].trim();
    return '';
  };

  // Unique list of dates
  const availableDates = Array.from(
    new Set([
      ...wipItems.map(getWipDate).filter(Boolean),
      ...chkItems.map(getChkDate).filter(Boolean),
    ])
  )
    .sort()
    .reverse();

  // Index CHK items into maps for fast multi-tier matching
  const chkMapByLineSpoSizeDate: Record<string, ChkItem[]> = {};
  const chkMapByLineSpoDate: Record<string, ChkItem[]> = {};
  const chkMapByLineSpoSize: Record<string, ChkItem[]> = {};
  const chkMapByLineSpo: Record<string, ChkItem[]> = {};

  // String normalization helpers for robust matching
  const cleanLine = (lineStr?: string) => {
    if (!lineStr) return '';
    const upper = lineStr.trim().toUpperCase();
    const match = upper.match(/^([A-Z]+)0*(\d+)$/);
    return match ? `${match[1]}${match[2].padStart(2, '0')}` : upper;
  };

  const cleanSpo = (spoStr?: string) => {
    if (!spoStr) return '';
    return spoStr.replace(/\s+/g, '').toLowerCase();
  };

  const cleanSize = (sizeStr?: string) => {
    if (!sizeStr) return '';
    return sizeStr.replace(/\s+/g, '').toLowerCase();
  };

  chkItems.forEach((c) => {
    const normLine = cleanLine(c.line);
    const normSpo = cleanSpo(c.spo);
    const normSize = cleanSize(c.size);
    const rawDate = getChkDate(c);
    const normDate = normalizeDate(rawDate);

    // Key with Date
    if (normDate) {
      const keyDate = `${normLine}_${normSpo}_${normSize}_${normDate}`;
      if (!chkMapByLineSpoSizeDate[keyDate]) chkMapByLineSpoSizeDate[keyDate] = [];
      chkMapByLineSpoSizeDate[keyDate].push(c);

      const keyLineSpoDate = `${normLine}_${normSpo}_${normDate}`;
      if (!chkMapByLineSpoDate[keyLineSpoDate]) chkMapByLineSpoDate[keyLineSpoDate] = [];
      chkMapByLineSpoDate[keyLineSpoDate].push(c);
    }

    // Key without Date
    const keySize = `${normLine}_${normSpo}_${normSize}`;
    if (!chkMapByLineSpoSize[keySize]) chkMapByLineSpoSize[keySize] = [];
    chkMapByLineSpoSize[keySize].push(c);

    const keyLineSpo = `${normLine}_${normSpo}`;
    if (!chkMapByLineSpo[keyLineSpo]) chkMapByLineSpo[keyLineSpo] = [];
    chkMapByLineSpo[keyLineSpo].push(c);
  });

  // Helper to find matching CHK logs for a WIP item
  const getMatchingChkLogs = (line: string, spo: string, size: string, rawDate: string): ChkItem[] => {
    const normLine = cleanLine(line);
    const normSpo = cleanSpo(spo);
    const normSize = cleanSize(size);
    const normDate = normalizeDate(rawDate);

    if (matchMode === 'strict_date') {
      if (normDate) {
        return chkMapByLineSpoSizeDate[`${normLine}_${normSpo}_${normSize}_${normDate}`] || [];
      }
      return [];
    }

    if (matchMode === 'total') {
      return chkMapByLineSpoSize[`${normLine}_${normSpo}_${normSize}`] || [];
    }

    // Auto Mode: Try exact with date -> try line+spo+date -> fallback to line+spo+size -> fallback to line+spo
    if (normDate) {
      const matchExactDate = chkMapByLineSpoSizeDate[`${normLine}_${normSpo}_${normSize}_${normDate}`];
      if (matchExactDate && matchExactDate.length > 0) return matchExactDate;

      const matchLineSpoDate = chkMapByLineSpoDate[`${normLine}_${normSpo}_${normDate}`];
      if (matchLineSpoDate && matchLineSpoDate.length > 0) {
        const filtered = matchLineSpoDate.filter((c) => cleanSize(c.size) === normSize);
        if (filtered.length > 0) return filtered;
      }
    }

    // Fallback if date is missing or CHK logged without matching date
    const matchSizeNoDate = chkMapByLineSpoSize[`${normLine}_${normSpo}_${normSize}`];
    if (matchSizeNoDate && matchSizeNoDate.length > 0) return matchSizeNoDate;

    const matchLineSpo = chkMapByLineSpo[`${normLine}_${normSpo}`];
    if (matchLineSpo && matchLineSpo.length > 0) {
      return matchLineSpo.filter((c) => cleanSize(c.size) === normSize);
    }

    return [];
  };

  // Build rows based on WIP Items & any CHK Items
  const reconciliationRowsMap: Record<string, ReconciliationRow> = {};

  // First process WIP Items
  wipItems.forEach((w) => {
    const normSpo = cleanSpo(w.spo);
    const normSize = cleanSize(w.size);
    const normLine = cleanLine(w.lineId);
    const rawDate = getWipDate(w);
    const normDate = normalizeDate(rawDate);

    const key = matchMode === 'total' 
      ? `${normLine}_${normSpo}_${normSize}` 
      : `${normLine}_${normSpo}_${normSize}_${normDate || 'nodate'}`;

    const matchingChkLogs = getMatchingChkLogs(w.lineId, w.spo, w.size, rawDate);
    const chkTotalOutput = matchingChkLogs.reduce((acc, curr) => acc + curr.output, 0);

    if (reconciliationRowsMap[key]) {
      reconciliationRowsMap[key].wipOutSewing += w.outSewing;
      reconciliationRowsMap[key].hasWipEntry = true;
      reconciliationRowsMap[key].selisih = reconciliationRowsMap[key].wipOutSewing - reconciliationRowsMap[key].chkTotalOutput;
      reconciliationRowsMap[key].isMatch = reconciliationRowsMap[key].wipOutSewing === reconciliationRowsMap[key].chkTotalOutput;
    } else {
      reconciliationRowsMap[key] = {
        key,
        line: w.lineId,
        spo: w.spo,
        style: w.style,
        color: w.color,
        size: w.size,
        date: rawDate,
        wipOutSewing: w.outSewing,
        hasWipEntry: true,
        chkTotalOutput,
        hasChkEntry: matchingChkLogs.length > 0,
        selisih: w.outSewing - chkTotalOutput,
        isMatch: w.outSewing === chkTotalOutput,
        relatedChkLogs: matchingChkLogs,
      };
    }
  });

  // Also include any CHK items that might not have a WIP item entry yet
  chkItems.forEach((c) => {
    const normSpo = cleanSpo(c.spo);
    const normSize = cleanSize(c.size);
    const normLine = cleanLine(c.line);
    const rawDate = getChkDate(c);
    const normDate = normalizeDate(rawDate);

    const key = matchMode === 'total'
      ? `${normLine}_${normSpo}_${normSize}`
      : `${normLine}_${normSpo}_${normSize}_${normDate || 'nodate'}`;

    if (!reconciliationRowsMap[key]) {
      const matchingChkLogs = getMatchingChkLogs(c.line, c.spo, c.size, rawDate);
      const chkTotalOutput = matchingChkLogs.reduce((acc, curr) => acc + curr.output, 0);

      reconciliationRowsMap[key] = {
        key,
        line: c.line,
        spo: c.spo,
        style: '-',
        color: '-',
        size: c.size,
        date: rawDate,
        wipOutSewing: 0,
        hasWipEntry: false,
        chkTotalOutput,
        hasChkEntry: true,
        selisih: 0 - chkTotalOutput,
        isMatch: 0 === chkTotalOutput,
        relatedChkLogs: matchingChkLogs,
      };
    } else {
      reconciliationRowsMap[key].hasChkEntry = true;
    }
  });

  const allRows = Object.values(reconciliationRowsMap);

  // Unique lines
  const availableLines = Array.from(new Set(allRows.map((r) => r.line)))
    .sort();

  // Filter rows
  const filteredRows = allRows.filter((r) => {
    const matchesSearch =
      r.spo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.line.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.style.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.date || '').includes(searchQuery);

    const matchesLine = !selectedLine || r.line === selectedLine;
    const matchesDate = !selectedDate || (r.date || '').includes(selectedDate);

    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'match'
        ? r.isMatch
        : !r.isMatch;

    return matchesSearch && matchesLine && matchesDate && matchesStatus;
  });

  // Overall KPI Metrics
  const totalWipOutput = allRows.reduce((acc, r) => acc + r.wipOutSewing, 0);
  const totalChkOutput = allRows.reduce((acc, r) => acc + r.chkTotalOutput, 0);
  const matchedRowsCount = allRows.filter((r) => r.isMatch).length;
  const mismatchRowsCount = allRows.filter((r) => !r.isMatch).length;
  const matchPercentage =
    allRows.length > 0 ? Math.round((matchedRowsCount / allRows.length) * 100) : 100;

  // Unique Line & Date pairs for Manpower & Working Hours breakdown & Output Gap
  const lineDatePairsMap: Record<string, { line: string; date: string }> = {};
  wipItems.forEach((w) => {
    const line = w.lineId;
    const date = getWipDate(w) || new Date().toISOString().split('T')[0];
    const key = `${cleanLine(line)}_${date}`;
    if (!lineDatePairsMap[key]) {
      lineDatePairsMap[key] = { line, date };
    }
  });
  chkItems.forEach((c) => {
    const line = c.line;
    const date = getChkDate(c) || new Date().toISOString().split('T')[0];
    const key = `${cleanLine(line)}_${date}`;
    if (!lineDatePairsMap[key]) {
      lineDatePairsMap[key] = { line, date };
    }
  });

  const allMpMap = getAllLineManpower();
  const lineDateManpowerSummary = Object.values(lineDatePairsMap).map(({ line, date }) => {
    const key = `${cleanLine(line)}_${date}`;
    const hasMp = !!allMpMap[key];
    const mp = getLineManpower(line, date);
    const dev = checkManpowerDeviation(mp);

    const lineDateWip = wipItems
      .filter((w) => cleanLine(w.lineId) === cleanLine(line) && getWipDate(w) === date)
      .reduce((sum, w) => sum + (w.outSewing || 0), 0);

    const matchingChkForDate = chkItems.filter(
      (c) => cleanLine(c.line) === cleanLine(line) && getChkDate(c) === date
    );
    const lineDateChk = matchingChkForDate.reduce((sum, c) => sum + (c.output || 0), 0);
    const totalJamChk = new Set(matchingChkForDate.map((c) => c.jamKe)).size;
    const totalJamWip = hasMp ? dev.totalHours : 0;
    const manpowerWip = hasMp ? ((mp.normalMp || 0) + (mp.overtimeMp || 0)) : 0;
    const manpowerChk = hasMp ? manpowerWip : 0;

    return {
      line,
      date,
      hasMp,
      mp,
      dev,
      totalJamChk,
      totalJamWip,
      manpowerChk,
      manpowerWip,
      lineDateWip,
      lineDateChk,
      selisih: lineDateWip - lineDateChk,
    };
  }).filter((item) => {
    const matchesLine = !selectedLine || item.line === selectedLine;
    const matchesDate = !selectedDate || item.date.includes(selectedDate);
    return matchesLine && matchesDate;
  }).sort((a, b) => b.date.localeCompare(a.date) || a.line.localeCompare(b.line));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden my-6">
      {/* Header */}
      <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">
                Rekonsiliasi Output WIP vs Data CHK10
              </h2>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 font-mono px-2 py-0.5 rounded-full border border-blue-400/30">
                Auto Match Checking
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Memastikan Output Sewing di WIP sama persis dengan akumulasi Output CHK10 per Line, SPO, & Size
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onRefreshChkSheet && (
            <button
              onClick={onRefreshChkSheet}
              disabled={isRefreshingChkSheet}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition"
              title="Sync data langsung dari Google Sheets CHK10"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingChkSheet ? 'animate-spin' : ''}`} />
              <span>{isRefreshingChkSheet ? 'Syncing...' : 'Sync dari Google Sheets CHK10'}</span>
            </button>
          )}

          {onImportBulkChkItems && (
            <button
              onClick={() => setIsPasteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-purple-200" />
              <span>+ Paste Manual</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Output Sewing (WIP)
          </span>
          <span className="text-xl font-mono font-black text-slate-900 mt-1">
            {totalWipOutput.toLocaleString()} <span className="text-xs text-slate-400 font-sans">pcs</span>
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Output Log (CHK10)
          </span>
          <span className="text-xl font-mono font-black text-purple-700 mt-1">
            {totalChkOutput.toLocaleString()} <span className="text-xs text-slate-400 font-sans">pcs</span>
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm flex flex-col">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Akurasi Match ({matchPercentage}%)</span>
          </span>
          <span className="text-xl font-mono font-black text-emerald-700 mt-1">
            {matchedRowsCount} <span className="text-xs font-sans text-emerald-600 font-normal">SPO/Size Sesuai</span>
          </span>
        </div>

        <div
          className={`bg-white p-3.5 rounded-xl border shadow-sm flex flex-col ${
            mismatchRowsCount > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
          }`}
        >
          <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Ada Selisih (Mismatch)</span>
          </span>
          <span className="text-xl font-mono font-black text-rose-700 mt-1">
            {mismatchRowsCount} <span className="text-xs font-sans text-rose-600 font-normal">Perlu Dicek</span>
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Status Segmented Buttons */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition ${
                filterStatus === 'all'
                  ? 'bg-white font-bold text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({allRows.length})
            </button>
            <button
              onClick={() => setFilterStatus('match')}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                filterStatus === 'match'
                  ? 'bg-white font-bold text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sesuai ({matchedRowsCount})
            </button>
            <button
              onClick={() => setFilterStatus('mismatch')}
              className={`px-3 py-1 rounded-lg transition flex items-center gap-1 ${
                filterStatus === 'mismatch'
                  ? 'bg-white font-bold text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Selisih ({mismatchRowsCount})
            </button>
          </div>

          {/* Line Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Line:</span>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Line</option>
              {availableLines.map((l) => (
                <option key={l} value={l}>
                  Line {l}
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-800 focus:outline-none cursor-pointer"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline ml-1"
                title="Tampilkan Semua Tanggal"
              >
                Semua
              </button>
            )}
          </div>

          {/* Match Mode Selector */}
          <div className="flex items-center gap-1.5 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200 text-xs">
            <span className="text-purple-900 font-bold text-[11px]">Mode Matching:</span>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as 'auto' | 'strict_date' | 'total')}
              className="bg-transparent text-xs font-black text-purple-900 focus:outline-none cursor-pointer"
            >
              <option value="auto">Auto-Match (Line + Tanggal + SPO + Size)</option>
              <option value="strict_date">Strict Per-Tanggal Kalender</option>
              <option value="total">Akumulasi Total (Semua Tanggal)</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari SPO / Size / Tanggal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* MANPOWER & JAM KERJA RECONCILIATION SUMMARY */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Rekonsiliasi Manpower & Jam Kerja per Line & Tanggal
              </h3>
              <p className="text-[11px] text-slate-500">Analisis jam kerja normal, lembur, manpower, dan gap output produksi</p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
            {lineDateManpowerSummary.length} Line-Tanggal
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono text-[10px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="p-2.5 border-r border-slate-200 text-center">LINE</th>
                <th className="p-2.5 border-r border-slate-200 text-center">TANGGAL</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-900">TOTAL JAM (CHK vs WIP)</th>
                <th className="p-2.5 border-r border-slate-200 text-center bg-blue-50/50 text-blue-900">MAN POWER (CHK vs WIP)</th>
                <th className="p-2.5 border-r border-slate-200 text-right bg-purple-50/20 text-purple-900">OUTPUT (CHK vs WIP)</th>
                <th className="p-2.5 border-r border-slate-200 text-right">GAP OUTPUT</th>
                <th className="p-2.5 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {lineDateManpowerSummary.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-sans">
                    Tidak ada data manpower & jam kerja yang sesuai filter.
                  </td>
                </tr>
              ) : (
                lineDateManpowerSummary.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-900">
                      {item.line}
                    </td>
                    <td className="p-2.5 border-r border-slate-200 text-center font-semibold text-slate-600">
                      {item.date}
                    </td>
                    <td className={`p-2.5 border-r border-slate-200 text-center font-bold ${item.hasMp && item.totalJamChk !== item.totalJamWip ? 'bg-rose-100/90 text-rose-900' : 'bg-indigo-50/20 text-indigo-900'}`}>
                      {item.totalJamChk > 0 ? `${item.totalJamChk} jam` : '-'} <span className="text-slate-400">vs</span> {item.hasMp ? `${item.totalJamWip} jam` : <span className="text-slate-400 font-normal italic">-</span>}
                    </td>
                    <td className={`p-2.5 border-r border-slate-200 text-center font-bold ${item.hasMp && item.manpowerChk !== item.manpowerWip ? 'bg-rose-100/90 text-rose-900' : 'bg-blue-50/10 text-blue-900'}`}>
                      {item.hasMp ? `${item.manpowerWip} org` : <span className="text-slate-400 font-normal italic">-</span>}
                    </td>
                    <td className={`p-2.5 border-r border-slate-200 text-right font-bold ${item.lineDateChk !== item.lineDateWip ? 'bg-rose-100/90 text-rose-900' : 'bg-purple-50/10 text-purple-800'}`}>
                      <span className={item.lineDateChk !== item.lineDateWip ? 'text-rose-900 font-black' : 'text-purple-700'}>{item.lineDateChk.toLocaleString()}</span> <span className="text-slate-400 font-normal">vs</span> <span className={item.lineDateChk !== item.lineDateWip ? 'text-rose-900 font-black' : 'text-blue-700'}>{item.lineDateWip.toLocaleString()}</span> pcs
                    </td>
                    <td
                      className={`p-2.5 border-r border-slate-200 text-right font-black ${
                        item.selisih === 0
                          ? 'text-slate-400 bg-slate-50/30'
                          : item.selisih > 0
                          ? 'text-blue-700 bg-blue-100/80 animate-pulse'
                          : 'text-rose-700 bg-rose-100/90 animate-pulse'
                      }`}
                    >
                      {item.selisih > 0 ? `+${item.selisih}` : item.selisih} pcs
                    </td>
                    <td className="p-2.5 text-center">
                      {!item.hasMp ? (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full border border-slate-200">
                          Belum Diinput
                        </span>
                      ) : item.dev.isDeviation ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-full border border-red-300 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-red-600" />
                          <span>Deviasi</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-300 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Normal</span>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/90 text-slate-600 font-mono border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold">
              <th className="p-3 border-r border-slate-200 text-center min-w-[70px]">LINE</th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[90px]">TANGGAL</th>
              <th className="p-3 border-r border-slate-200 min-w-[120px]">SPO</th>
              <th className="p-3 border-r border-slate-200 min-w-[160px]">STYLE / COLOR</th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[80px]">SIZE</th>
              <th className="p-3 border-r border-slate-200 text-right bg-blue-50/40 text-blue-900 min-w-[120px]">
                OUTPUT WIP
              </th>
              <th className="p-3 border-r border-slate-200 text-right bg-purple-50/40 text-purple-900 min-w-[120px]">
                OUTPUT CHK10
              </th>
              <th className="p-3 border-r border-slate-200 text-right min-w-[100px]">SELISIH</th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[120px]">STATUS MATCH</th>
              <th className="p-3 text-center min-w-[90px]">DETAIL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-sans">
                  Tidak ada data rekonsiliasi yang sesuai kriteria filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isExpanded = expandedKey === row.key;

                return (
                  <React.Fragment key={row.key}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors ${
                        !row.isMatch ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-900">
                        {row.line}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-center font-semibold text-slate-600 text-[11px]">
                        {row.date || '-'}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-blue-700 font-bold">
                        {row.spo}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-slate-800 font-sans text-[11px]">
                        {row.style !== '-' || row.color !== '-' ? (
                          <>
                            <div className="font-semibold text-slate-900 truncate max-w-[200px]">
                              {row.style}
                            </div>
                            <div className="text-[10px] text-slate-400">{row.color !== '-' ? row.color : ''}</div>
                          </>
                        ) : (
                          <span className="text-slate-300 font-mono block text-center">-</span>
                        )}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-center font-bold text-slate-900">
                        {row.size}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-right font-black bg-blue-50/20">
                        {row.hasWipEntry && row.wipOutSewing > 0 ? (
                          <span className="text-blue-800">{row.wipOutSewing.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300 font-normal font-mono block text-center">-</span>
                        )}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-right font-black bg-purple-50/20">
                        {row.hasChkEntry && row.chkTotalOutput > 0 ? (
                          <span className="text-purple-800">{row.chkTotalOutput.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300 font-normal font-mono block text-center">-</span>
                        )}
                      </td>
                      <td
                        className={`p-3 border-r border-slate-200 text-right font-black ${
                          row.selisih === 0
                            ? 'text-slate-400'
                            : row.selisih > 0
                            ? 'text-blue-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {row.selisih > 0 ? `+${row.selisih}` : row.selisih}
                      </td>
                      <td className="p-3 border-r border-slate-200 text-center">
                        {row.isMatch ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>SESUAI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>SELISIH ({row.selisih})</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setExpandedKey(isExpanded ? null : row.key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg transition"
                        >
                          <span>{row.relatedChkLogs.length} Log</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-slate-500" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Rows showing individual CHK10 entries for this SPO & Size */}
                    {isExpanded && (
                      <tr className="bg-slate-100/80">
                        <td colSpan={10} className="p-4 border-b border-slate-200">
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 font-sans">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-purple-600" />
                                Breakdown Hourly Log CHK10 - SPO {row.spo} ({row.size})
                              </h4>
                              {onSyncWipOutput && !row.isMatch && (
                                <button
                                  onClick={() =>
                                    onSyncWipOutput(row.spo, row.size, row.chkTotalOutput)
                                  }
                                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Samakan Output WIP ke {row.chkTotalOutput} pcs</span>
                                </button>
                              )}
                            </div>

                            {row.relatedChkLogs.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                Belum ada entri log CHK10 untuk SPO & Size ini.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs font-mono">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase border-b border-slate-200 font-bold">
                                      <th className="p-2">Week</th>
                                      <th className="p-2">Day</th>
                                      <th className="p-2">Jam Ke</th>
                                      <th className="p-2">Line</th>
                                      <th className="p-2">SPO</th>
                                      <th className="p-2">Size</th>
                                      <th className="p-2 text-right">Output CHK</th>
                                      <th className="p-2 text-center">Tanggal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {row.relatedChkLogs.map((log) => (
                                      <tr key={log.id} className="hover:bg-purple-50/30">
                                        <td className="p-2 font-bold text-purple-700">
                                          W{log.week}
                                        </td>
                                        <td className="p-2 font-bold text-purple-800">
                                          Day {log.day || 1}
                                        </td>
                                        <td className="p-2 font-semibold">Jam-{log.jamKe}</td>
                                        <td className="p-2 font-bold">{log.line}</td>
                                        <td className="p-2 text-blue-700">{log.spo}</td>
                                        <td className="p-2 font-bold">{log.size}</td>
                                        <td className="p-2 text-right font-black text-emerald-700">
                                          +{log.output} pcs
                                        </td>
                                        <td className="p-2 text-center text-slate-400 text-[10px]">
                                          {log.date || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-purple-50/50 font-bold text-purple-900 border-t border-purple-200">
                                      <td colSpan={6} className="p-2 text-right font-sans">
                                        TOTAL ACCUMULATED OUTPUT CHK10:
                                      </td>
                                      <td className="p-2 text-right font-black text-emerald-800">
                                        {row.chkTotalOutput.toLocaleString()} pcs
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onImportBulkChkItems && (
        <PasteChkModal
          isOpen={isPasteModalOpen}
          onClose={() => setIsPasteModalOpen(false)}
          onImportBulkChkItems={onImportBulkChkItems}
        />
      )}
    </div>
  );
};
