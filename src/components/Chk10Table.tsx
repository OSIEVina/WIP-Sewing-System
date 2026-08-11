import React, { useState } from 'react';
import { ChkItem, SpoOption } from '../types';
import { PasteChkModal } from './PasteChkModal';
import {
  Search,
  Download,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  Filter,
  Clipboard,
  RefreshCw,
  Check,
} from 'lucide-react';

interface Chk10TableProps {
  items: ChkItem[];
  spoOptions: SpoOption[];
  linesList: string[];
  onAddItem: (newItem: Omit<ChkItem, 'id' | 'createdAt'>) => void;
  onUpdateItem: (updatedItem: ChkItem) => void;
  onDeleteItem: (id: string) => void;
  onImportBulkChkItems?: (newItems: ChkItem[], append?: boolean) => void;
  onRefreshChkSheet?: () => Promise<void>;
  isRefreshingChkSheet?: boolean;
  lastSyncTime?: string;
}

export const Chk10Table: React.FC<Chk10TableProps> = ({
  items,
  spoOptions,
  linesList,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onImportBulkChkItems,
  onRefreshChkSheet,
  isRefreshingChkSheet = false,
  lastSyncTime,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedLine, setSelectedLine] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modal State for Add/Edit/Paste
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editModalItem, setEditModalItem] = useState<ChkItem | null>(null);

  // New Item Form State
  const [newWeek, setNewWeek] = useState<number>(31);
  const [newDay, setNewDay] = useState<number>(1);
  const [newJamKe, setNewJamKe] = useState<number>(1);
  const [newLine, setNewLine] = useState<string>(linesList[0] || 'A01');
  const [newSpo, setNewSpo] = useState<string>(spoOptions[0]?.spo || 'R2479/26');
  const [newSize, setNewSize] = useState<string>(spoOptions[0]?.sizes[0] || 'S-PR');
  const [newOutput, setNewOutput] = useState<number>(100);
  const [newDate, setNewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Derive unique weeks, days, and dates for filtering
  const availableWeeks = Array.from(new Set<number>(items.map((i) => Number(i.week)))).sort(
    (a, b) => b - a
  );
  const availableDays = Array.from(
    new Set<number>(items.map((i) => Number(i.day || 1)))
  ).sort((a, b) => a - b);
  const availableDates = Array.from(
    new Set(items.map((i) => i.date || new Date().toISOString().split('T')[0]))
  )
    .sort()
    .reverse();

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.spo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.line.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.size.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesWeek = !selectedWeek || item.week.toString() === selectedWeek;
    const matchesDay = !selectedDay || (item.day || 1).toString() === selectedDay;
    const matchesLine = !selectedLine || item.line === selectedLine;
    const matchesDate = !selectedDate || (item.date || '').includes(selectedDate);

    return matchesSearch && matchesWeek && matchesDay && matchesLine && matchesDate;
  });

  // Calculate Summary Metrics
  const totalOutput = filteredItems.reduce((acc, curr) => acc + curr.output, 0);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem({
      week: Number(newWeek) || 31,
      day: Number(newDay) || 1,
      jamKe: Number(newJamKe) || 1,
      line: newLine,
      spo: newSpo,
      size: newSize,
      output: Number(newOutput) || 0,
      date: newDate,
    });
    setIsAddModalOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModalItem) {
      onUpdateItem(editModalItem);
      setEditModalItem(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Week', 'Day', 'Jam Ke', 'Line', 'Spo', 'Size', 'Output', 'Tanggal'];
    const rows = filteredItems.map((i) => [
      i.week,
      i.day || 1,
      i.jamKe,
      i.line,
      i.spo,
      i.size,
      i.output,
      i.date || '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CHK10_Data_Week${selectedWeek || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper when SPO changes in form to auto-pick first size
  const handleSpoChangeInForm = (spoVal: string, isEdit: boolean) => {
    const match = spoOptions.find((s) => s.spo === spoVal);
    const defaultSize = match?.sizes[0] || 'S-PR';

    if (isEdit && editModalItem) {
      setEditModalItem({ ...editModalItem, spo: spoVal, size: defaultSize });
    } else {
      setNewSpo(spoVal);
      setNewSize(defaultSize);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden my-6">
      {/* Header Bar */}
      <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-tight">Sheet CHK10 (Data Mentah CHK)</h2>
              <span className="text-[10px] bg-purple-500/30 text-purple-200 font-mono px-2 py-0.5 rounded-full border border-purple-400/30">
                Hourly Output Logs
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Catatan output per jam/jam-ke & week dari tim Quality Inspection (CHK10)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefreshChkSheet && (
            <button
              onClick={onRefreshChkSheet}
              disabled={isRefreshingChkSheet}
              id="btn-sync-chk-gsheet"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition"
              title="Sync data langsung dari Google Sheets (CHK10)"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingChkSheet ? 'animate-spin' : ''}`} />
              <span>{isRefreshingChkSheet ? 'Syncing...' : 'Sync dari Google Sheets'}</span>
            </button>
          )}

          {onImportBulkChkItems && (
            <button
              onClick={() => setIsPasteModalOpen(true)}
              id="btn-paste-chk-entry"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              <Clipboard className="w-4 h-4" />
              <span>+ Paste Manual</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            id="btn-add-chk-entry"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Manual Input</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition border border-white/10"
            title="Download CSV"
          >
            <Download className="w-4 h-4 text-purple-300" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Stats Bar */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Filter */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <Filter className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="text-slate-500 font-medium">Week:</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Week</option>
              {availableWeeks.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          {/* Day Filter */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <span className="text-slate-500 font-medium">Day:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Day</option>
              {availableDays.map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          </div>

          {/* Line Filter */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <span className="text-slate-500 font-medium">Line:</span>
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Line</option>
              {linesList.map((l) => (
                <option key={l} value={l}>
                  Line {l}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="">Semua Tanggal</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari SPO / Size / Line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 shadow-sm"
            />
          </div>
        </div>

        {/* Quick Summary Pill & GSheet Sync Status */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {lastSyncTime && (
            <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Synced GSheets {lastSyncTime}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs bg-purple-50 text-purple-900 px-3.5 py-1.5 rounded-xl border border-purple-200 font-semibold">
            <span>Total Baris: <strong className="font-mono text-purple-700">{filteredItems.length}</strong></span>
            <span className="text-purple-300">|</span>
            <span>Total Output CHK: <strong className="font-mono text-emerald-700 text-sm">{totalOutput.toLocaleString()}</strong> pcs</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 text-slate-600 font-mono border-b border-slate-200 uppercase tracking-wider text-[11px] font-bold">
              <th className="p-3 border-r border-slate-200 text-center bg-purple-50/50 text-purple-900 min-w-[70px]">
                WEEK
              </th>
              <th className="p-3 border-r border-slate-200 text-center bg-purple-50/30 text-purple-900 min-w-[65px]">
                DAY
              </th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[70px]">JAM KE</th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[80px]">LINE</th>
              <th className="p-3 border-r border-slate-200 min-w-[120px]">SPO</th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[90px]">SIZE</th>
              <th className="p-3 border-r border-slate-200 text-right bg-emerald-50/40 text-emerald-800 min-w-[100px]">
                OUTPUT
              </th>
              <th className="p-3 border-r border-slate-200 text-center min-w-[100px]">TANGGAL</th>
              <th className="p-3 text-center min-w-[80px]">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono text-slate-700">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                  Belum ada data CHK10 yang sesuai kriteria filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`hover:bg-purple-50/20 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                  }`}
                >
                  <td className="p-2.5 border-r border-slate-200 text-center font-bold text-purple-700 bg-purple-50/20">
                    {item.week}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center font-bold text-purple-800 bg-purple-50/10">
                    {item.day || 1}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center font-semibold text-slate-800">
                    {item.jamKe}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-900">
                    {item.line}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-blue-700 font-bold">
                    {item.spo}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center font-bold text-slate-800">
                    {item.size}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-right font-black text-emerald-700 bg-emerald-50/30">
                    {item.output.toLocaleString()}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 text-center text-slate-500 text-[11px]">
                    {item.date || '-'}
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditModalItem({ ...item })}
                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition"
                        title="Edit Record"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Hapus Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleUp">
            <div className="bg-purple-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-300" />
                <h3 className="text-sm font-bold">Input Record Baru CHK10</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-purple-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Week
                  </label>
                  <input
                    type="number"
                    required
                    value={newWeek || ''}
                    onChange={(e) => setNewWeek(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Day
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newDay || ''}
                    onChange={(e) => setNewDay(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Jam Ke
                  </label>
                  <input
                    type="number"
                    required
                    value={newJamKe || ''}
                    onChange={(e) => setNewJamKe(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Line
                  </label>
                  <select
                    value={newLine}
                    onChange={(e) => setNewLine(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {linesList.map((l) => (
                      <option key={l} value={l}>
                        Line {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    SPO
                  </label>
                  <select
                    value={newSpo}
                    onChange={(e) => handleSpoChangeInForm(e.target.value, false)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
                  >
                    {spoOptions.map((s) => (
                      <option key={s.spo} value={s.spo}>
                        {s.spo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Size
                  </label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {(
                      spoOptions.find((s) => s.spo === newSpo)?.sizes || [
                        'S-PR',
                        'M-PR',
                        'L-PR',
                        'XL-PR',
                        '2XL-PR',
                      ]
                    ).map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Output CHK (pcs)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newOutput || ''}
                  onChange={(e) => setNewOutput(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-xl text-base font-mono font-bold text-emerald-800 text-center"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow transition"
                >
                  Simpan Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleUp">
            <div className="bg-purple-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-300" />
                <h3 className="text-sm font-bold">Edit Record CHK10</h3>
              </div>
              <button
                onClick={() => setEditModalItem(null)}
                className="text-purple-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Week
                  </label>
                  <input
                    type="number"
                    required
                    value={editModalItem.week || ''}
                    onChange={(e) =>
                      setEditModalItem({ ...editModalItem, week: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Day
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editModalItem.day || ''}
                    onChange={(e) =>
                      setEditModalItem({ ...editModalItem, day: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Jam Ke
                  </label>
                  <input
                    type="number"
                    required
                    value={editModalItem.jamKe || ''}
                    onChange={(e) =>
                      setEditModalItem({ ...editModalItem, jamKe: e.target.value === '' ? 0 : Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Line
                  </label>
                  <select
                    value={editModalItem.line}
                    onChange={(e) => setEditModalItem({ ...editModalItem, line: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {linesList.map((l) => (
                      <option key={l} value={l}>
                        Line {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    value={editModalItem.date || ''}
                    onChange={(e) =>
                      setEditModalItem({ ...editModalItem, date: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    SPO
                  </label>
                  <select
                    value={editModalItem.spo}
                    onChange={(e) => handleSpoChangeInForm(e.target.value, true)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
                  >
                    {spoOptions.map((s) => (
                      <option key={s.spo} value={s.spo}>
                        {s.spo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Size
                  </label>
                  <select
                    value={editModalItem.size}
                    onChange={(e) =>
                      setEditModalItem({ ...editModalItem, size: e.target.value })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  >
                    {(
                      spoOptions.find((s) => s.spo === editModalItem.spo)?.sizes || [
                        'S-PR',
                        'M-PR',
                        'L-PR',
                        'XL-PR',
                        '2XL-PR',
                      ]
                    ).map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Output CHK (pcs)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editModalItem.output || ''}
                  onChange={(e) =>
                    setEditModalItem({ ...editModalItem, output: e.target.value === '' ? 0 : Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-xl text-base font-mono font-bold text-emerald-800 text-center"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Paste Modal */}
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
