import React, { useState, useEffect } from 'react';
import { ProductionLine, WipItem, SpoOption, ChkItem } from './types';
import { INITIAL_LINES, INITIAL_SPO_OPTIONS, INITIAL_WIP_ITEMS, INITIAL_CHK_ITEMS } from './data/initialData';
import { fetchLiveSpoOptions } from './data/spoSheetService';
import { fetchLiveChk10Items } from './data/chkSheetService';
import { Header } from './components/Header';
import { LineGrid } from './components/LineGrid';
import { LoginLeaderModal } from './components/LoginLeaderModal';
import { LineWipDetail } from './components/LineWipDetail';
import { WipTable } from './components/WipTable';
import { Chk10Table } from './components/Chk10Table';
import { DataSourceModal } from './components/DataSourceModal';
import { LayoutDashboard, FileSpreadsheet } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'line_detail'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'lines_wip' | 'chk_sheet'>('lines_wip');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [leaderNik, setLeaderNik] = useState<string>('9370');

  // Modal States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState<boolean>(false);

  // Persistent Data Stores
  const [lines, setLines] = useState<ProductionLine[]>(() => {
    const saved = localStorage.getItem('wip_sewing_lines');
    if (!saved) return INITIAL_LINES;
    try {
      const parsed: ProductionLine[] = JSON.parse(saved);
      if (parsed.length < INITIAL_LINES.length) {
        const existingIds = new Set(parsed.map((l) => l.id));
        const missingLines = INITIAL_LINES.filter((l) => !existingIds.has(l.id));
        return [...parsed, ...missingLines];
      }
      return parsed;
    } catch {
      return INITIAL_LINES;
    }
  });

  const [spoOptions, setSpoOptions] = useState<SpoOption[]>(() => {
    const saved = localStorage.getItem('wip_sewing_spos');
    return saved ? JSON.parse(saved) : INITIAL_SPO_OPTIONS;
  });

  const [isRefreshingSpoSheet, setIsRefreshingSpoSheet] = useState(false);
  const [isRefreshingChkSheet, setIsRefreshingChkSheet] = useState(false);
  const [lastChkSyncTime, setLastChkSyncTime] = useState<string>('');

  const [wipItems, setWipItems] = useState<WipItem[]>(() => {
    const saved = localStorage.getItem('wip_sewing_items');
    return saved ? JSON.parse(saved) : INITIAL_WIP_ITEMS;
  });

  const [chkItems, setChkItems] = useState<ChkItem[]>(() => {
    const saved = localStorage.getItem('wip_sewing_chk_items');
    if (!saved) return INITIAL_CHK_ITEMS;
    try {
      const parsed: ChkItem[] = JSON.parse(saved);
      const existingIds = new Set(parsed.map((item) => item.id));
      const missingInitials = INITIAL_CHK_ITEMS.filter((item) => !existingIds.has(item.id));
      if (missingInitials.length > 0) {
        return [...parsed, ...missingInitials];
      }
      return parsed;
    } catch {
      return INITIAL_CHK_ITEMS;
    }
  });

  // Fetch live SPO options & CHK10 records from Google Sheets on mount
  useEffect(() => {
    loadSpoSheetData();
    loadChkSheetData();
  }, []);

  const loadSpoSheetData = async () => {
    setIsRefreshingSpoSheet(true);
    const liveSpos = await fetchLiveSpoOptions();
    if (liveSpos.length > 0) {
      setSpoOptions(liveSpos);
    }
    setIsRefreshingSpoSheet(false);
  };

  const loadChkSheetData = async () => {
    setIsRefreshingChkSheet(true);
    try {
      const liveChk = await fetchLiveChk10Items();
      if (liveChk.length > 0) {
        setChkItems(liveChk);
        setLastChkSyncTime(
          new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.warn('Failed to load live CHK10 sheet:', err);
    } finally {
      setIsRefreshingChkSheet(false);
    }
  };

  // Save to localStorage on state update
  useEffect(() => {
    localStorage.setItem('wip_sewing_lines', JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    localStorage.setItem('wip_sewing_spos', JSON.stringify(spoOptions));
  }, [spoOptions]);

  useEffect(() => {
    localStorage.setItem('wip_sewing_items', JSON.stringify(wipItems));
  }, [wipItems]);

  useEffect(() => {
    localStorage.setItem('wip_sewing_chk_items', JSON.stringify(chkItems));
  }, [chkItems]);

  // Handlers
  const handleSelectLineClick = (lineId: string) => {
    setSelectedLineId(lineId);
    setIsLoginModalOpen(true);
  };

  const handleLoginSubmit = (nik: string, userName?: string) => {
    const displayName = userName ? `${nik} (${userName})` : nik;
    setLeaderNik(displayName);
    setIsLoginModalOpen(false);

    // Update Line leader and status
    if (selectedLineId) {
      setLines((prev) =>
        prev.map((l) =>
          l.id === selectedLineId
            ? {
                ...l,
                status: 'in_progress',
                currentLeaderNik: displayName,
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }
            : l
        )
      );
    }

    setCurrentView('line_detail');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  const handleSaveWipItem = (newItemData: Omit<WipItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem: WipItem = {
      ...newItemData,
      id: `wip-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWipItems((prev) => [newItem, ...prev]);
  };

  const handleAddNewSpoOption = (newSpo: SpoOption) => {
    setSpoOptions((prev) => {
      if (prev.some((s) => s.spo === newSpo.spo)) return prev;
      return [newSpo, ...prev];
    });
  };

  const handleDeleteWipItem = (id: string) => {
    setWipItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateWipItem = (updatedItem: WipItem) => {
    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        i.date || (i.createdAt ? i.createdAt.split('T')[0] : '');

      const targetDate = getItemDate(updatedItem);

      // Check if item exists by id or by (lineId + spo + size + date)
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === updatedItem.id ||
          (cleanLine(item.lineId) === cleanLine(updatedItem.lineId) &&
            cleanSpo(item.spo) === cleanSpo(updatedItem.spo) &&
            cleanSize(item.size) === cleanSize(updatedItem.size) &&
            getItemDate(item) === targetDate)
      );

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = updatedItem;
        return next;
      } else {
        return [updatedItem, ...prev];
      }
    });
  };

  const handleImportWipItems = (importedItems: WipItem[]) => {
    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        i.date || (i.createdAt ? i.createdAt.split('T')[0] : '');

      const next = [...prev];
      importedItems.forEach((newItem) => {
        const targetDate = getItemDate(newItem);
        const idx = next.findIndex(
          (item) =>
            item.id === newItem.id ||
            (cleanLine(item.lineId) === cleanLine(newItem.lineId) &&
              cleanSpo(item.spo) === cleanSpo(newItem.spo) &&
              cleanSize(item.size) === cleanSize(newItem.size) &&
              getItemDate(item) === targetDate)
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...newItem };
        } else {
          next.unshift(newItem);
        }
      });
      return next;
    });
  };

  const handleAddChkItem = (newItemData: Omit<ChkItem, 'id' | 'createdAt'>) => {
    const newItem: ChkItem = {
      ...newItemData,
      id: `chk-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setChkItems((prev) => [newItem, ...prev]);
  };

  const handleUpdateChkItem = (updatedItem: ChkItem) => {
    setChkItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  const handleDeleteChkItem = (id: string) => {
    setChkItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSyncWipOutput = (spo: string, size: string, newOutSewing: number) => {
    setWipItems((prev) =>
      prev.map((item) =>
        item.spo.trim().toLowerCase() === spo.trim().toLowerCase() &&
        item.size.trim().toLowerCase() === size.trim().toLowerCase()
          ? { ...item, outSewing: newOutSewing, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleResetData = () => {
    if (window.confirm('Reset semua data ke posisi default pabrik?')) {
      setLines(INITIAL_LINES);
      setSpoOptions(INITIAL_SPO_OPTIONS);
      setWipItems(INITIAL_WIP_ITEMS);
      setChkItems(INITIAL_CHK_ITEMS);
      localStorage.removeItem('wip_sewing_lines');
      localStorage.removeItem('wip_sewing_spos');
      localStorage.removeItem('wip_sewing_items');
      localStorage.removeItem('wip_sewing_chk_items');
    }
  };

  const handleImportBulkChkItems = (newItems: ChkItem[], append: boolean = false) => {
    if (append) {
      setChkItems((prev) => [...newItems, ...prev]);
    } else {
      setChkItems(newItems);
    }
  };

  const handleImportDataSource = (data: {
    lines?: ProductionLine[];
    wipItems?: WipItem[];
    spoOptions?: SpoOption[];
    chkItems?: ChkItem[];
  }) => {
    if (data.lines && Array.isArray(data.lines)) setLines(data.lines);
    if (data.spoOptions && Array.isArray(data.spoOptions)) setSpoOptions(data.spoOptions);
    if (data.wipItems && Array.isArray(data.wipItems)) setWipItems(data.wipItems);
    if (data.chkItems && Array.isArray(data.chkItems)) setChkItems(data.chkItems);
  };

  const activeLinesCount = lines.filter(
    (l) => l.status === 'in_progress' || l.status === 'active'
  ).length;

  const linesList = lines.map((l) => l.id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentView={currentView}
        selectedLineId={selectedLineId || undefined}
        leaderNik={leaderNik}
        onOpenDataSource={() => setIsDataSourceModalOpen(true)}
        onResetData={handleResetData}
        totalLines={lines.length}
        activeLinesCount={activeLinesCount}
      />

      {/* Main View Area */}
      <main className="flex-1 py-6 px-4 max-w-7xl mx-auto w-full">
        {currentView === 'dashboard' ? (
          <>
            {/* Navigation Tabs on Dashboard */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6 flex-wrap gap-3">
              <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-xl text-xs font-bold text-slate-700">
                <button
                  onClick={() => setDashboardTab('lines_wip')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'lines_wip'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Line Grid & WIP Table</span>
                </button>

                <button
                  onClick={() => setDashboardTab('chk_sheet')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'chk_sheet'
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Sheet CHK10 Data ({chkItems.length})</span>
                </button>
              </div>
            </div>

            {/* Render selected Tab content */}
            {dashboardTab === 'lines_wip' && (
              <>
                <LineGrid lines={lines} onSelectLine={handleSelectLineClick} />
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <WipTable
                    items={wipItems}
                    chkItems={chkItems}
                    onDeleteItem={handleDeleteWipItem}
                    onUpdateItem={handleUpdateWipItem}
                    onImportItems={handleImportWipItems}
                  />
                </div>
              </>
            )}

            {dashboardTab === 'chk_sheet' && (
              <Chk10Table
                items={chkItems}
                spoOptions={spoOptions}
                linesList={linesList}
                onAddItem={handleAddChkItem}
                onUpdateItem={handleUpdateChkItem}
                onDeleteItem={handleDeleteChkItem}
                onImportBulkChkItems={handleImportBulkChkItems}
                onRefreshChkSheet={loadChkSheetData}
                isRefreshingChkSheet={isRefreshingChkSheet}
                lastSyncTime={lastChkSyncTime}
              />
            )}
          </>
        ) : (
          <>
            {selectedLineId && (
              <LineWipDetail
                lineId={selectedLineId}
                leaderNik={leaderNik}
                spoOptions={spoOptions}
                wipItems={wipItems}
                onBackToDashboard={handleBackToDashboard}
                onSaveWip={handleSaveWipItem}
                onAddNewSpoOption={handleAddNewSpoOption}
                onRefreshSpoSheet={loadSpoSheetData}
                isRefreshingSpoSheet={isRefreshingSpoSheet}
              />
            )}

            {/* Line Specific WIP Table */}
            <div className="mt-8 border-t border-slate-200 pt-6">
              <WipTable
                items={
                  selectedLineId
                    ? wipItems.filter((i) => i.lineId === selectedLineId)
                    : wipItems
                }
                chkItems={
                  selectedLineId
                    ? chkItems.filter((c) => c.line === selectedLineId)
                    : chkItems
                }
                onDeleteItem={handleDeleteWipItem}
                onUpdateItem={handleUpdateWipItem}
                onImportItems={handleImportWipItems}
              />
            </div>
          </>
        )}
      </main>

      {/* Login Leader Modal */}
      <LoginLeaderModal
        isOpen={isLoginModalOpen}
        lineId={selectedLineId}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLoginSubmit}
      />

      {/* Data Source Configuration Modal */}
      <DataSourceModal
        isOpen={isDataSourceModalOpen}
        onClose={() => setIsDataSourceModalOpen(false)}
        lines={lines}
        wipItems={wipItems}
        spoOptions={spoOptions}
        chkItems={chkItems}
        onImportData={handleImportDataSource}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
        WIP Sewing System &bull; Production Leader Portal &bull; Syncora Factory OS
      </footer>
    </div>
  );
}
