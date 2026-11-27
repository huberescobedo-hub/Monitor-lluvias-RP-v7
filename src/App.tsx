import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { KpiBar } from './components/KpiBar';
import { FilterBar } from './components/FilterBar';
import { MapComponent } from './components/MapComponent';
import { LayerControls, LayerState } from './components/LayerControls';
import { MallDetailPanel } from './components/MallDetailPanel';
import { NationalSummaryPanel } from './components/NationalSummaryPanel';
import { Forecast7Days } from './components/Forecast7Days';
import { Chart48Hours } from './components/Chart48Hours';
import { DataTable } from './components/DataTable';
import { HistoryModal } from './components/HistoryModal';
import { OceanMonitorPanel } from './components/OceanMonitorPanel';
import { PrecipitationHistoryAudit } from './components/PrecipitationHistoryAudit';
import { fetchAllMallWeatherWithMeta } from './services/weatherService';
import { MallWeatherSummary, FilterState, RiskLevel } from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { DISCLAIMER_REAL_PLAZA } from './utils/riskEngine';

export default function App() {
  const [currentView, setCurrentView] = useState<'live' | 'history_audit'>('live');
  const [allSummaries, setAllSummaries] = useState<MallWeatherSummary[]>([]);
  // Requirement 2: Start in national view (null = all malls)
  const [selectedMallId, setSelectedMallId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [cooldownMinutesLeft, setCooldownMinutesLeft] = useState<number>(0);
  const hasLoadedOnceRef = useRef<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  // Modals
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isOceanOpen, setIsOceanOpen] = useState<boolean>(false);
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);

  // Map Layers state (Section 12)
  const [layers, setLayers] = useState<LayerState>({
    mallsRealPlaza: true,
    lluviaObservada24h: true,
    lluviaEsperada24h: true,
    lluviaEsperada3d: false,
    avisosSenamhi: true,
    emergenciasClimaticas: false,
    temperaturaMar: false,
    zonaNino12: false
  });

  // Filters state (Section 7)
  const [filters, setFilters] = useState<FilterState>({
    mallId: 'all',
    departamento: 'all',
    riesgo: 'all',
    horizonte: '24h',
    soloCriticos: false,
    conAvisoSenamhi: false,
    probabilidadMayor80: false,
    searchQuery: '',
    ordenarPor: 'riesgo'
  });

  // Load initial / refreshed weather data (respects 30-min server cooldown lock)
  const loadWeatherData = useCallback(async (forceRefresh = false) => {
    if (isFetchingRef.current) return;
    if (forceRefresh && hasLoadedOnceRef.current && nextRefreshAt && Date.now() < nextRefreshAt) {
      return;
    }

    isFetchingRef.current = true;
    if (hasLoadedOnceRef.current) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetchAllMallWeatherWithMeta(forceRefresh);
      const data = response.data;
      setAllSummaries(data);
      hasLoadedOnceRef.current = true;

      if (data.length > 0) {
        setLastUpdate(data[0].ultimaActualizacion || new Date().toLocaleTimeString());
      }

      // Derive next refresh timestamp relative to client clock to avoid server/client clock skew
      const remainingMs = Math.max(60_000, response.cooldownRemainingSeconds * 1000);
      const targetAt = Date.now() + remainingMs;
      setNextRefreshAt(targetAt);
      setCooldownMinutesLeft(Math.max(1, Math.ceil(remainingMs / 60_000)));
    } catch (err: any) {
      console.error('Error loading weather data:', err);
      setError('No se pudo establecer conexión con los servicios meteorológicos. Verifique la red.');
      // Retry cooldown 60s on failure so auto-refresh doesn't tight-loop
      setNextRefreshAt(Date.now() + 60_000);
      setCooldownMinutesLeft(1);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [nextRefreshAt]);

  useEffect(() => {
    loadWeatherData(false);
    // Only run once on mount; auto-refresh timer handles subsequent 30-min updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown ticker + automatic background refresh every 30 minutes
  useEffect(() => {
    if (!nextRefreshAt) return;

    const tick = () => {
      const diffMs = nextRefreshAt - Date.now();
      if (diffMs <= -2000) {
        setCooldownMinutesLeft(0);
        loadWeatherData(false);
      } else {
        setCooldownMinutesLeft(Math.max(0, Math.ceil(diffMs / 60_000)));
      }
    };

    const intervalId = window.setInterval(tick, 15_000);
    return () => window.clearInterval(intervalId);
  }, [nextRefreshAt, loadWeatherData]);

  // Extract unique departments for filter dropdown
  const departamentos = useMemo(() => {
    const set = new Set<string>();
    allSummaries.forEach((s) => set.add(s.mall.departamento));
    return Array.from(set).sort();
  }, [allSummaries]);

  // Handle Layer Toggle
  const handleToggleLayer = (layerName: keyof LayerState) => {
    setLayers((prev) => ({ ...prev, [layerName]: !prev[layerName] }));
  };

  // Select Mall handler
  const handleSelectMall = (mallId: string | null) => {
    setSelectedMallId(mallId);
    setFilters((prev) => ({ ...prev, mallId: mallId || 'all' }));
  };

  // Reset to National View (Requirement 2 & 4)
  const handleResetToNational = () => {
    setSelectedMallId(null);
    setFilters((prev) => ({ ...prev, mallId: 'all' }));
  };

  // Filter handlers
  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updates };
      // If mallId changed directly
      if (updates.mallId !== undefined) {
        setSelectedMallId(updates.mallId === 'all' ? null : updates.mallId);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      mallId: 'all',
      departamento: 'all',
      riesgo: 'all',
      horizonte: '24h',
      soloCriticos: false,
      conAvisoSenamhi: false,
      probabilidadMayor80: false,
      searchQuery: '',
      ordenarPor: 'riesgo'
    });
    setSelectedMallId(null);
  };

  // Filtered & Sorted Summaries
  const filteredSummaries = useMemo(() => {
    const filtered = allSummaries.filter((s) => {
      // 1. Solo Críticos filter (ALERTA or PREVENTIVO)
      if (filters.soloCriticos && s.riesgo !== 'ALERTA' && s.riesgo !== 'PREVENTIVO') {
        return false;
      }
      // 2. Single Mall filter (if mall filter is set and not 'all')
      if (filters.mallId !== 'all' && s.mall.id !== filters.mallId) {
        return false;
      }
      // 3. Departamento filter
      if (filters.departamento !== 'all' && s.mall.departamento !== filters.departamento) {
        return false;
      }
      // 4. Riesgo filter
      if (filters.riesgo !== 'all' && s.riesgo !== filters.riesgo) {
        return false;
      }
      // 5. Con Aviso SENAMHI
      if (filters.conAvisoSenamhi && !s.avisoSenamhi) {
        return false;
      }
      // 6. Probabilidad > 80%
      if (filters.probabilidadMayor80 && s.probabilidadMax24h < 80) {
        return false;
      }
      // 7. Search Query
      if (filters.searchQuery.trim() !== '') {
        const q = filters.searchQuery.toLowerCase();
        const matchName = s.mall.nombre.toLowerCase().includes(q);
        const matchCity = s.mall.ciudad.toLowerCase().includes(q);
        const matchDept = s.mall.departamento.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchDept) return false;
      }
      return true;
    });

    // Sort according to filters.ordenarPor (Requirement 7)
    const riskPriority: Record<RiskLevel, number> = {
      'ALERTA': 4,
      'PREVENTIVO': 3,
      'VIGILANCIA': 2,
      'NORMAL': 1
    };

    filtered.sort((a, b) => {
      if (filters.ordenarPor === 'probabilidad') {
        return b.probabilidadMax24h - a.probabilidadMax24h;
      }
      if (filters.ordenarPor === 'lluvia24h') {
        return b.lluvia24hMm - a.lluvia24hMm;
      }
      if (filters.ordenarPor === 'lluvia7d') {
        return b.lluvia7dMm - a.lluvia7dMm;
      }
      if (filters.ordenarPor === 'nombre') {
        return a.mall.nombre.localeCompare(b.mall.nombre);
      }
      // Default: Mayor riesgo
      const diff = (riskPriority[b.riesgo] || 0) - (riskPriority[a.riesgo] || 0);
      if (diff !== 0) return diff;
      return b.riesgoScore - a.riesgoScore;
    });

    return filtered;
  }, [allSummaries, filters]);

  // Requirement 6: Mall selector options compatible with active filters
  const compatibleMallOptions = useMemo(() => {
    // Check which malls match other active filters (except mallId itself)
    const matching = allSummaries.filter((s) => {
      if (filters.soloCriticos && s.riesgo !== 'ALERTA' && s.riesgo !== 'PREVENTIVO') return false;
      if (filters.departamento !== 'all' && s.mall.departamento !== filters.departamento) return false;
      if (filters.riesgo !== 'all' && s.riesgo !== filters.riesgo) return false;
      if (filters.conAvisoSenamhi && !s.avisoSenamhi) return false;
      if (filters.probabilidadMayor80 && s.probabilidadMax24h < 80) return false;
      return true;
    });

    return matching.map((s) => ({
      id: s.mall.id,
      nombre: s.mall.nombre,
      nombreCorto: s.mall.nombreCorto
    }));
  }, [allSummaries, filters]);

  // Currently selected mall summary (if selectedMallId is set)
  const selectedSummary = useMemo(() => {
    if (!selectedMallId) return null;
    return allSummaries.find((s) => s.mall.id === selectedMallId) || null;
  }, [allSummaries, selectedMallId]);

  // Active mall for forecast and charts below
  // If a mall is selected, show that mall.
  // If in national view, show the highest risk mall from filtered set.
  const activeDetailSummary = useMemo(() => {
    if (selectedSummary) return selectedSummary;
    return filteredSummaries[0] || allSummaries[0] || null;
  }, [selectedSummary, filteredSummaries, allSummaries]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 flex flex-col font-sans selection:bg-[#7300E1] selection:text-white">
      
      {/* 1. Header (Section 6) */}
      <Header
        ultimaActualizacion={lastUpdate}
        isRefreshing={isRefreshing}
        cooldownMinutesLeft={cooldownMinutesLeft}
        onRefresh={() => loadWeatherData(true)}
        soloCriticos={filters.soloCriticos}
        onToggleSoloCriticos={() => handleFilterChange({ soloCriticos: !filters.soloCriticos })}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenOcean={() => setIsOceanOpen(true)}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* View Switcher: Live Monitor vs Historical Precipitation Audit */}
      {currentView === 'history_audit' ? (
        <PrecipitationHistoryAudit
          onClose={() => setCurrentView('live')}
          defaultDate="2026-10-15"
          defaultMallId={selectedMallId || 'all'}
        />
      ) : (
        /* Main Content Viewport */
        <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 py-4 space-y-4 flex-1">
        
        {/* Error banner if server error occurs */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 p-3.5 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="font-semibold">{error}</span>
            </div>
            <button
              onClick={() => loadWeatherData(true)}
              className="px-2.5 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* 2. Executive KPI Summary Cards (Requirement 8: Synchronized with active filtered set) */}
        <KpiBar
          summaries={filteredSummaries}
          horizonte={filters.horizonte}
          onSelectKpiFilter={(type) => {
            if (type === 'ALL') handleResetFilters();
            else if (type === 'ALERTA') handleFilterChange({ riesgo: 'ALERTA', soloCriticos: false });
            else if (type === 'PREVENTIVO') handleFilterChange({ riesgo: 'PREVENTIVO', soloCriticos: false });
            else if (type === 'SENAMHI') handleFilterChange({ conAvisoSenamhi: true });
          }}
          activeFilter={
            filters.conAvisoSenamhi
              ? 'SENAMHI'
              : filters.riesgo === 'ALERTA'
              ? 'ALERTA'
              : filters.riesgo === 'PREVENTIVO'
              ? 'PREVENTIVO'
              : filters.mallId === 'all' && filters.departamento === 'all' && filters.riesgo === 'all'
              ? 'ALL'
              : undefined
          }
        />

        {/* 3. Multi-Parameter Filter Bar (Requirements 3 & 7) */}
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          departamentos={departamentos}
          malls={compatibleMallOptions}
          onReset={handleResetFilters}
          onResetToNational={handleResetToNational}
          resultCount={filteredSummaries.length}
          totalCount={allSummaries.length}
          onOpenHistoricalAudit={() => setCurrentView('history_audit')}
        />

        {/* 4. Central Grid: Interactive Peru Map + Right Panel (Estado A or Estado B) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* Map Column (7 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-7 relative">
            
            {/* Layer Controls Over Map */}
            <LayerControls
              layers={layers}
              onToggleLayer={handleToggleLayer}
              isOpen={isLayersOpen}
              onToggleOpen={() => setIsLayersOpen(!isLayersOpen)}
            />

            {/* Map Component */}
            {loading ? (
              <div className="w-full h-[680px] lg:h-[780px] xl:h-[840px] rounded-xl bg-white border border-neutral-200 flex flex-col items-center justify-center text-neutral-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#7300E1]" />
                <span className="text-xs font-medium">Cargando cartografía meteorológica del Perú...</span>
              </div>
            ) : (
              <MapComponent
                summaries={filteredSummaries}
                selectedMallId={selectedMallId}
                onSelectMall={(id) => handleSelectMall(id)}
                onResetToNational={handleResetToNational}
                layers={layers}
                horizonte={filters.horizonte}
              />
            )}

            {/* Banner: Critical Filter Active indication */}
            {filters.soloCriticos && (
              <div className="mt-2 px-3 py-1.5 bg-[#FFC740]/15 border border-[#FFC740] rounded-lg text-xs font-semibold text-neutral-900 flex items-center justify-between">
                <span>🔥 Filtro 'Solo Críticos' activo: Mostrando únicamente sedes en Alerta y Preventivo ({filteredSummaries.length}).</span>
                <button
                  onClick={() => handleFilterChange({ soloCriticos: false })}
                  className="text-xs font-bold text-[#7300E1] hover:underline cursor-pointer"
                >
                  Restablecer vista completa
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Two States (Section 9 Requirement) */}
          {/* ESTADO A: TODOS LOS MALLS -> NationalSummaryPanel */}
          {/* ESTADO B: MALL SELECCIONADO -> MallDetailPanel */}
          <div className="lg:col-span-5 xl:col-span-5">
            {loading ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">
                <RefreshCw className="w-6 h-6 animate-spin text-[#7300E1] mx-auto mb-2" />
                <p className="text-xs">Consultando telemetría de sedes...</p>
              </div>
            ) : selectedSummary ? (
              <MallDetailPanel
                summary={selectedSummary}
                onBackToNational={handleResetToNational}
                horizonte={filters.horizonte}
              />
            ) : (
              <NationalSummaryPanel
                summaries={filteredSummaries}
                onSelectMall={(id) => handleSelectMall(id)}
                horizonte={filters.horizonte}
              />
            )}
          </div>

        </div>

        {/* Informational Subheader for Forecast & Charts */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-black text-base text-neutral-900">
              {selectedSummary
                ? `Análisis Meteorológico Detallado: ${selectedSummary.mall.nombre}`
                : `Sede de Mayor Riesgo Operativo: ${activeDetailSummary?.mall.nombre || 'Real Plaza'}`}
            </span>
            {!selectedSummary && (
              <span className="text-sm text-neutral-500 font-medium">
                (Seleccione cualquier otra sede en el mapa o tabla para cambiar)
              </span>
            )}
          </div>
          {selectedSummary && (
            <button
              onClick={handleResetToNational}
              className="text-sm font-bold text-[#7300E1] hover:underline cursor-pointer"
            >
              ← Volver a Monitoreo Nacional
            </button>
          )}
        </div>

        {/* 5. 7-Day Operational Forecast Panel (Section 14) */}
        {activeDetailSummary && (
          <Forecast7Days
            daily={activeDetailSummary.daily7d}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date === selectedDate ? null : date)}
          />
        )}

        {/* 6. 48-Hour Hourly Trend Chart (Section 15) */}
        {activeDetailSummary && (
          <Chart48Hours
            hourly={activeDetailSummary.hourly48h}
            mallNombre={activeDetailSummary.mall.nombre}
          />
        )}

        {/* 7. Operational Data Table of Real Plaza Malls (Section 20) */}
        <DataTable
          summaries={filteredSummaries}
          selectedMallId={selectedMallId}
          onSelectMall={(id) => handleSelectMall(id)}
          horizonte={filters.horizonte}
        />

        {/* Corporate Legal & Preventive Notice */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-neutral-200 text-sm text-neutral-600 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7300E1]"></span>
            <span className="font-bold text-neutral-900 text-sm">
              Centro de Control Meteorológico Preventivo — Real Plaza (Motor Activo: Modelo B Calibrado)
            </span>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            * <strong>{DISCLAIMER_REAL_PLAZA}</strong> Este sistema integra datos de Open-Meteo High-Res Ensemble, Avisos Meteorológicos oficiales de SENAMHI, estimación satelital NASA IMERG y reportes oceanográficos de ENFEN para brindar a las gerencias de Mantenimiento y Operaciones una anticipación operativa frente a eventos pluviométricos.
          </p>
        </div>

      </main>
      )}

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onOpenHistoricalAudit={() => setCurrentView('history_audit')}
      />

      <OceanMonitorPanel
        isOpen={isOceanOpen}
        onClose={() => setIsOceanOpen(false)}
      />

    </div>
  );
}
