import React from 'react';
import { MallWeatherSummary, RiskLevel, TimeHorizon } from '../types';
import { getHorizonMetric, getRemainingTodayPrecip, getFallenTodayPrecip } from '../utils/horizonMetrics';
import {
  ShieldAlert,
  AlertTriangle,
  BellRing,
  ShieldCheck,
  CloudRain,
  Compass,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { DISCLAIMER_REAL_PLAZA } from '../utils/riskEngine';

interface NationalSummaryPanelProps {
  summaries: MallWeatherSummary[];
  onSelectMall: (mallId: string) => void;
  horizonte?: TimeHorizon;
}

const RISK_BADGES: Record<RiskLevel, { dot: string; textClass: string; bgClass: string; label: string }> = {
  'ALERTA': { dot: 'bg-red-600', textClass: 'text-red-700', bgClass: 'bg-red-50 border-red-200', label: 'Alerta' },
  'PREVENTIVO': { dot: 'bg-[#F59E0B]', textClass: 'text-amber-800', bgClass: 'bg-amber-50 border-amber-200', label: 'Preventivo' },
  'VIGILANCIA': { dot: 'bg-sky-500', textClass: 'text-sky-800', bgClass: 'bg-sky-50 border-sky-200', label: 'Vigilancia' },
  'NORMAL': { dot: 'bg-emerald-600', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-200', label: 'Normal' }
};

export const NationalSummaryPanel: React.FC<NationalSummaryPanelProps> = ({
  summaries,
  onSelectMall,
  horizonte = '24h'
}) => {
  const total = summaries.length;
  const countAlerta = summaries.filter((s) => s.riesgo === 'ALERTA').length;
  const countPreventivo = summaries.filter((s) => s.riesgo === 'PREVENTIVO').length;
  const countVigilancia = summaries.filter((s) => s.riesgo === 'VIGILANCIA').length;
  const countNormal = summaries.filter((s) => s.riesgo === 'NORMAL').length;
  const countSenamhi = summaries.filter((s) => s.avisoSenamhi !== null).length;

  // Highlights
  // 1. Mayor riesgo
  const highestRiskMall = summaries.length > 0 ? summaries[0] : null;

  // 2. Mayor lluvia en el horizonte activo
  let maxRainMall = summaries[0] || null;
  let maxRainVal = -1;
  let maxRainMetric = maxRainMall ? getHorizonMetric(maxRainMall, horizonte) : null;
  summaries.forEach((s) => {
    const m = getHorizonMetric(s, horizonte);
    if (m.value > maxRainVal) {
      maxRainVal = m.value;
      maxRainMall = s;
      maxRainMetric = m;
    }
  });

  // 3. Mayor probabilidad
  let maxProbMall = summaries[0] || null;
  let maxProbVal = -1;
  summaries.forEach((s) => {
    if (s.probabilidadMax24h > maxProbVal) {
      maxProbVal = s.probabilidadMax24h;
      maxProbMall = s;
    }
  });

  // Top 5 sorted by risk
  const top5 = summaries.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
      
      {/* Header Banner */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-gradient-to-r from-purple-50/70 via-neutral-50 to-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#7300E1]">
                Vista Ejecutiva Consolidada
              </span>
              <span className="text-neutral-300">/</span>
              <span className="text-sm text-neutral-600 font-medium">Perú Nacional</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              REAL PLAZA | MONITOREO NACIONAL
            </h2>
            <p className="text-sm text-neutral-600 mt-0.5">
              Control de {total} sedes monitoreadas en tiempo real
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#7300E1] text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
            RP
          </div>
        </div>

        {/* 4 Status Pills Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div className="bg-white p-3 rounded-lg border border-red-200 flex items-center gap-2.5 shadow-2xs">
            <span className="w-3.5 h-3.5 rounded-full bg-red-600 shrink-0"></span>
            <div>
              <span className="text-lg font-black text-red-700 font-mono tabular-nums">{countAlerta}</span>
              <span className="text-sm font-black text-neutral-800 ml-1.5">Alerta</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-amber-200 flex items-center gap-2.5 shadow-2xs">
            <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] shrink-0"></span>
            <div>
              <span className="text-lg font-black text-amber-800 font-mono tabular-nums">{countPreventivo}</span>
              <span className="text-sm font-black text-neutral-800 ml-1.5">Preventivo</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-sky-200 flex items-center gap-2.5 shadow-2xs">
            <span className="w-3.5 h-3.5 rounded-full bg-sky-500 shrink-0"></span>
            <div>
              <span className="text-lg font-black text-sky-800 font-mono tabular-nums">{countVigilancia}</span>
              <span className="text-sm font-black text-neutral-800 ml-1.5">Vigilancia</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center gap-2.5 shadow-2xs">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 shrink-0"></span>
            <div>
              <span className="text-lg font-black text-emerald-700 font-mono tabular-nums">{countNormal}</span>
              <span className="text-sm font-black text-neutral-800 ml-1.5">Normal</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        
        {/* National Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          {/* Mayor Riesgo */}
          <div
            onClick={() => highestRiskMall && onSelectMall(highestRiskMall.mall.id)}
            className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-[#7300E1] transition-all cursor-pointer group"
          >
            <span className="text-sm font-black text-neutral-700 uppercase tracking-wider block mb-1">
              Mayor Riesgo Actual
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-black text-lg text-neutral-900 group-hover:text-[#7300E1] transition-colors block">
                  {highestRiskMall ? highestRiskMall.mall.nombre : 'N/D'}
                </span>
                <span className="text-sm text-neutral-600 font-medium">
                  {highestRiskMall ? `${highestRiskMall.mall.ciudad} · Score ${highestRiskMall.riesgoScore}/100` : ''}
                </span>
              </div>
              {highestRiskMall && (
                <span className={`px-3.5 py-1.5 rounded-md text-sm font-black uppercase tracking-wide ${
                  highestRiskMall.riesgo === 'ALERTA' ? 'bg-red-600 text-white' : highestRiskMall.riesgo === 'PREVENTIVO' ? 'bg-[#F59E0B] text-neutral-950' : 'bg-neutral-600 text-white'
                }`}>
                  {highestRiskMall.riesgo}
                </span>
              )}
            </div>
          </div>

          {/* Mayor Lluvia por Horizonte */}
          <div
            onClick={() => maxRainMall && onSelectMall(maxRainMall.mall.id)}
            className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-[#4ABFFF] transition-all cursor-pointer group"
          >
            <span className="text-sm font-black text-[#0284c7] uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-[#4ABFFF]" />
              Mayor Lluvia ({maxRainMetric?.shortLabel || horizonte})
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-black text-lg text-neutral-900 group-hover:text-[#0284c7] transition-colors block">
                  {maxRainMall ? maxRainMall.mall.nombre : 'N/D'}
                </span>
                <span className="text-sm text-neutral-600 font-medium block">
                  {maxRainMall ? maxRainMall.mall.ciudad : ''}
                </span>
                {horizonte === '24h' && maxRainMall && getFallenTodayPrecip(maxRainMall) >= 0.5 && (
                  <span className="text-xs text-neutral-500 font-sans tabular-nums block mt-0.5">
                    Resta hoy: {getRemainingTodayPrecip(maxRainMall).toFixed(1)} mm · Acum. hoy: {maxRainMall.lluvia24hMm.toFixed(1)} mm
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-[#0284c7] font-mono tabular-nums">
                  {maxRainMetric ? maxRainMetric.value.toFixed(1) : '0.0'}
                </span>
                <span className="text-base font-bold text-neutral-600 ml-1">
                  {maxRainMetric?.unit || 'mm'}
                </span>
              </div>
            </div>
          </div>

          {/* Mayor Probabilidad */}
          <div
            onClick={() => maxProbMall && onSelectMall(maxProbMall.mall.id)}
            className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 hover:border-[#7300E1] transition-all cursor-pointer group"
          >
            <span className="text-sm font-black text-purple-700 uppercase tracking-wider block mb-1">
              Mayor Probabilidad Precipitación
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-black text-lg text-neutral-900 group-hover:text-[#7300E1] transition-colors block">
                  {maxProbMall ? maxProbMall.mall.nombre : 'N/D'}
                </span>
                <span className="text-sm text-neutral-600 font-medium">
                  {maxProbMall ? maxProbMall.mall.ciudad : ''}
                </span>
              </div>
              <span className="text-2xl font-black text-[#7300E1] font-mono tabular-nums">
                {maxProbMall ? maxProbMall.probabilidadMax24h : 0}%
              </span>
            </div>
          </div>

          {/* Avisos SENAMHI */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
            <span className="text-sm font-black text-amber-800 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-600" />
              Sedes con Aviso SENAMHI
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl sm:text-4xl font-black text-neutral-900 font-mono tabular-nums">
                {countSenamhi}
              </span>
              <span className="text-sm text-neutral-600 font-semibold">
                de {total} sedes monitoreadas
              </span>
            </div>
          </div>

        </div>

        {/* Section: TOP 5 DE MAYOR RIESGO (Section 9 Requirement) */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base sm:text-lg font-black text-neutral-900 uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#7300E1]" />
              Top 5 de Mayor Riesgo Operativo
            </span>
            <span className="text-xs font-bold text-neutral-500 font-mono">Prioridad de Mantenimiento</span>
          </div>

          <div className="space-y-2.5">
            {top5.map((s, index) => {
              const badge = RISK_BADGES[s.riesgo] || RISK_BADGES.NORMAL;
              const hzMetric = getHorizonMetric(s, horizonte);
              const fallen = getFallenTodayPrecip(s);
              const remaining = getRemainingTodayPrecip(s);
              return (
                <div
                  key={s.mall.id}
                  onClick={() => onSelectMall(s.mall.id)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-200 bg-white hover:bg-purple-50/50 hover:border-[#7300E1]/50 transition-all cursor-pointer group shadow-2xs"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="text-base font-mono font-black text-neutral-500 w-5 text-center">
                      {index + 1}.
                    </span>
                    <span className={`w-3.5 h-3.5 rounded-full ${badge.dot} shrink-0`}></span>
                    <div className="truncate">
                      <span className="font-extrabold text-base sm:text-lg text-neutral-900 group-hover:text-[#7300E1] transition-colors block truncate">
                        {s.mall.nombre}
                      </span>
                      <span className="text-sm text-neutral-600 font-medium font-mono block mt-0.5 truncate">
                        {s.mall.ciudad} · {hzMetric.compactTag}: {hzMetric.formatted}
                        {horizonte === '24h' && fallen >= 0.5 ? ` (Resta hoy: ${remaining.toFixed(1)} mm)` : ''} · Prob: {s.probabilidadMax24h}% · Score: {s.riesgoScore}/100
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <span className={`text-sm font-black px-4 py-1.5 rounded-lg uppercase tracking-wide shadow-2xs ${badge.bgClass} ${badge.textClass}`}>
                      {badge.label}
                    </span>
                    <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-[#7300E1] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informational Guidance & Geocoding Assurance Footer */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            <span><strong>Georreferenciación 100% Predial:</strong> 21 sedes con lecturas directas en azotea comercial (sin estaciones lejanas).</span>
          </div>
          <a
            href="https://open-meteo.com/en/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-emerald-800 font-bold hover:underline inline-flex items-center gap-1"
            title="Ver documentación del modelo de alta resolución"
          >
            <span>Ver fuente Open-Meteo (~1.5 km)</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
          <span>Haga clic en cualquier sede para inspeccionar el pronóstico y telemetría.</span>
          <span className="font-mono text-xs text-neutral-500">America/Lima</span>
        </div>

      </div>

    </div>
  );
};
