import React, { useState, useEffect, useRef } from 'react';
import { ProductionLine, WipItem, SpoOption, ChkItem, ScanDistribusiItem } from './types';
import { INITIAL_LINES, INITIAL_SPO_OPTIONS, INITIAL_WIP_ITEMS, INITIAL_CHK_ITEMS } from './data/initialData';
import { fetchLiveSpoOptions } from './data/spoSheetService';
import { fetchLiveChk10Items } from './data/chkSheetService';
import { fetchLiveScanDistribusiItems } from './data/scanDistribusiSheetService';
import {
  pushWebAppWipData,
  fetchWebAppWipData,
  fetchLiveWipSheetCsv,
  getEffectiveWebAppUrl,
  mergeDuplicateWipItems,
  clearSpreadsheetWipData,
} from './lib/googleSheetsService';
import { safeGetItem, safeSetItem, safeRemoveItem } from './utils/storage';
import { normalizeDateStr, getTodayDateStr } from './utils/date';
import { Header } from './components/Header';
import { LineGrid } from './components/LineGrid';
import { LoginLeaderModal } from './components/LoginLeaderModal';
import { LineWipDetail } from './components/LineWipDetail';
import { WipTable } from './components/WipTable';
import { Chk10Table } from './components/Chk10Table';
import { OutputReconciliation } from './components/OutputReconciliation';
import { ScanDistribusiComparison } from './components/ScanDistribusiComparison';
import { DataSourceModal } from './components/DataSourceModal';
import { GoogleSheetsExportModal } from './components/GoogleSheetsExportModal';
import { LayoutDashboard, FileSpreadsheet, ArrowRightLeft, Calendar, Check } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'dashboard' | 'line_detail'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'lines_wip' | 'chk_sheet' | 'scan_comparison'>('lines_wip');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [leaderNik, setLeaderNik] = useState<string>('9370');

  // Single Master Report Date State for the entire App
  const [globalReportDate, setGlobalReportDate] = useState<string>(
    () => getTodayDateStr()
  );

  // Modal States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState<boolean>(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);

  // Persistent Data Stores
  const [lines, setLines] = useState<ProductionLine[]>(() => {
    const saved = safeGetItem('wip_sewing_lines');
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
    const saved = safeGetItem('wip_sewing_spos');
    if (!saved) return INITIAL_SPO_OPTIONS;
    try {
      return JSON.parse(saved);
    } catch {
      return INITIAL_SPO_OPTIONS;
    }
  });

  const [isRefreshingSpoSheet, setIsRefreshingSpoSheet] = useState(false);
  const [isRefreshingChkSheet, setIsRefreshingChkSheet] = useState(false);
  const [lastChkSyncTime, setLastChkSyncTime] = useState<string>('');

  const [wipItems, setWipItems] = useState<WipItem[]>(() => {
    const saved = safeGetItem('wip_sewing_items');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const userHasMutatedWipRef = useRef<boolean>(false);

  const [chkItems, setChkItems] = useState<ChkItem[]>(() => {
    const saved = safeGetItem('wip_sewing_chk_items');
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

  const [scanItems, setScanItems] = useState<ScanDistribusiItem[]>(() => {
    const saved = safeGetItem('wip_sheet_scan_distribusi_cache');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  });

  const [isRefreshingScan, setIsRefreshingScan] = useState<boolean>(false);

  // Fetch live SPO options, CHK10 records, and Scan Distribusi records from Google Sheets on mount
  useEffect(() => {
    loadSpoSheetData();
    loadChkSheetData();
    loadScanDistribusiData();
    loadInitialWipData();
  }, []);

  const loadInitialWipData = async () => {
    const webAppUrl = getEffectiveWebAppUrl();
    try {
      if (webAppUrl) {
        const remoteWip = await fetchWebAppWipData(webAppUrl);
        if (remoteWip && Array.isArray(remoteWip) && remoteWip.length > 0) {
          handleImportWipItems(remoteWip, false);
          safeSetItem('google_sheets_imported', 'true');
          return;
        }
      }
      const csvWip = await fetchLiveWipSheetCsv();
      if (csvWip && csvWip.length > 0) {
        handleImportWipItems(csvWip, false);
        safeSetItem('google_sheets_imported', 'true');
      }
    } catch (err) {
      console.warn('Background WIP sheet initial sync notice:', err);
    }
  };

  const loadSpoSheetData = async () => {
    setIsRefreshingSpoSheet(true);
    try {
      const liveSpos = await fetchLiveSpoOptions();
      if (liveSpos.length > 0) {
        setSpoOptions(liveSpos);
      }
    } catch (err) {
      console.warn('Failed to load live SPO sheet:', err);
    } finally {
      setIsRefreshingSpoSheet(false);
    }
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

  const loadScanDistribusiData = async () => {
    setIsRefreshingScan(true);
    try {
      const liveScan = await fetchLiveScanDistribusiItems();
      if (liveScan.length > 0) {
        setScanItems(liveScan);
      }
    } catch (err) {
      console.warn('Failed to load live Scan Distribusi sheet:', err);
    } finally {
      setIsRefreshingScan(false);
    }
  };

  // Save to localStorage on state update
  useEffect(() => {
    safeSetItem('wip_sewing_lines', JSON.stringify(lines));
  }, [lines]);

  useEffect(() => {
    safeSetItem('wip_sewing_spos', JSON.stringify(spoOptions));
  }, [spoOptions]);

  useEffect(() => {
    safeSetItem('wip_sewing_items', JSON.stringify(wipItems));
  }, [wipItems]);

  useEffect(() => {
    safeSetItem('wip_sewing_chk_items', JSON.stringify(chkItems));
  }, [chkItems]);

  // Auto-sync background push to Google Sheets Web App whenever WIP is modified by user
  useEffect(() => {
    const webAppUrl = getEffectiveWebAppUrl();
    const autoSync = safeGetItem('google_sheets_autosync');
    if (!webAppUrl || autoSync === 'false' || !userHasMutatedWipRef.current) return;

    setSyncStatus('syncing');
    const timer = setTimeout(async () => {
      try {
        await pushWebAppWipData(webAppUrl, { wipItems, spoOptions, chkItems });
        setSyncStatus('synced');
        userHasMutatedWipRef.current = false;
        setTimeout(() => {
          setSyncStatus((curr) => (curr === 'synced' ? 'idle' : curr));
        }, 3500);
      } catch (err) {
        console.warn('Auto push Google Sheets background notice:', err);
        setSyncStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [wipItems]);

  // Background Auto-Poll from Google Sheets Web App every 5 seconds to synchronize live data & line leaders between all active users
  useEffect(() => {
    const pollBackgroundData = async () => {
      if (userHasMutatedWipRef.current) return;
      const webAppUrl = getEffectiveWebAppUrl();
      if (!webAppUrl) return;
      try {
        const fetchedWip = await fetchWebAppWipData(webAppUrl);
        if (fetchedWip && fetchedWip.length > 0) {
          setWipItems((current) => {
            const merged = mergeDuplicateWipItems([...current, ...fetchedWip]);
            if (JSON.stringify(merged) !== JSON.stringify(current)) {
              return merged;
            }
            return current;
          });

          // Sync lines leader info based on fetchedWip data
          setLines((prevLines) => {
            let changed = false;
            const updated = prevLines.map((line) => {
              const lineWips = fetchedWip.filter(
                (w) => w.lineId?.trim().toUpperCase() === line.id.trim().toUpperCase()
              );
              if (lineWips.length > 0) {
                const latestWip = [...lineWips].sort(
                  (a, b) =>
                    new Date(b.updatedAt || b.createdAt || 0).getTime() -
                    new Date(a.updatedAt || a.createdAt || 0).getTime()
                )[0];
                const latestLeader =
                  latestWip.updatedBy || latestWip.leaderNik || latestWip.leaderName;
                if (latestLeader && line.currentLeaderNik !== latestLeader) {
                  changed = true;
                  return {
                    ...line,
                    currentLeaderNik: latestLeader,
                    lastUpdatedBy: latestLeader,
                    status: 'in_progress' as const,
                  };
                }
              }
              return line;
            });
            return changed ? updated : prevLines;
          });
        }
      } catch (err) {
        // Ignore background polling network glitches
      }
    };

    pollBackgroundData();
    const interval = setInterval(pollBackgroundData, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const handleSaveWipItem = (newItemData: Omit<WipItem, 'createdAt' | 'updatedAt'> & { id?: string }) => {
    handleUpdateWipItem(newItemData as WipItem);
  };

  const handleAddNewSpoOption = (newSpo: SpoOption) => {
    setSpoOptions((prev) => {
      if (prev.some((s) => s.spo === newSpo.spo)) return prev;
      return [newSpo, ...prev];
    });
  };

  const handleDeleteWipItem = (id: string, targetItem?: WipItem) => {
    userHasMutatedWipRef.current = true;
    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

      if (targetItem) {
        const targetLine = cleanLine(targetItem.lineId);
        const targetSpo = cleanSpo(targetItem.spo);
        const targetSize = cleanSize(targetItem.size);
        const targetDate = getItemDate(targetItem);

        // Filter out items that match id OR match (lineId + spo + size)
        return prev.filter((item) => {
          if (item.id === id || item.id === targetItem.id) return false;
          if (
            cleanLine(item.lineId) === targetLine &&
            cleanSpo(item.spo) === targetSpo &&
            cleanSize(item.size) === targetSize
          ) {
            if (!getItemDate(item) || getItemDate(item) === targetDate || id.startsWith('proj-')) {
              return false;
            }
          }
          return true;
        });
      }

      // Fallback: direct ID match or projected ID match
      if (prev.some((item) => item.id === id)) {
        return prev.filter((item) => item.id !== id);
      }

      return prev.filter((item) => {
        if (id.startsWith('proj-')) {
          const itemLine = cleanLine(item.lineId);
          const itemSpo = cleanSpo(item.spo);
          const itemSize = cleanSize(item.size);
          if (
            itemLine &&
            itemSpo &&
            itemSize &&
            id.toUpperCase().includes(itemLine) &&
            id.toLowerCase().includes(itemSpo) &&
            id.toLowerCase().includes(itemSize)
          ) {
            return false;
          }
        }
        return true;
      });
    });
  };

  const handleUpdateWipItem = (updatedItem: WipItem) => {
    userHasMutatedWipRef.current = true;
    const activeLeader = updatedItem.updatedBy || updatedItem.leaderNik || leaderNik || '';
    const nowIso = new Date().toISOString();

    setWipItems((prev) => {
      const cleanLine = (l?: string) => (l ? l.trim().toUpperCase() : '');
      const cleanSpo = (s?: string) => (s ? s.replace(/\s+/g, '').toLowerCase() : '');
      const cleanSize = (sz?: string) => (sz ? sz.replace(/\s+/g, '').toLowerCase() : '');
      const getItemDate = (i: WipItem) =>
        normalizeDateStr(i.date || (i.createdAt ? i.createdAt.split('T')[0] : ''));

      const targetDate = normalizeDateStr(updatedItem.date) || getItemDate(updatedItem) || getTodayDateStr();

      // Check if item exists by id or by (lineId + spo + size)
      const existingIndex = prev.findIndex(
        (item) =>
          (updatedItem.id && item.id === updatedItem.id) ||
          (cleanLine(item.lineId) === cleanLine(updatedItem.lineId) &&
            cleanSpo(item.spo) === cleanSpo(updatedItem.spo) &&
            cleanSize(item.size) === cleanSize(updatedItem.size) &&
            (getItemDate(item) === targetDate || !getItemDate(item) || !targetDate))
      );

      const existingId = existingIndex >= 0 ? prev[existingIndex].id : undefined;
      const finalId = updatedItem.id || existingId || `wip-${updatedItem.lineId}-${updatedItem.spo}-${updatedItem.size}-${Date.now()}`;

      const itemWithMeta: WipItem = {
        ...updatedItem,
        date: targetDate,
        id: finalId,
        updatedBy: activeLeader,
        leaderNik: activeLeader,
        leaderName: activeLeader,
        updatedAt: nowIso,
      };

      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = itemWithMeta;
        return next;
      } else {
        return [itemWithMeta, ...prev];
      }
    });

    if (updatedItem.lineId && activeLeader) {
      setLines((prev) =>
        prev.map((l) =>
          l.id.toUpperCase() === updatedItem.lineId.toUpperCase()
            ? {
                ...l,
                currentLeaderNik: activeLeader,
                lastUpdatedBy: activeLeader,
                status: 'in_progress',
                lastUpdated: new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              }
            : l
        )
      );
    }
  };

  const handleImportWipItems = (importedItems: WipItem[], replaceMode: boolean = false) => {
    if (replaceMode) {
      setWipItems(mergeDuplicateWipItems(importedItems));
      return;
    }
    setWipItems((prev) => mergeDuplicateWipItems([...prev, ...importedItems]));
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
    userHasMutatedWipRef.current = true;
    setWipItems((prev) =>
      prev.map((item) =>
        item.spo.trim().toLowerCase() === spo.trim().toLowerCase() &&
        item.size.trim().toLowerCase() === size.trim().toLowerCase()
          ? { ...item, outSewing: newOutSewing, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const handleClearAllWip = async () => {
    userHasMutatedWipRef.current = true;
    setWipItems([]);
    safeSetItem('wip_sewing_items', '[]');
    const webAppUrl = getEffectiveWebAppUrl();
    if (webAppUrl) {
      setSyncStatus('syncing');
      try {
        await clearSpreadsheetWipData(webAppUrl);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (e) {
        console.warn('Failed to clear remote spreadsheet:', e);
        setSyncStatus('error');
      }
    }
  };

  const handleResetData = () => {
    if (window.confirm('Reset semua data ke posisi default pabrik?')) {
      setLines(INITIAL_LINES);
      setSpoOptions(INITIAL_SPO_OPTIONS);
      setWipItems(INITIAL_WIP_ITEMS);
      setChkItems(INITIAL_CHK_ITEMS);
      safeRemoveItem('wip_sewing_lines');
      safeRemoveItem('wip_sewing_spos');
      safeRemoveItem('wip_sewing_items');
      safeRemoveItem('wip_sewing_chk_items');
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
        onOpenGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
        onResetData={handleResetData}
        totalLines={lines.length}
        activeLinesCount={activeLinesCount}
        syncStatus={syncStatus}
      />

      {/* Main View Area */}
      <main className="flex-1 py-6 px-4 max-w-7xl mx-auto w-full space-y-6">
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
                  <span>Rekonsiliasi CHK10 vs WIP (Semua Line)</span>
                </button>

                <button
                  onClick={() => setDashboardTab('scan_comparison')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                    dashboardTab === 'scan_comparison'
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Compare Scan In vs Scan Distribusi</span>
                </button>
              </div>
            </div>

            {/* Render selected Tab content */}
            {dashboardTab === 'lines_wip' && (
              <>
                <LineGrid lines={lines} wipItems={wipItems} onSelectLine={handleSelectLineClick} />
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <WipTable
                    items={wipItems}
                    chkItems={chkItems}
                    scanItems={scanItems}
                    globalReportDate={globalReportDate}
                    setGlobalReportDate={setGlobalReportDate}
                    onDeleteItem={handleDeleteWipItem}
                    onUpdateItem={handleUpdateWipItem}
                    onImportItems={handleImportWipItems}
                  />
                </div>
              </>
            )}

            {dashboardTab === 'chk_sheet' && (
              <OutputReconciliation
                wipItems={wipItems}
                chkItems={chkItems}
                onSyncWipOutput={handleSyncWipOutput}
                onImportBulkChkItems={handleImportBulkChkItems}
                onRefreshChkSheet={loadChkSheetData}
                isRefreshingChkSheet={isRefreshingChkSheet}
              />
            )}

            {dashboardTab === 'scan_comparison' && (
              <ScanDistribusiComparison
                wipItems={wipItems}
                scanItems={scanItems}
                onRefreshScan={loadScanDistribusiData}
                isRefreshingScan={isRefreshingScan}
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
                globalReportDate={globalReportDate}
                setGlobalReportDate={setGlobalReportDate}
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
                activeLineId={selectedLineId || undefined}
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
                globalReportDate={globalReportDate}
                setGlobalReportDate={setGlobalReportDate}
                onDeleteItem={handleDeleteWipItem}
                onUpdateItem={handleUpdateWipItem}
                onImportItems={handleImportWipItems}
                hideExportButtons={true}
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

      {/* Google Sheets Direct Export Modal */}
      <GoogleSheetsExportModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        wipItems={wipItems}
        chkItems={chkItems}
        spoOptions={spoOptions}
        lines={lines}
        onImportWipItems={handleImportWipItems}
        onClearAllWip={handleClearAllWip}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-medium">
        WIP Sewing System &bull; Production Leader Portal &bull; Syncora Factory OS
      </footer>
    </div>
  );
}
