import React from 'react';
import { Search, RotateCcw, Flame, ArrowUpDown } from 'lucide-react';
import { FilterState, TimeHorizon, SortOption } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  departamentos: string[];
  malls: { id: string; nombre: string; nombreCorto: string }[];
  onReset: () => void;
  onResetToNational: () => void;
  resultCount: number;
  totalCount: number;
  onOpenHistoricalAudit?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  departamentos,
  malls,
  onReset,
  onResetToNational,
  resultCount,
  totalCount,
  onOpenHistoricalAudit
}) => {
  // Sort malls: Priority sedes first (Piura, Chiclayo, Pucallpa, Villa María), then alphabetical
  const priorityIds = ['rp-piura', 'rp-chiclayo', 'rp-pucallpa', 'rp-villa-maria'];
  const priorityMalls = priorityIds
    .map((id) => malls.find((m) => m.id === id))
    .filter(Boolean) as { id: string; nombre: string; nombreCorto: string }[];

  const remainingMalls = malls
    .filter((m) => !priorityIds.includes(m.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const sortedMallOptions = [...priorityMalls, ...remainingMalls];

  return (
    <div className="bg-white rounded-xl p-4 border border-neutral-200 shadow-xs space-y-3.5">
      
      {/* Top Filter Row: Search + Primary Mall Selector + Department + Risk + Sort */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        
        <div className="flex items-center gap-2.5 flex-wrap flex-1">
          
          {/* Quick Search */}
          <div className="relative min-w-[210px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar mall o ciudad..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full pl-10 pr-3.5 py-2 text-sm bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-300 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7300E1] transition-colors"
            />
          </div>

          {/* MALL Primary Selector (Requirement 3) */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <span className="text-xs font-black text-[#7300E1] uppercase tracking-wider">
              MALL:
            </span>
            <select
              value={filters.mallId}
              onChange={(e) => {
                const val = e.target.value;
                onFilterChange({ mallId: val });
              }}
              className="px-2 py-0.5 text-sm bg-transparent text-neutral-900 font-bold focus:outline-none cursor-pointer max-w-[220px]"
            >
              <option value="all">Todos los malls ({totalCount})</option>
              {sortedMallOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* DEPARTAMENTO Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline">
              DEPT:
            </span>
            <select
              value={filters.departamento}
              onChange={(e) => onFilterChange({ departamento: e.target.value })}
              className="px-1.5 py-0.5 text-sm bg-transparent text-neutral-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Departamento: Todos</option>
              {departamentos.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>

          {/* RIESGO Selector */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline">
              RIESGO:
            </span>
            <select
              value={filters.riesgo}
              onChange={(e) => onFilterChange({ riesgo: e.target.value })}
              className="px-1.5 py-0.5 text-sm bg-transparent text-neutral-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">Todos los niveles</option>
              <option value="ALERTA">🔴 Alerta Crítica</option>
              <option value="PREVENTIVO">🟠 Preventivo</option>
              <option value="VIGILANCIA">🔵 Vigilancia</option>
              <option value="NORMAL">🟢 Normal</option>
            </select>
          </div>

          {/* ORDENAR Selector (Requirement 7) */}
          <div className="flex items-center gap-1.5 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-300">
            <ArrowUpDown className="w-4 h-4 text-[#7300E1]" />
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider hidden sm:inline">
              ORDEN:
            </span>
            <select
              value={filters.ordenarPor}
              onChange={(e) => onFilterChange({ ordenarPor: e.target.value as SortOption })}
              className="px-1.5 py-0.5 text-sm bg-transparent text-neutral-800 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="riesgo">Mayor riesgo</option>
              <option value="probabilidad">Mayor probabilidad</option>
              <option value="lluvia24h">Mayor lluvia 24 h</option>
              <option value="lluvia7d">Mayor lluvia 7 días</option>
              <option value="nombre">Nombre A-Z</option>
            </select>
          </div>

        </div>

        {/* Action Button: Ver todos los malls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onResetToNational}
            className={`px-3.5 py-2 text-sm font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
              filters.mallId === 'all'
                ? 'bg-purple-50 text-[#7300E1] border-purple-300'
                : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300'
            }`}
            title="Restablecer selección al monitoreo nacional"
          >
            <span>🇵🇪</span>
            <span>Ver todos los malls</span>
          </button>
        </div>

      </div>

      {/* Bottom Filter Row: Time Horizon Tabs + Quick Badges + Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2.5 border-t border-neutral-100">
        
        {/* HORIZONTE Selector */}
        <div className="flex items-center gap-1 bg-neutral-100 p-1.5 rounded-lg border border-neutral-200 self-start sm:self-auto">
          <span className="text-xs font-bold text-neutral-600 uppercase px-2">
            HORIZONTE:
          </span>
          {(['actual', '24h', '48h', '3d', '7d'] as TimeHorizon[]).map((hz) => (
            <button
              key={hz}
              onClick={() => onFilterChange({ horizonte: hz })}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-all cursor-pointer ${
                filters.horizonte === hz
                  ? 'bg-[#7300E1] text-white shadow-xs'
                  : 'text-neutral-700 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
            >
              {hz === 'actual' ? 'Actual' : hz}
            </button>
          ))}
        </div>

        {/* Right Toggle Badges */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          
          {/* Con Aviso SENAMHI Toggle */}
          <button
            onClick={() => onFilterChange({ conAvisoSenamhi: !filters.conAvisoSenamhi })}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              filters.conAvisoSenamhi
                ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold ring-1 ring-amber-400'
                : 'bg-white border-neutral-300 text-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>⚠️</span>
            <span>Aviso SENAMHI</span>
          </button>

          {/* Probabilidad > 80% Toggle */}
          <button
            onClick={() => onFilterChange({ probabilidadMayor80: !filters.probabilidadMayor80 })}
            className={`px-3.5 py-1.5 text-sm font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              filters.probabilidadMayor80
                ? 'bg-blue-50 border-[#4ABFFF] text-sky-900 font-bold ring-1 ring-[#4ABFFF]'
                : 'bg-white border-neutral-300 text-neutral-700 hover:border-neutral-400'
            }`}
          >
            <span>🌧</span>
            <span>Probabilidad &gt;80%</span>
          </button>

          {/* Solo Críticos Toggle */}
          <button
            onClick={() => onFilterChange({ soloCriticos: !filters.soloCriticos })}
            className={`px-3.5 py-1.5 text-sm font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              filters.soloCriticos
                ? 'bg-[#FFC740] border-[#d8a11b] text-neutral-950 ring-2 ring-[#FFC740]/40'
                : 'bg-white border-neutral-300 text-neutral-700 hover:border-neutral-400'
            }`}
          >
            <Flame className={`w-4 h-4 ${filters.soloCriticos ? 'text-red-700' : 'text-neutral-500'}`} />
            <span>Solo Críticos</span>
          </button>

          {/* Shortcut to Historical Audit */}
          {onOpenHistoricalAudit && (
            <button
              onClick={onOpenHistoricalAudit}
              className="px-3.5 py-1.5 text-sm font-bold rounded-lg border border-purple-300 bg-purple-50 text-[#7300E1] hover:bg-purple-100 transition-all cursor-pointer flex items-center gap-1.5"
              title="Auditar si llovió en días pasados (ej. 15 de octubre)"
            >
              <span>📅</span>
              <span>Auditar Días Pasados</span>
            </button>
          )}

          {/* Reset Filters */}
          <button
            onClick={onReset}
            className="p-2 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors cursor-pointer"
            title="Restablecer todos los filtros"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <span className="text-sm text-neutral-500 font-mono pl-1 hidden sm:inline">
            {resultCount}/{totalCount}
          </span>

        </div>

      </div>

    </div>
  );
};
