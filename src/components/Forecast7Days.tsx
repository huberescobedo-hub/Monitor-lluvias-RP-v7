import React from 'react';
import { DailyForecast, RiskLevel } from '../types';
import { Cloud, CloudRain, CloudLightning, Sun, CloudSun } from 'lucide-react';

interface Forecast7DaysProps {
  daily: DailyForecast[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const RISK_BADGE: Record<RiskLevel, { text: string; dot: string; color: string }> = {
  'ALERTA': { text: 'Alerta', dot: 'bg-red-600', color: 'text-red-700' },
  'PREVENTIVO': { text: 'Preventivo', dot: 'bg-[#F59E0B]', color: 'text-amber-800' },
  'VIGILANCIA': { text: 'Vigilancia', dot: 'bg-sky-500', color: 'text-sky-800' },
  'NORMAL': { text: 'Normal', dot: 'bg-emerald-600', color: 'text-emerald-700' }
};

export const Forecast7Days: React.FC<Forecast7DaysProps> = ({
  daily,
  selectedDate,
  onSelectDate
}) => {
  if (!daily || daily.length === 0) {
    return (
      <div className="bg-white p-4 rounded-xl border border-neutral-200 text-center text-xs text-neutral-400">
        Pronóstico de 7 días no disponible para esta ubicación.
      </div>
    );
  }

  const renderWeatherIcon = (condition: DailyForecast['condition']) => {
    switch (condition) {
      case 'tormenta':
        return <CloudLightning className="w-6 h-6 text-purple-600" />;
      case 'lluvia_fuerte':
      case 'lluvia_moderada':
        return <CloudRain className="w-6 h-6 text-[#4ABFFF]" />;
      case 'lluvia_ligera':
        return <CloudRain className="w-6 h-6 text-[#4ABFFF]/80" />;
      case 'nublado':
        return <Cloud className="w-6 h-6 text-neutral-400" />;
      case 'parcial':
        return <CloudSun className="w-6 h-6 text-amber-500" />;
      case 'soleado':
      default:
        return <Sun className="w-6 h-6 text-[#FFC740]" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h3 className="font-bold text-base text-neutral-900 tracking-tight">
            Pronóstico Operativo de 7 Días
          </h3>
          <p className="text-sm text-neutral-600">
            Haga clic en cualquier día para inspeccionar el horizonte horario
          </p>
        </div>
        <span className="text-xs text-neutral-500 font-mono">Open-Meteo High-Res</span>
      </div>

      {/* 7 Horizontal Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {daily.map((day) => {
          const isSelected = selectedDate === day.date;
          const risk = RISK_BADGE[day.dailyRisk] || RISK_BADGE.NORMAL;

          return (
            <div
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              className={`flex flex-col items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer text-center ${
                isSelected
                  ? 'bg-purple-50/60 border-[#7300E1] ring-2 ring-[#7300E1]/30 shadow-xs'
                  : 'bg-neutral-50/50 hover:bg-neutral-50 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {/* Day Name */}
              <span className="text-sm font-bold uppercase tracking-wider text-neutral-800">
                {day.dayName}
              </span>

              {/* Weather Icon */}
              <div className="my-2">{renderWeatherIcon(day.condition)}</div>

              {/* Max Probability */}
              <div className="text-sm font-black text-[#7300E1] font-mono tabular-nums mb-1">
                {day.precipitationProbabilityMax}%
              </div>

              {/* Rain Accumulation */}
              <div className="flex items-baseline gap-0.5 text-sm font-bold text-neutral-900 font-mono tabular-nums">
                <span>{day.precipitationSumMm.toFixed(1)}</span>
                <span className="text-xs text-neutral-500 font-sans">mm</span>
              </div>

              {/* Temperature Min / Max */}
              <div className="text-xs text-neutral-600 font-semibold font-mono tabular-nums my-1">
                {day.temperatureMinC}° / {day.temperatureMaxC}°
              </div>

              {/* Risk Dot & Label */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${risk.dot}`}></span>
                <span className={`text-xs font-bold ${risk.color}`}>
                  {risk.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
