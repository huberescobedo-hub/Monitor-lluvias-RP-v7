import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Search,
  Download,
  CloudRain,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Clock,
  Database,
  Building2,
  ChevronRight,
  Info,
  RefreshCw,
  MapPin,
  Check,
  TrendingUp,
  X
} from 'lucide-react';
import { REAL_PLAZA_MALLS } from '../data/malls';
import {
  MallHistoricalAudit,
  HistoricalAuditResponse,
  RiskLevel,
  AuditVerdict
} from '../types';
import { fetchHistoricalAudit } from '../services/weatherService';

interface PrecipitationHistoryAuditProps {
  onClose?: () => void;
  defaultDate?: string;
  defaultMallId?: string;
}

export const PrecipitationHistoryAudit: React.FC<PrecipitationHistoryAuditProps> = ({
  onClose,
  defaultDate = '2026-10-15',
  defaultMallId = 'all'
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [selectedMallId, setSelectedMallId] = useState<string>(defaultMallId);
  const [activeMallDetailId, setActiveMallDetailId] = useState<string | null>(
    defaultMallId !== 'all' ? defaultMallId : null
  );
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<HistoricalAuditResponse | null>(null);

  // Table filters
  const [tableSearch, setTableSearch] = useState<string>('');
  const [filterOnlyRain, setFilterOnlyRain] = useState<boolean>(false);
  const [filterZone, setFilterZone] = useState<string>('all');

  // Preset quick audit dates
  const PRESET_DATES = [
    { label: '15 Octubre (Auditoría)', date: '2026-10-15' },
    { label: '22 Octubre (Ayer - Garúa)', date: '2026-10-22' },
    { label: '21 Octubre', date: '2026-10-21' },
    { label: '18 Octubre', date: '2026-10-18' },
    { label: '12 Octubre', date: '2026-10-12' }
  ];

  // Alphabetically sorted malls for selector
  const sortedMalls = useMemo(() => {
    return [...REAL_PLAZA_MALLS].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, []);

  // Fetch audit data
  const loadAudit = async (date: string, mallId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHistoricalAudit(date, mallId);
      setAuditData(res);
      if (mallId !== 'all') {
        setActiveMallDetailId(mallId);
      } else if (res.results.length > 0 && !activeMallDetailId) {
        // Pick mall with highest rain or first
        const maxRain = res.results.find(r => r.totalRainMm > 0) || res.results[0];
        setActiveMallDetailId(maxRain.mallId);
      }
    } catch (err: any) {
      console.error('Audit query error:', err);
      setError(err.message || 'Error al conectar con el archivo meteorológico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit(selectedDate, selectedMallId);
  }, [selectedDate, selectedMallId]);

  // Active detail item
  const activeDetail = useMemo(() => {
    if (!auditData) return null;
    return auditData.results.find(r => r.mallId === activeMallDetailId) || auditData.results[0] || null;
  }, [auditData, activeMallDetailId]);

  // Filtered table results
  const filteredTableResults = useMemo(() => {
    if (!auditData) return [];
    return auditData.results.filter(item => {
      if (filterOnlyRain && item.totalRainMm <= 0.05) return false;
      if (filterZone === 'lima' && item.zonaClimatica !== 'Costa centro') return false;
      if (filterZone === 'provincias' && item.zonaClimatica === 'Costa centro') return false;
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        return (
          item.mallNombre.toLowerCase().includes(q) ||
          item.ciudad.toLowerCase().includes(q) ||
          item.departamento.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [auditData, filterOnlyRain, filterZone, tableSearch]);

  // Export CSV
  const handleExportCSV = () => {
    if (!auditData || auditData.results.length === 0) return;
    const headers = [
      'Fecha',
      'Mall ID',
      'Sede Real Plaza',
      'Ciudad',
      'Departamento',
      'Zona Climática',
      'Latitud Azotea',
      'Longitud Azotea',
      'Lluvia 24h (mm)',
      'Pico Horario (mm/h)',
      'Hora Pico',
      'Horas de Lluvia',
      'Humedad Relativa Media (%)',
      'Humedad Relativa Max (%)',
      'Riesgo Auditado',
      'Veredicto',
      'Registrado en Backend',
      'Diagnostico',
      'Accion Recomendada'
    ];

    const rows = auditData.results.map(r => [
      r.date,
      r.mallId,
      `"${r.mallNombre}"`,
      `"${r.ciudad}"`,
      `"${r.departamento}"`,
      `"${r.zonaClimatica}"`,
      r.latitud,
      r.longitud,
      r.totalRainMm,
      r.peakHourMm,
      r.peakHourTime,
      r.hoursWithRain,
      r.avgRelativeHumidity,
      r.maxRelativeHumidity,
      r.riesgoCalculado,
      r.veredictoAuditoria,
      r.registradoEnBackend ? 'SI' : 'NO',
      `"${r.resumenDiagnostico.replace(/"/g, '""')}"`,
      `"${r.accionRecomendada.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_precipitacion_realplaza_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for risk badge
  const renderRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'ALERTA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
            ALERTA CRÍTICA
          </span>
        );
      case 'PREVENTIVO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            PREVENTIVO
          </span>
        );
      case 'VIGILANCIA':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            VIGILANCIA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            NORMAL
          </span>
        );
    }
  };

  const renderVerdictBadge = (verdict: AuditVerdict) => {
    switch (verdict) {
      case 'CONFIRMADO_LLUVIA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-black bg-red-600 text-white shadow-xs">
            <CloudRain className="w-3.5 h-3.5" />
            LLUVIA CONFIRMADA
          </span>
        );
      case 'GARUA_DETECTADA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-600 text-white shadow-xs">
            <Droplets className="w-3.5 h-3.5" />
            GARÚA / LLOVIZNA
          </span>
        );
      case 'DIA_SECO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-300">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            DÍA SECO (0.0 mm)
          </span>
        );
      default:
        return null;
    }
  };

  // Find max hourly precipitation in activeDetail for chart scale
  const maxHourlyInActive = useMemo(() => {
    if (!activeDetail || !activeDetail.hourly || activeDetail.hourly.length === 0) return 1;
    const maxVal = Math.max(...activeDetail.hourly.map(h => h.precipitationMm), 0);
    return Math.max(maxVal, 0.5); // minimum ceiling 0.5mm
  }, [activeDetail]);

  return (
    <div className="bg-neutral-50 min-h-screen text-neutral-900 pb-16">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-[#5900b3] via-[#7300E1] to-[#8d1eff] text-white py-6 px-4 sm:px-6 shadow-md border-b border-purple-800/40">
        <div className="max-w-[1720px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#FFC740] shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-black text-xl tracking-tight text-white">
                  HISTORIAL Y AUDITORÍA DE PRECIPITACIÓN
                </h1>
                <span className="bg-[#FFC740] text-black font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                  REAL PLAZA
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Auditoría retrospectiva por azotea comercial · Reanálisis Open-Meteo High-Res & Calibración de Alertas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={!auditData || auditData.results.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#7300E1] hover:bg-purple-50 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Informe CSV</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-900/60 hover:bg-purple-900 text-white border border-purple-400/30 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Volver al Monitor en Vivo</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 mt-6 space-y-6">

        {/* 2. Interactive Audit Control Bar */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            
            {/* Mall Selector */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-black text-neutral-800 uppercase tracking-wider mb-1.5">
                Sede Real Plaza a Auditar:
              </label>
              <div className="relative">
                <select
                  value={selectedMallId}
                  onChange={(e) => {
                    setSelectedMallId(e.target.value);
                    if (e.target.value !== 'all') {
                      setActiveMallDetailId(e.target.value);
                    }
                  }}
                  className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7300E1] cursor-pointer"
                >
                  <option value="all">🏢 Todos los malls (24 sedes a nivel nacional)</option>
                  <optgroup label="Sedes Lima Metropolitana (Costa Centro)">
                    {sortedMalls
                      .filter(m => m.zonaClimatica === 'Costa centro')
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} ({m.ciudad})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Sedes Provincias (Norte, Amazonía, Sierra)">
                    {sortedMalls
                      .filter(m => m.zonaClimatica !== 'Costa centro')
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.nombre} ({m.departamento} - {m.zonaClimatica})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Custom Date Picker */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-black text-neutral-800 uppercase tracking-wider mb-1.5">
                Fecha de Auditoría:
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  max={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-neutral-50 hover:bg-neutral-100 border border-neutral-300 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#7300E1] cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-1.5">
                Accesos rápidos de auditoría:
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_DATES.map(p => (
                  <button
                    key={p.date}
                    onClick={() => setSelectedDate(p.date)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedDate === p.date
                        ? 'bg-[#7300E1] text-white shadow-xs ring-1 ring-[#7300E1]'
                        : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Prompt banner reminder */}
          <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center justify-between text-sm text-neutral-600">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#7300E1]" />
              <span>
                Auditoría activa para: <strong className="text-neutral-900">{selectedDate}</strong> · Las lecturas corresponden directamente a la telemetría atmosférica en la azotea comercial.
              </span>
            </div>
            {loading && (
              <div className="flex items-center gap-1.5 text-[#7300E1] font-bold animate-pulse text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Consultando archivo meteorológico...</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. KPI Summary Bar for the Date */}
        {auditData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-600 mb-1.5">
                <span className="text-xs font-black uppercase tracking-wider">Sedes Auditadas</span>
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-neutral-900 font-mono tabular-nums">
                  {auditData.totalMalls}
                </span>
                <span className="text-sm text-neutral-500 font-medium">sedes activas</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 font-medium">
                {auditData.mallId === 'all' ? 'Cobertura nacional 100%' : 'Sede individual seleccionada'}
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-600 mb-1.5">
                <span className="text-xs font-black uppercase tracking-wider">Sedes con Precipitación</span>
                <CloudRain className="w-5 h-5 text-sky-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-sky-700 font-mono tabular-nums">
                  {auditData.mallsWithRain}
                </span>
                <span className="text-sm text-neutral-500 font-medium">de {auditData.totalMalls} sedes</span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 font-medium">
                {auditData.mallsWithRain > 0 ? 'Eventos registrados en azotea' : 'Jornada seca sin lluvia nacional'}
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-600 mb-1.5">
                <span className="text-xs font-black uppercase tracking-wider">Precipitación Máxima</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-neutral-900 font-mono tabular-nums">
                  {auditData.maxRainMall ? `${auditData.maxRainMall.mm.toFixed(1)} mm` : '0.0 mm'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1 truncate font-medium">
                {auditData.maxRainMall ? auditData.maxRainMall.nombre : 'Sin acumulación de agua'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold">Calibración de Riesgo</span>
                <ShieldAlert className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-neutral-900">
                  {auditData.results.some(r => r.riesgoCalculado === 'ALERTA')
                    ? 'ALERTA ACTIVADA'
                    : auditData.results.some(r => r.riesgoCalculado === 'PREVENTIVO')
                    ? 'PREVENTIVO'
                    : 'CONDICIÓN NORMAL'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Umbrales diferenciados Lima vs Provincias
              </p>
            </div>

          </div>
        )}

        {/* 4. Deep-Dive Mall Section */}
        {activeDetail && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden">
            
            {/* Mall Detail Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-neutral-50 to-purple-50/40 border-b border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight">
                    {activeDetail.mallNombre}
                  </h2>
                  <span className="bg-[#7300E1] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {activeDetail.ciudad} · {activeDetail.departamento}
                  </span>
                  <span className="text-xs text-neutral-600 font-medium px-2 py-0.5 rounded bg-neutral-200/60">
                    {activeDetail.zonaClimatica}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs text-neutral-600 flex-wrap">
                  <span className="flex items-center gap-1 font-mono text-[11px] bg-white px-2.5 py-1 rounded-lg border border-neutral-200 shadow-2xs">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    GPS Azotea: {activeDetail.latitud.toFixed(4)}°, {activeDetail.longitud.toFixed(4)}°
                  </span>
                  <a
                    href={activeDetail.fuenteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#7300E1] hover:underline font-bold"
                  >
                    <span>Verificar telemetría en Open-Meteo Archive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Status Verdict & Risk */}
              <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
                {renderVerdictBadge(activeDetail.veredictoAuditoria)}
                {renderRiskBadge(activeDetail.riesgoCalculado)}
              </div>
            </div>

            {/* Diagnostic Narrative & Regional Policy */}
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Diagnostics */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Audit Verdict Card */}
                <div className={`p-4 rounded-xl border ${
                  activeDetail.totalRainMm >= 2.0
                    ? 'bg-red-50/70 border-red-200'
                    : activeDetail.totalRainMm > 0
                    ? 'bg-sky-50/70 border-sky-200'
                    : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider mb-1">
                    {activeDetail.totalRainMm >= 2.0 ? (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    ) : activeDetail.totalRainMm > 0 ? (
                      <CloudRain className="w-4 h-4 text-sky-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className={activeDetail.totalRainMm >= 2.0 ? 'text-red-900' : activeDetail.totalRainMm > 0 ? 'text-sky-900' : 'text-emerald-900'}>
                      Diagnóstico de Auditoría ({selectedDate})
                    </span>
                  </div>
                  <p className="text-xs text-neutral-800 leading-relaxed font-medium">
                    {activeDetail.resumenDiagnostico}
                  </p>
                </div>

                {/* Retrospective Recommendation */}
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#7300E1] mb-1">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Acción Operativa y de Mantenimiento que debió activarse:</span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed font-medium">
                    {activeDetail.accionRecomendada}
                  </p>
                  {activeDetail.zonaClimatica === 'Costa centro' && (
                    <p className="text-[11px] text-purple-900 font-semibold mt-2 pt-2 border-t border-purple-200/60">
                      ⚡ <strong>Criterio Geográfico Lima Metropolitana:</strong> La ciudad carece de redes de drenaje pluvial público y los techos de centros comerciales son planos. Por ello, una llovizna persistente de {activeDetail.totalRainMm} mm generó una evaluación de riesgo mucho más estricta para salvaguardar tableros, juntas y accesos.
                    </p>
                  )}
                </div>

                {/* Backend Telemetry Log Verification */}
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#7300E1]" />
                    <div>
                      <span className="font-bold text-neutral-900">Registro en Backend de Sesión: </span>
                      <span className="text-neutral-600">
                        {activeDetail.registradoEnBackend
                          ? 'Sincronizado y archivado en histórico de telemetría'
                          : 'Validado retrospectivamente vía Reanálisis Atmosférico Directo'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    activeDetail.registradoEnBackend
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {activeDetail.registradoEnBackend ? 'VERIFICADO EN LOG' : 'DATOS TELEMETRÍA OK'}
                  </span>
                </div>

              </div>

              {/* Right Column: Key Day Metrics Cards */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3 self-start">
                
                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Precipitación Total
                  </span>
                  <div className="text-2xl font-black text-[#7300E1] mt-1">
                    {activeDetail.totalRainMm.toFixed(1)} <span className="text-xs font-semibold text-neutral-500">mm / 24h</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    Acumulado 00:00 - 23:59
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Pico Horario
                  </span>
                  <div className="text-2xl font-black text-sky-700 mt-1">
                    {activeDetail.peakHourMm.toFixed(1)} <span className="text-xs font-semibold text-neutral-500">mm/h</span>
                  </div>
                  <span className="text-[10px] text-neutral-600 font-semibold mt-0.5 block">
                    Registrado a las {activeDetail.peakHourTime} hrs
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Horas con Lluvia
                  </span>
                  <div className="text-2xl font-black text-neutral-900 mt-1">
                    {activeDetail.hoursWithRain} <span className="text-xs font-semibold text-neutral-500">horas</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    {activeDetail.hoursWithRain > 0 ? 'Lluvia o llovizna activa' : 'Día continuo seco'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Humedad Relativa
                  </span>
                  <div className="text-2xl font-black text-neutral-900 mt-1">
                    {activeDetail.avgRelativeHumidity}%
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 block">
                    Máximo: {activeDetail.maxRelativeHumidity}%
                  </span>
                </div>

              </div>

            </div>

            {/* 5. Hourly Breakdown Bar Chart (00:00 to 23:00) */}
            <div className="p-5 sm:p-6 border-t border-neutral-200 bg-neutral-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#7300E1]" />
                  <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider">
                    Curva Horaria de Precipitación (00:00 - 23:00) · {activeDetail.mallNombre}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono">
                  Pico: {activeDetail.peakHourMm} mm/h ({activeDetail.peakHourTime})
                </span>
              </div>

              {/* Bar Chart Visualization */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-2xs">
                <div className="grid grid-cols-24 gap-1 sm:gap-1.5 h-36 items-end pt-4 pb-2 border-b border-neutral-100">
                  {activeDetail.hourly.map((h) => {
                    const heightPct = maxHourlyInActive > 0 ? Math.max(8, (h.precipitationMm / maxHourlyInActive) * 100) : 8;
                    const hasRain = h.precipitationMm > 0;
                    const isPeak = h.hour === activeDetail.peakHourTime && hasRain;

                    return (
                      <div
                        key={h.hour}
                        className="flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-neutral-900 text-white text-[10px] px-2 py-1.5 rounded shadow-lg whitespace-nowrap text-center">
                            <p className="font-bold">{h.hour} hrs</p>
                            <p className="text-sky-300 font-bold">{h.precipitationMm} mm</p>
                            <p className="text-neutral-300">{h.temperatureC}°C · {h.relativeHumidity}% HR</p>
                          </div>
                          <div className="w-2 h-2 bg-neutral-900 rotate-45 -mt-1"></div>
                        </div>

                        {/* Rain Value Label on top of bar if non-zero */}
                        {hasRain && (
                          <span className={`text-[9px] font-bold mb-1 ${isPeak ? 'text-red-600' : 'text-sky-600'}`}>
                            {h.precipitationMm}
                          </span>
                        )}

                        {/* Bar */}
                        <div
                          style={{ height: `${hasRain ? heightPct : 6}%` }}
                          className={`w-full rounded-t-sm transition-all duration-300 ${
                            isPeak
                              ? 'bg-gradient-to-t from-red-600 to-amber-500 ring-1 ring-red-400'
                              : hasRain
                              ? 'bg-gradient-to-t from-[#0284c7] to-[#38bdf8] group-hover:from-sky-500 group-hover:to-sky-400'
                              : 'bg-neutral-100 group-hover:bg-neutral-200'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X Axis Time Labels */}
                <div className="grid grid-cols-24 gap-1 sm:gap-1.5 text-center mt-2 text-[9px] text-neutral-400 font-mono">
                  {activeDetail.hourly.map((h, i) => (
                    <span key={h.hour} className={i % 3 === 0 ? 'font-bold text-neutral-700' : 'hidden sm:inline'}>
                      {h.hour.slice(0, 2)}h
                    </span>
                  ))}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* 6. Multi-Mall Comparative Table (Available when querying all malls or all sedes) */}
        {auditData && auditData.results.length > 1 && (
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            
            {/* Table Header & Quick Filters */}
            <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neutral-50">
              <div>
                <h3 className="font-extrabold text-sm text-neutral-900 tracking-tight">
                  Auditoría Comparativa Nacional · {selectedDate}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Haz click en cualquier fila para auditar en detalle la curva horaria de esa sede
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5 flex-wrap self-stretch md:self-auto">
                
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar sede o ciudad..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#7300E1]"
                  />
                </div>

                {/* Filter Only Rain */}
                <button
                  onClick={() => setFilterOnlyRain(!filterOnlyRain)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    filterOnlyRain
                      ? 'bg-[#7300E1] text-white shadow-xs'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Solo con lluvia ({auditData.mallsWithRain})</span>
                </button>

                {/* Filter Zone */}
                <select
                  value={filterZone}
                  onChange={(e) => setFilterZone(e.target.value)}
                  className="bg-white border border-neutral-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-700 focus:outline-none focus:ring-1 focus:ring-[#7300E1] cursor-pointer"
                >
                  <option value="all">Todas las zonas</option>
                  <option value="lima">Solo Lima Metropolitana</option>
                  <option value="provincias">Solo Provincias</option>
                </select>

              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-100/70 text-[10px] font-bold text-neutral-600 uppercase tracking-wider border-b border-neutral-200">
                  <tr>
                    <th className="py-3 px-4">Sede Real Plaza</th>
                    <th className="py-3 px-3">Ubicación</th>
                    <th className="py-3 px-3">Zona</th>
                    <th className="py-3 px-3 text-right">Lluvia 24h (mm)</th>
                    <th className="py-3 px-3 text-right">Pico Horario</th>
                    <th className="py-3 px-3 text-right">Horas Lluvia</th>
                    <th className="py-3 px-3 text-right">Humedad Med.</th>
                    <th className="py-3 px-3">Veredicto Auditoría</th>
                    <th className="py-3 px-3">Riesgo Auditado</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredTableResults.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-neutral-400">
                        No se encontraron sedes que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredTableResults.map((row) => {
                      const isSelected = row.mallId === activeMallDetailId;
                      const hasRain = row.totalRainMm > 0.05;

                      return (
                        <tr
                          key={row.mallId}
                          onClick={() => setActiveMallDetailId(row.mallId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-purple-50/90 font-medium'
                              : hasRain
                              ? 'hover:bg-neutral-50/80 bg-sky-50/20'
                              : 'hover:bg-neutral-50'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-bold text-neutral-900 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              row.riesgoCalculado === 'ALERTA'
                                ? 'bg-red-600 animate-pulse'
                                : row.riesgoCalculado === 'PREVENTIVO'
                                ? 'bg-amber-500'
                                : hasRain
                                ? 'bg-sky-500'
                                : 'bg-neutral-300'
                            }`}></span>
                            <span>{row.mallNombre}</span>
                          </td>
                          <td className="py-2.5 px-3 text-neutral-600">
                            {row.ciudad}, {row.departamento}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                              {row.zonaClimatica}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={hasRain ? 'text-[#0284c7] font-black' : 'text-neutral-400'}>
                              {row.totalRainMm.toFixed(1)} mm
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                            {hasRain ? `${row.peakHourMm.toFixed(1)} mm/h (${row.peakHourTime})` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <span className={row.hoursWithRain > 0 ? 'text-sky-700 font-bold' : 'text-neutral-400'}>
                              {row.hoursWithRain} h
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                            {row.avgRelativeHumidity}%
                          </td>
                          <td className="py-2.5 px-3">
                            {renderVerdictBadge(row.veredictoAuditoria)}
                          </td>
                          <td className="py-2.5 px-3">
                            {renderRiskBadge(row.riesgoCalculado)}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMallDetailId(row.mallId);
                              }}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer ${
                                isSelected
                                  ? 'bg-[#7300E1] text-white'
                                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                              }`}
                            >
                              <span>Ver 24h</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
