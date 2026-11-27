import React from 'react';
import {
  MallWeatherSummary,
  RiskLevel,
  TimeHorizon
} from '../types';
import { getCurrentLimaHourPrecip, getRemainingTodayPrecip, getFallenTodayPrecip, getNext24hRollingPrecip } from '../utils/horizonMetrics';
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  BellRing,
  Radar,
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Compass,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Scale
} from 'lucide-react';
import { DISCLAIMER_REAL_PLAZA } from '../utils/riskEngine';

interface MallDetailPanelProps {
  summary: MallWeatherSummary | null;
  onBackToNational?: () => void;
  onClose?: () => void;
  horizonte?: TimeHorizon;
}

const RISK_THEME: Record<RiskLevel, {
  badgeBg: string;
  badgeText: string;
  border: string;
  icon: React.ReactNode;
  label: string;
}> = {
  'ALERTA': {
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    border: 'border-red-300',
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
    label: 'ALERTA CRÍTICA'
  },
  'PREVENTIVO': {
    badgeBg: 'bg-amber-500',
    badgeText: 'text-neutral-950',
    border: 'border-amber-300',
    icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
    label: 'PREVENTIVO'
  },
  'VIGILANCIA': {
    badgeBg: 'bg-sky-500',
    badgeText: 'text-white',
    border: 'border-sky-300',
    icon: <BellRing className="w-5 h-5 text-sky-600" />,
    label: 'VIGILANCIA'
  },
  'NORMAL': {
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    border: 'border-emerald-300',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-600" />,
    label: 'NORMAL'
  }
};

export const MallDetailPanel: React.FC<MallDetailPanelProps> = ({ summary, onBackToNational, horizonte = '24h' }) => {
  if (!summary) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-400">
        <MapPin className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium">Seleccione una sede de Real Plaza en el mapa o tabla.</p>
      </div>
    );
  }

  const mall = summary.mall;
  const theme = RISK_THEME[summary.riesgo] || RISK_THEME.NORMAL;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
      
      {/* Header Banner */}
      <div className="p-4 sm:p-5 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
        {onBackToNational && (
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200/60">
            <button
              onClick={onBackToNational}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#7300E1] hover:text-[#5800ac] transition-colors cursor-pointer bg-purple-50 hover:bg-purple-100/80 px-3 py-1.5 rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Ver Monitoreo Nacional</span>
            </button>
            <span className="text-xs text-neutral-500 font-mono">Ficha Operativa</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black uppercase tracking-wider text-[#7300E1]">
                {mall.ciudad} · {mall.departamento}
              </span>
              <span className="text-neutral-300">/</span>
              <span className="text-sm text-neutral-600 font-medium">{mall.zonaClimatica}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
              {mall.nombre.toUpperCase()}
            </h2>
            <p className="text-sm text-neutral-600 flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
              <span>{mall.direccion}</span>
            </p>
            {mall.latitud !== null && mall.longitud !== null && (
              <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    <span className="text-sm font-mono font-bold text-emerald-950">
                      GPS Azotea: {mall.latitud.toFixed(4)}°, {mall.longitud.toFixed(4)}°
                    </span>
                    <span className="text-xs text-emerald-800 bg-white/95 border border-emerald-300 px-2 py-0.5 rounded-md font-sans font-medium">
                      Lectura directa en predio comercial (sin estaciones lejanas)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1.5 border-t border-emerald-200/60 text-xs flex-wrap">
                  <a
                    href={`https://api.open-meteo.com/v1/forecast?latitude=${mall.latitud}&longitude=${mall.longitud}&hourly=precipitation,precipitation_probability,temperature_2m&daily=precipitation_sum,precipitation_probability_max&timezone=America%2FLima`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-bold text-[#7300E1] hover:text-[#5800ac] hover:underline"
                    title="Ver telemetría y respuesta JSON en vivo de Open-Meteo para esta ubicación"
                  >
                    <span>🔗 Verificar Fuente Open-Meteo API (en vivo)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-emerald-300">·</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${mall.latitud},${mall.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-neutral-700 hover:text-neutral-950 hover:underline"
                    title="Ver satélite del centro comercial en Google Maps"
                  >
                    <span>📍 Ver Azotea en Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {summary.avisoSenamhi && (
                    <>
                      <span className="text-emerald-300">·</span>
                      <a
                        href="https://www.senamhi.gob.pe/?p=aviso-meteorologico"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-amber-800 hover:underline"
                        title="Ver avisos en portal oficial SENAMHI"
                      >
                        <span>⚠️ Avisos SENAMHI</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Risk Badge */}
          <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
            <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-base font-black tracking-wider uppercase shadow-xs ${theme.badgeBg} ${theme.badgeText}`}>
              <span className="w-3 h-3 rounded-full bg-white animate-pulse"></span>
              <span>{theme.label}</span>
            </div>
            <span className="text-xs text-neutral-600 font-mono font-bold bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200">
              Score de Riesgo: {summary.riesgoScore}/100 · Modelo B Calibrado
            </span>
          </div>
        </div>

        {/* Operational Recommendation Alert Box (Section 22) */}
        {summary.recomendacionOperativa && (
          <div className={`mt-3.5 p-3.5 rounded-xl border flex items-start gap-3 text-sm ${
            summary.riesgo === 'ALERTA'
              ? 'bg-red-50 border-red-200 text-red-900'
              : summary.riesgo === 'PREVENTIVO'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-neutral-50 border-neutral-200 text-neutral-800'
          }`}>
            <div className="shrink-0 mt-0.5">{theme.icon}</div>
            <div>
              <span className="font-black block uppercase tracking-wider text-xs mb-1">
                Acción Preventiva Operativa (Mantenimiento)
              </span>
              <p className="font-semibold text-sm leading-relaxed">
                {summary.recomendacionOperativa}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        
        {/* Validación Espacial y Consistencia de Distrito (Filtro Anti-Falsos Positivos) */}
        {summary.validacionEspacial && (
          <div className={`p-4 rounded-xl border transition-all ${
            summary.validacionEspacial.esAnomaliaCorregida
              ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-xs'
              : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  summary.validacionEspacial.esAnomaliaCorregida
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {summary.validacionEspacial.esAnomaliaCorregida ? (
                    <Scale className="w-5 h-5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm uppercase tracking-wider">
                      {summary.validacionEspacial.esAnomaliaCorregida
                        ? 'Lectura Calibrada por Validación Espacial'
                        : 'Consistencia Distrital Verificada'}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      summary.validacionEspacial.esAnomaliaCorregida
                        ? 'bg-amber-500 text-neutral-950'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {summary.validacionEspacial.esAnomaliaCorregida ? 'Anomalía Neutralizada' : 'Dato Homologado'}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed font-medium">
                    {summary.validacionEspacial.mensajeDiagnostico}
                  </p>

                  {summary.validacionEspacial.esAnomaliaCorregida && summary.validacionEspacial.valorOriginalMm !== undefined && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200/80 text-xs font-mono">
                      <span className="text-amber-800 line-through">
                        Lectura cruda modelo: {summary.validacionEspacial.valorOriginalMm.toFixed(1)} mm
                      </span>
                      <span>➔</span>
                      <span className="font-bold text-emerald-800 text-sm">
                        Valor real calibrado: {summary.lluvia24hMm.toFixed(1)} mm
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-600 flex-wrap">
                    <span className="font-bold text-neutral-800">Cluster & Estaciones:</span>
                    <span className="font-medium">{summary.validacionEspacial.clusterDistrital}</span>
                    <span>·</span>
                    <span className="italic">{summary.validacionEspacial.estacionesReferencia.join(' · ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        {(() => {
          const isLima = mall.zonaClimatica === 'Costa centro';
          const heavyThreshold = isLima ? 3.5 : 15.0;
          const todayPeakHour = summary.franjaMayorRiesgo?.includes('–')
            ? summary.franjaMayorRiesgo.split('–')[0].trim()
            : null;

          const day2 = summary.daily7d?.[1];
          const day2HasRain = Boolean(
            day2 && (day2.precipitationSumMm >= 0.5 || (day2.precipitationProbabilityMax >= 40 && day2.precipitationSumMm >= 0.2))
          );

          const minMm = isLima ? 0.1 : 0.2;
          const minProb = isLima ? 30 : 35;
          const isSignificantHour = (h?: typeof summary.hourly48h[number]) =>
            Boolean(h && ((h.precipitationMm >= minMm && h.precipitationProbability >= minProb) || h.precipitationMm >= 0.4));

          let tomorrowPeakHour: string | null = day2?.horaPico || null;
          let tomorrowStartLabel: string | null = day2?.inicioEstimado || null;

          if (day2HasRain && (!tomorrowStartLabel || !tomorrowPeakHour) && summary.hourly48h?.length > 24) {
            const todayLastHour = summary.hourly48h[23];
            const day2Hours = summary.hourly48h.slice(24, 48);

            if (!tomorrowPeakHour) {
              let maxScore = -1;
              let bestHour: string | null = null;
              for (const h of day2Hours) {
                const s = h.precipitationMm * 2 + h.precipitationProbability / 25;
                if (s > maxScore && h.precipitationMm >= 0.1) {
                  maxScore = s;
                  bestHour = h.displayTime;
                }
              }
              tomorrowPeakHour = bestHour;
            }

            if (!tomorrowStartLabel) {
              let firstIdx = day2Hours.findIndex(h => isSignificantHour(h));
              if (firstIdx < 0) {
                firstIdx = day2Hours.findIndex(h => h.precipitationMm > 0);
              }

              if (firstIdx >= 0) {
                const continuesFromTonight = firstIdx === 0 && isSignificantHour(todayLastHour);

                if (continuesFromTonight) {
                  let tailMm = 0;
                  let i = 0;
                  while (i < day2Hours.length && isSignificantHour(day2Hours[i])) {
                    tailMm += day2Hours[i].precipitationMm;
                    i++;
                  }
                  let dryStreak = 0;
                  let resumeIdx = -1;
                  let resumeWaveMm = 0;
                  for (; i < day2Hours.length; i++) {
                    if (!isSignificantHour(day2Hours[i]) && day2Hours[i].precipitationMm < minMm) {
                      dryStreak++;
                    } else {
                      if (dryStreak >= 2) {
                        let waveMm = 0;
                        let j = i;
                        while (j < day2Hours.length && (isSignificantHour(day2Hours[j]) || day2Hours[j].precipitationMm > 0)) {
                          waveMm += day2Hours[j].precipitationMm;
                          j++;
                        }
                        if (waveMm >= (isLima ? 0.5 : 1.5)) {
                          resumeIdx = i;
                          resumeWaveMm = waveMm;
                          break;
                        }
                      }
                      dryStreak = 0;
                    }
                  }
                  if (resumeIdx >= 0) {
                    const rTime = day2Hours[resumeIdx].displayTime;
                    tomorrowStartLabel = tailMm <= 2.5 && resumeWaveMm >= tailMm * 2
                      ? `Inicio ~${rTime} (cont.)`
                      : `Cont. 00h · 2.° ~${rTime}`;
                  } else {
                    tomorrowStartLabel = 'Cont. madrugada (00h)';
                  }
                } else {
                  tomorrowStartLabel = `Inicio: ~${day2Hours[firstIdx].displayTime}`;
                }
              }
            }
          }

          const day3 = summary.daily7d?.[2];
          const day3HasRain = Boolean(
            day3 && (day3.precipitationSumMm >= 0.5 || (day3.precipitationProbabilityMax >= 40 && day3.precipitationSumMm >= 0.2))
          );

          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* Lluvia 24h */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                horizonte === '24h'
                  ? 'bg-purple-50/40 border-[#7300E1] ring-2 ring-[#7300E1]/15'
                  : 'bg-neutral-50/70 border-neutral-200/80'
              }`}>
                <span className="text-xs font-black text-neutral-600 uppercase tracking-wider block mb-1">
                  Lluvia 24 h
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-[#0284c7] font-mono tabular-nums">
                    {summary.lluvia24hMm.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-neutral-600">mm</span>
                </div>
                <span className="text-[11px] tracking-tight text-neutral-500 font-sans tabular-nums mt-1 block leading-snug">
                  {summary.probabilidadMax24h > 0
                    ? `Prob. ${summary.probabilidadMax24h}%${todayPeakHour ? ` · Pico ${todayPeakHour}` : ''}`
                    : 'Sin lluvia prevista'}
                </span>
                {getFallenTodayPrecip(summary) >= 0.5 && (
                  <div className="mt-1 pt-1 border-t border-neutral-200/70 text-[11px] font-sans tabular-nums tracking-tight leading-snug">
                    <span className="block font-semibold text-[#0284c7]">
                      Resta hoy: {getRemainingTodayPrecip(summary).toFixed(1)} mm
                    </span>
                    <span className="block text-neutral-500">
                      Próx. 24h: {getNext24hRollingPrecip(summary).toFixed(1)} mm
                    </span>
                  </div>
                )}
              </div>

              {/* Lluvia 48h */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                horizonte === '48h'
                  ? 'bg-purple-50/40 border-[#7300E1] ring-2 ring-[#7300E1]/15'
                  : 'bg-neutral-50/70 border-neutral-200/80'
              }`}>
                <span className="text-xs font-black text-neutral-600 uppercase tracking-wider block mb-1">
                  Lluvia 48 h
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-neutral-900 font-mono tabular-nums">
                    {summary.lluvia48hMm.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-neutral-600">mm</span>
                </div>
                {day2 && day2HasRain ? (
                  <div className={`text-xs font-mono mt-1 leading-snug ${
                    day2.precipitationSumMm >= heavyThreshold ? 'text-amber-700 font-semibold' : 'text-[#0284c7] font-semibold'
                  }`}>
                    <span className="block">{day2.dayName}: +{day2.precipitationSumMm.toFixed(1)} mm</span>
                    {tomorrowStartLabel && (
                      <span className="block font-sans tabular-nums tracking-tight text-[11px] font-semibold">
                        {tomorrowStartLabel}
                      </span>
                    )}
                    <span className="block font-sans tabular-nums tracking-tight text-[11px] opacity-90">
                      Prob. {day2.precipitationProbabilityMax}%{tomorrowPeakHour ? ` · Pico ${tomorrowPeakHour}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500 font-mono mt-1 block">
                    {day2 ? `${day2.dayName}: Sin lluvia` : 'Acumulado 2 días'}
                  </span>
                )}
              </div>

              {/* Lluvia 3 días */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                horizonte === '3d'
                  ? 'bg-purple-50/40 border-[#7300E1] ring-2 ring-[#7300E1]/15'
                  : 'bg-neutral-50/70 border-neutral-200/80'
              }`}>
                <span className="text-xs font-black text-neutral-600 uppercase tracking-wider block mb-1">
                  Lluvia 3 Días
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-neutral-900 font-mono tabular-nums">
                    {summary.lluvia3dMm.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-neutral-600">mm</span>
                </div>
                {day3 && day3HasRain ? (
                  <div className={`text-xs font-mono mt-1 leading-snug ${
                    day3.precipitationSumMm >= heavyThreshold ? 'text-amber-700 font-semibold' : 'text-[#0284c7] font-semibold'
                  }`}>
                    <span className="block">{day3.dayName}: +{day3.precipitationSumMm.toFixed(1)} mm</span>
                    {day3.inicioEstimado && (
                      <span className="block font-sans tabular-nums tracking-tight text-[11px] font-semibold">
                        {day3.inicioEstimado}
                      </span>
                    )}
                    <span className="block font-sans tabular-nums tracking-tight text-[11px] opacity-90">
                      Prob. {day3.precipitationProbabilityMax}%{day3.horaPico ? ` · Pico ${day3.horaPico}` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-500 font-mono mt-1 block">
                    {day3 ? `${day3.dayName}: Sin lluvia` : 'Horizonte 72 h'}
                  </span>
                )}
              </div>

              {/* Lluvia 7 días */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                horizonte === '7d'
                  ? 'bg-purple-50/40 border-[#7300E1] ring-2 ring-[#7300E1]/15'
                  : 'bg-neutral-50/70 border-neutral-200/80'
              }`}>
                <span className="text-xs font-black text-neutral-600 uppercase tracking-wider block mb-1">
                  Lluvia 7 Días
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-neutral-900 font-mono tabular-nums">
                    {summary.lluvia7dMm.toFixed(1)}
                  </span>
                  <span className="text-sm font-bold text-neutral-600">mm</span>
                </div>
                <span className="text-xs text-neutral-500 font-mono mt-1 block">
                  Semanal total
                </span>
              </div>

            </div>
          );
        })()}

        {/* Windows & Current Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-sm">
          
          {/* Risk Timing Windows */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
            <span className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide text-xs">
              <Clock className="w-4 h-4 text-[#7300E1]" />
              Ventanas Temporales Críticas
            </span>
            <div className="divide-y divide-neutral-200/70">
              <div className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-neutral-600">Inicio estimado:</span>
                {(() => {
                  const val = summary.inicioEstimadoLluvia || 'Sin lluvia (48 h)';
                  const toneClass =
                    val.includes('Muy fuerte') || val.includes('Fuerte')
                      ? 'font-black text-red-700'
                      : val.includes('Moderada')
                      ? 'font-bold text-amber-700'
                      : 'font-semibold text-neutral-500';
                  return (
                    <span className={`${toneClass} font-mono text-sm text-right leading-snug`}>
                      {val}
                    </span>
                  );
                })()}
              </div>
              <div className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-neutral-600">Franja pico (24 h):</span>
                <span className="font-bold text-neutral-950 font-mono text-sm text-right leading-snug">
                  {summary.franjaMayorRiesgo}
                </span>
              </div>
              <div className="py-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="text-xs font-medium text-neutral-600">Mayor lluvia (3 d):</span>
                <span className="font-bold text-neutral-950 font-mono text-sm text-right leading-snug">
                  {summary.diaMayorLluvia}
                </span>
              </div>
            </div>
          </div>

          {/* Current Microclimate */}
          <div className={`p-4 rounded-xl border space-y-2.5 transition-all ${
            horizonte === 'actual'
              ? 'bg-purple-50/40 border-[#7300E1] ring-2 ring-[#7300E1]/15'
              : 'bg-neutral-50 border-neutral-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide text-xs">
                <Compass className="w-4 h-4 text-[#7300E1]" />
                Condiciones Actuales en Sede
              </span>
              {horizonte === 'actual' && (
                <span className="text-[11px] font-mono font-bold text-[#0284c7] bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                  Ahora: {getCurrentLimaHourPrecip(summary).toFixed(1)} mm/h
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5 pt-1 text-center font-mono">
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                <Thermometer className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <span className="text-base font-bold text-neutral-900">{summary.temperaturaActualC}°C</span>
                <span className="text-xs text-neutral-500 block font-sans mt-0.5">Temp</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                <Droplets className="w-5 h-5 text-sky-500 mx-auto mb-1" />
                <span className="text-base font-bold text-neutral-900">{summary.humedadActualPct}%</span>
                <span className="text-xs text-neutral-500 block font-sans mt-0.5">Humedad</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200">
                <Wind className="w-5 h-5 text-teal-600 mx-auto mb-1" />
                <span className="text-base font-bold text-neutral-900">{summary.vientoActualKmH} <span className="text-xs">km/h</span></span>
                <span className="text-xs text-neutral-500 block font-sans mt-0.5">Viento</span>
              </div>
            </div>
          </div>

        </div>

        {/* Section 16: Lluvia Observada vs Pronosticada */}
        <div className="bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-neutral-200">
            <span className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-[#4ABFFF]" />
              Últimas 24 Horas: Observado vs Pronosticado
            </span>
            <span className="text-xs font-mono text-neutral-500">Control de Calidad</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center py-1.5">
            <div>
              <span className="text-xs text-neutral-600 block uppercase font-semibold">Lluvia Observada</span>
              <span className="text-xl font-black text-neutral-900 font-mono tabular-nums">
                {summary.lluviaObservada.observado24hMm.toFixed(1)} mm
              </span>
              <span className="text-xs text-neutral-500 block mt-0.5">Open-Meteo (Ayer 24h)</span>
            </div>
            <div>
              <span className="text-xs text-neutral-600 block uppercase font-semibold">Pronosticado Anterior</span>
              <span className="text-xl font-black text-neutral-700 font-mono tabular-nums">
                {summary.lluviaObservada.pronosticadoAnteriorMm !== null
                  ? `${summary.lluviaObservada.pronosticadoAnteriorMm.toFixed(1)} mm`
                  : 'N/D'}
              </span>
              <span className="text-xs text-neutral-500 block mt-0.5">Registro App (Ayer)</span>
            </div>
            <div>
              <span className="text-xs text-neutral-600 block uppercase font-semibold">Diferencia / Desvío</span>
              <span className={`text-xl font-black font-mono tabular-nums ${
                summary.lluviaObservada.diferenciaMm && Math.abs(summary.lluviaObservada.diferenciaMm) > 3
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}>
                {summary.lluviaObservada.diferenciaMm !== null
                  ? `${summary.lluviaObservada.diferenciaMm > 0 ? '+' : ''}${summary.lluviaObservada.diferenciaMm.toFixed(1)} mm`
                  : 'N/D'}
              </span>
              <span className="text-xs font-semibold text-neutral-600 block mt-0.5">
                {summary.lluviaObservada.evaluacionCalidad}
              </span>
            </div>
          </div>
        </div>

        {/* Section 17 & 18: SENAMHI Avisos & Nowcasting */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          
          {/* Avisos SENAMHI */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide text-xs">
                <BellRing className="w-4 h-4 text-amber-600" />
                Avisos Oficiales SENAMHI
              </span>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                Oficial
              </span>
            </div>

            {summary.avisoSenamhi ? (
              <div className="space-y-2 bg-white p-3.5 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-900 text-sm">{summary.avisoSenamhi.numero}</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-black uppercase ${
                    summary.avisoSenamhi.nivel === 'Rojo'
                      ? 'bg-red-600 text-white'
                      : summary.avisoSenamhi.nivel === 'Naranja'
                      ? 'bg-orange-500 text-white'
                      : 'bg-yellow-400 text-black'
                  }`}>
                    Nivel {summary.avisoSenamhi.nivel}
                  </span>
                </div>
                <p className="font-bold text-neutral-800 text-xs">{summary.avisoSenamhi.fenomeno}</p>
                <p className="text-xs text-neutral-600 leading-relaxed">{summary.avisoSenamhi.descripcion}</p>
                <div className="pt-2 border-t border-neutral-100 text-xs text-neutral-500 font-mono">
                  Vigencia: {summary.avisoSenamhi.inicio} al {summary.avisoSenamhi.fin}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-white rounded-lg border border-neutral-200 text-neutral-500 italic text-xs">
                Sin aviso SENAMHI verificable para esta ubicación.
              </div>
            )}
          </div>

          {/* Nowcasting SENAMHI */}
          <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-bold text-neutral-900 flex items-center gap-1.5 uppercase tracking-wide text-xs">
                <Radar className="w-4 h-4 text-[#7300E1]" />
                Nowcasting SENAMHI (0 - 2 h)
              </span>
              <span className="text-xs font-mono text-neutral-500">Corto Plazo</span>
            </div>

            {summary.nowcasting ? (
              <div className="space-y-2.5 bg-white p-3.5 rounded-lg border border-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-600 text-xs">Estado actual:</span>
                  <span className="font-bold text-neutral-950 text-sm">{summary.nowcasting.estadoActual}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600">+1 hora:</span>
                  <span className="font-semibold text-neutral-900">{summary.nowcasting.plus1h}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600">+2 horas:</span>
                  <span className="font-semibold text-neutral-900">{summary.nowcasting.plus2h}</span>
                </div>
                <div className="pt-1.5 text-xs text-neutral-500 font-mono">
                  Fuente: {summary.nowcasting.fuente}
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-white rounded-lg border border-neutral-200 text-neutral-500 italic text-xs">
                Condiciones normales en radar inmediato. Sin desarrollo convectivo crítico.
              </div>
            )}
          </div>

        </div>

        {/* Section 23: Traceability & Sources Footer */}
        <div className="pt-3.5 border-t border-neutral-200">
          <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-2.5">
            Trazabilidad de Fuentes Meteorológicas
          </div>
          <div className="space-y-2 text-xs text-neutral-700">
            {summary.fuentes.map((f, idx) => {
              let sourceUrl: string | null = null;
              if (f.nombre.includes('Open-Meteo')) {
                sourceUrl = `https://api.open-meteo.com/v1/forecast?latitude=${mall.latitud}&longitude=${mall.longitud}&hourly=precipitation,precipitation_probability,temperature_2m&daily=precipitation_sum&timezone=America%2FLima`;
              } else if (f.nombre.includes('SENAMHI')) {
                sourceUrl = 'https://www.senamhi.gob.pe/?p=aviso-meteorologico';
              } else if (f.nombre.includes('NASA')) {
                sourceUrl = 'https://gpm.nasa.gov/data/imerg';
              }

              return (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-800">· {f.nombre} ({f.tipo})</span>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7300E1] hover:underline font-bold text-xs inline-flex items-center gap-0.5 ml-1"
                        title="Verificar fuente original"
                      >
                        <span>[Verificar]</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <span className="font-mono text-xs text-neutral-500">{f.timestamp}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-950 leading-relaxed flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span><strong>Validación de Cobertura Pluviométrica:</strong> La consulta se ejecuta de forma geocentrada en las coordenadas físicas del centro comercial ({mall.direccion}). No se utilizan estaciones de aeropuertos alejados; el modelo interpola la columna atmosférica directamente sobre el predio de la sede.</span>
          </div>

          <p className="mt-3 text-xs text-neutral-500 italic">
            * {DISCLAIMER_REAL_PLAZA}
          </p>
        </div>

      </div>

    </div>
  );
};
