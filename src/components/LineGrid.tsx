import React, { useState } from 'react';
import { ProductionLine, BuildingId, WipItem } from '../types';
import { Building2, Search, UserCheck, Clock } from 'lucide-react';

interface LineGridProps {
  lines: ProductionLine[];
  wipItems?: WipItem[];
  onSelectLine: (lineId: string) => void;
}

const BUILDINGS_CONFIG: {
  id: BuildingId;
  name: string;
  color: string;
  badgeClass: string;
}[] = [
  { id: 'A', name: 'BUILDING A', color: 'text-blue-600', badgeClass: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'B', name: 'BUILDING B', color: 'text-indigo-600', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'C', name: 'BUILDING C', color: 'text-purple-600', badgeClass: 'bg-purple-50 text-purple-700 border-purple-100' },
  { id: 'D', name: 'BUILDING D', color: 'text-teal-600', badgeClass: 'bg-teal-50 text-teal-700 border-teal-100' },
];

export const LineGrid: React.FC<LineGridProps> = ({ lines, wipItems = [], onSelectLine }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<'ALL' | BuildingId>('ALL');

  // Pre-group wipItems by lineId once in O(N) instead of O(50 * N) on every render
  const wipByLineMap = React.useMemo(() => {
    const map = new Map<string, { lineWips: WipItem[]; contributors: string[]; latestWip?: WipItem }>();
    (wipItems || []).forEach((w) => {
      const lineKey = w.lineId ? w.lineId.trim().toUpperCase() : '';
      if (!lineKey) return;
      let entry = map.get(lineKey);
      if (!entry) {
        entry = { lineWips: [], contributors: [] };
        map.set(lineKey, entry);
      }
      entry.lineWips.push(w);
      const c = w.updatedBy || w.leaderNik || '';
      if (c && c.trim() && !entry.contributors.includes(c)) {
        entry.contributors.push(c);
      }
      if (
        !entry.latestWip ||
        new Date(w.updatedAt || w.createdAt || 0).getTime() >
          new Date(entry.latestWip.updatedAt || entry.latestWip.createdAt || 0).getTime()
      ) {
        entry.latestWip = w;
      }
    });
    return map;
  }, [wipItems]);

  const filteredLines = lines.filter((line) => {
    const matchesSearch =
      line.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBuilding =
      selectedBuildingFilter === 'ALL' || line.building === selectedBuildingFilter;
    return matchesSearch && matchesBuilding;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 card-shadow">
        {/* Building Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setSelectedBuildingFilter('ALL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
              selectedBuildingFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            Semua Gedung ({lines.length})
          </button>
          {BUILDINGS_CONFIG.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBuildingFilter(b.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                selectedBuildingFilter === b.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Gedung {b.id} ({lines.filter((l) => l.building === b.id).length})
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari Line (misal: A01, C05, D12)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>
      </div>

      {/* BUILDING SECTIONS */}
      {BUILDINGS_CONFIG.map((buildingCfg) => {
        if (selectedBuildingFilter !== 'ALL' && selectedBuildingFilter !== buildingCfg.id) {
          return null;
        }

        const bLines = filteredLines.filter((l) => l.building === buildingCfg.id);

        return (
          <section key={buildingCfg.id} className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
              <Building2 className={`w-5 h-5 ${buildingCfg.color}`} />
              <h2 className="text-lg font-bold text-slate-800 tracking-wide">
                {buildingCfg.name}
              </h2>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${buildingCfg.badgeClass}`}>
                {bLines.length} Lines
              </span>
            </div>

            {bLines.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 card-shadow">
                Tidak ada Line ditemukan di {buildingCfg.name}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {bLines.map((line) => {
                  const lineData = wipByLineMap.get(line.id.trim().toUpperCase());
                  const lineWips = lineData?.lineWips || [];
                  const contributors = lineData?.contributors || [];
                  const latestWip = lineData?.latestWip;

                  const effectiveLeader =
                    latestWip?.updatedBy ||
                    latestWip?.leaderNik ||
                    line.currentLeaderNik ||
                    (contributors.length > 0 ? contributors[contributors.length - 1] : undefined);

                  const hasData = lineWips.length > 0;
                  const isActive = line.status === 'in_progress' || hasData || line.id === 'A01';

                  return (
                    <button
                      key={line.id}
                      onClick={() => onSelectLine(line.id)}
                      id={`line-card-${line.id}`}
                      className={`group relative flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all duration-200 cursor-pointer card-shadow ${
                        isActive
                          ? 'bg-gradient-to-b from-blue-50/50 to-white border-blue-500 shadow-lg shadow-blue-500/10 hover:border-blue-600'
                          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Highlighted active ring/accent */}
                      {isActive && (
                        <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                      )}

                      <span
                        className={`text-2xl font-black tracking-wider font-mono ${
                          isActive
                            ? 'text-blue-600 group-hover:text-blue-700'
                            : 'text-slate-800 group-hover:text-blue-600'
                        }`}
                      >
                        {line.id}
                      </span>

                      <span className="text-[11px] font-medium mt-0.5 text-slate-400 group-hover:text-slate-600 transition-colors">
                        {hasData ? `${lineWips.length} baris WIP` : 'Klik untuk Input'}
                      </span>

                      {effectiveLeader ? (
                        <div className="mt-2 w-full">
                          <span
                            className="inline-flex items-center justify-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold truncate max-w-full"
                            title={`Leader: ${effectiveLeader}${contributors.length > 1 ? ` (Pengisi: ${contributors.join(', ')})` : ''}`}
                          >
                            <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{effectiveLeader}</span>
                          </span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
