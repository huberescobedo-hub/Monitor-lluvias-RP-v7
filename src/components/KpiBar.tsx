import React from 'react';
import { Building2, AlertTriangle, ShieldAlert, BellRing, CloudRain } from 'lucide-react';
import { MallWeatherSummary, TimeHorizon } from '../types';
import { getHorizonMetric, getRemainingTodayPrecip, getFallenTodayPrecip } from '../utils/horizonMetrics';

interface KpiBarProps {
  summaries: MallWeatherSummary[];
  horizonte?: TimeHorizon;
  onSelectKpiFilter?: (type: 'ALL' | 'ALERTA' | 'PREVENTIVO' | 'SENAMHI') => void;
  activeFilter?: string;
}

export const KpiBar: React.FC<KpiBarProps> = ({
  summaries,
  horizonte = '24h',
  onSelectKpiFilter,
  activeFilter
}) => {
  const totalMalls = summaries.length;
  const alertaCount = summaries.filter(s => s.riesgo === 'ALERTA').length;
  const preventivoCount = summaries.filter(s => s.riesgo === 'PREVENTIVO').length;
  const avisoSenamhiCount = summaries.filter(s => s.avisoSenamhi !== null).length;

  // Find max rain mall in active horizon
  let maxRainMall = summaries[0];
  let maxRainVal = 0;
  let maxRainUnit: 'mm' | 'mm/h' = horizonte === 'actual' ? 'mm/h' : 'mm';
  let horizonTitle = horizonte === '24h' ? 'Mayor Lluvia Próx. 24h' : `Mayor Lluvia ${horizonte}`;
  summaries.forEach(s => {
    const m = getHorizonMetric(s, horizonte);
    horizonTitle = `Mayor Lluvia ${m.compactTag}`;
    if (m.value > maxRainVal) {
      maxRainVal = m.value;
      maxRainUnit = m.unit;
      maxRainMall = s;
    }
  });
  if (summaries.length === 0) {
    horizonTitle = horizonte === 'actual' ? 'Mayor Lluvia Actual' : horizonte === '24h' ? 'Mayor Lluvia Próx. 24h' : `Mayor Lluvia ${horizonte}`;
  }
  const maxMallRemaining = maxRainMall ? getRemainingTodayPrecip(maxRainMall) : 0;
  const maxMallFallen = maxRainMall ? getFallenTodayPrecip(maxRainMall) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      
      {/* 1. Malls Monitoreados */}
      <div 
        onClick={() => onSelectKpiFilter && onSelectKpiFilter('ALL')}
        className={`bg-white rounded-xl p-4 sm:p-4.5 border transition-all cursor-pointer ${
          activeFilter === 'ALL'
            ? 'border-[#7300E1] ring-2 ring-[#7300E1]/20 shadow-sm'
            : 'border-neutral-200 hover:border-neutral-300 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between text-neutral-600 mb-2">
          <span className="text-sm font-black tracking-wider uppercase">Malls Monitoreados</span>
          <Building2 className="w-5 h-5 text-[#7300E1]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-black text-neutral-900 font-mono tabular-nums">
            {totalMalls}
          </span>
          <span className="text-sm text-neutral-600 font-bold">sedes operativas</span>
        </div>
      </div>

      {/* 2. Alerta */}
      <div 
        onClick={() => onSelectKpiFilter && onSelectKpiFilter('ALERTA')}
        className={`bg-white rounded-xl p-4 sm:p-4.5 border transition-all cursor-pointer ${
          alertaCount > 0 ? 'border-red-300 bg-red-50/20' : 'border-neutral-200'
        } ${activeFilter === 'ALERTA' ? 'ring-2 ring-red-400 border-red-500 shadow-sm' : 'hover:border-red-300 shadow-xs'}`}
      >
        <div className="flex items-center justify-between text-red-700 mb-2">
          <span className="text-sm font-black tracking-wider uppercase flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-600 inline-block animate-pulse"></span>
            Alerta Crítica
          </span>
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${alertaCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
            {alertaCount}
          </span>
          <span className="text-sm text-neutral-600 font-bold">sedes en riesgo alto</span>
        </div>
      </div>

      {/* 3. Preventivo */}
      <div 
        onClick={() => onSelectKpiFilter && onSelectKpiFilter('PREVENTIVO')}
        className={`bg-white rounded-xl p-4 sm:p-4.5 border transition-all cursor-pointer ${
          preventivoCount > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-neutral-200'
        } ${activeFilter === 'PREVENTIVO' ? 'ring-2 ring-amber-400 border-amber-500 shadow-sm' : 'hover:border-amber-300 shadow-xs'}`}
      >
        <div className="flex items-center justify-between text-amber-800 mb-2">
          <span className="text-sm font-black tracking-wider uppercase flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block"></span>
            Preventivo
          </span>
          <ShieldAlert className="w-5 h-5 text-[#F59E0B]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl sm:text-4xl font-black font-mono tabular-nums ${preventivoCount > 0 ? 'text-amber-600' : 'text-neutral-900'}`}>
            {preventivoCount}
          </span>
          <span className="text-sm text-neutral-600 font-bold">atención preventiva</span>
        </div>
      </div>

      {/* 4. Aviso SENAMHI */}
      <div 
        onClick={() => onSelectKpiFilter && onSelectKpiFilter('SENAMHI')}
        className={`bg-white rounded-xl p-4 sm:p-4.5 border transition-all cursor-pointer ${
          avisoSenamhiCount > 0 ? 'border-amber-300 bg-amber-50/20' : 'border-neutral-200'
        } ${activeFilter === 'SENAMHI' ? 'ring-2 ring-amber-400 border-amber-500 shadow-sm' : 'hover:border-amber-300 shadow-xs'}`}
      >
        <div className="flex items-center justify-between text-amber-800 mb-2">
          <span className="text-sm font-black tracking-wider uppercase flex items-center gap-1.5">
            <span className="text-amber-600 text-base font-bold">⚠️</span>
            Aviso SENAMHI
          </span>
          <BellRing className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-black text-neutral-900 font-mono tabular-nums">
            {avisoSenamhiCount}
          </span>
          <span className="text-sm text-neutral-600 font-bold">con aviso oficial</span>
        </div>
      </div>

      {/* 5. Mayor Lluvia por Horizonte */}
      <div className="col-span-2 sm:col-span-1 bg-white rounded-xl p-4 sm:p-4.5 border border-neutral-200 shadow-xs hover:border-[#4ABFFF] transition-all">
        <div className="flex items-center justify-between text-[#0284c7] mb-2">
          <span className="text-sm font-black tracking-wider uppercase flex items-center gap-1.5">
            <CloudRain className="w-5 h-5 text-[#4ABFFF]" />
            {horizonTitle}
          </span>
          <span className="text-xs text-neutral-400 font-mono">Open-Meteo</span>
        </div>
        <div className="flex items-baseline justify-between gap-1.5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-neutral-900 font-mono tabular-nums">
              {maxRainVal.toFixed(1)}
            </span>
            <span className="text-base font-bold text-neutral-600">{maxRainUnit}</span>
          </div>
          <span className="text-base font-extrabold text-[#7300E1] truncate max-w-[140px]">
            {maxRainMall?.mall?.nombreCorto || 'N/D'}
          </span>
        </div>
        {horizonte === '24h' && maxRainMall && maxMallFallen >= 0.5 && (
          <span className="text-[11px] text-neutral-500 font-sans tabular-nums mt-1 block">
            Resta hoy: {maxMallRemaining.toFixed(1)} mm · Día: {maxRainMall.lluvia24hMm.toFixed(1)} mm
          </span>
        )}
      </div>

    </div>
  );
};
