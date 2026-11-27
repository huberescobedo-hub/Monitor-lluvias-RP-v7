import React, { useState } from 'react';
import { HourlyForecast } from '../types';
import { Activity } from 'lucide-react';

interface Chart48HoursProps {
  hourly: HourlyForecast[];
  mallNombre: string;
}

export const Chart48Hours: React.FC<Chart48HoursProps> = ({ hourly, mallNombre }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showPrecip, setShowPrecip] = useState<boolean>(true);
  const [showProb, setShowProb] = useState<boolean>(true);
  const [showTemp, setShowTemp] = useState<boolean>(true);

  if (!hourly || hourly.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-neutral-200 text-center text-xs text-neutral-400">
        Detalle horario de 48 horas no disponible para esta sede.
      </div>
    );
  }

  const data = hourly.slice(0, 48);

  // Nice precipitation scale (mm/h) aligned with 3 gridlines (0, mid, max)
  const rawMaxRain = Math.max(...data.map((d) => d.precipitationMm), 0.5);
  let niceMaxRain = 2;
  if (rawMaxRain <= 2) niceMaxRain = 2;
  else if (rawMaxRain <= 4) niceMaxRain = 4;
  else if (rawMaxRain <= 6) niceMaxRain = 6;
  else if (rawMaxRain <= 10) niceMaxRain = 10;
  else if (rawMaxRain <= 20) niceMaxRain = 20;
  else niceMaxRain = Math.ceil(rawMaxRain / 10) * 10;

  const rainMid = niceMaxRain / 2;
  const formatRainTick = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

  // Nice temperature scale (°C) aligned with 3 gridlines (min, mid, max)
  const rawMinTemp = Math.min(...data.map((d) => d.temperatureC));
  const rawMaxTemp = Math.max(...data.map((d) => d.temperatureC));
  const niceMinTemp = Math.floor(rawMinTemp - 2);
  let niceMaxTemp = Math.ceil(rawMaxTemp + 2);
  if ((niceMaxTemp - niceMinTemp) % 2 !== 0) {
    niceMaxTemp += 1;
  }
  const tempRange = Math.max(niceMaxTemp - niceMinTemp, 4);
  const tempMid = niceMinTemp + tempRange / 2;

  // Identify current Lima hour index to mark "Ahora" on the 48h timeline
  let currentHourIdx = -1;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const dd = parts.find((p) => p.type === 'day')?.value || '';
    const mm = parts.find((p) => p.type === 'month')?.value || '';
    const hh = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
    const todayStr = `${dd}/${mm}`;
    currentHourIdx = data.findIndex(
      (h) => h.displayDate === todayStr && parseInt(h.displayTime.split(':')[0], 10) === hh
    );
  } catch {
    currentHourIdx = -1;
  }

  const chartHeight = 215;
  const chartWidth = 960;
  const paddingLeft = 56;
  const paddingRight = showProb && showTemp ? 86 : 54;
  const paddingTop = 26;
  const paddingBottom = 34;
  const effectiveWidth = chartWidth - paddingLeft - paddingRight;
  const effectiveHeight = chartHeight - paddingTop - paddingBottom;
  const colWidth = effectiveWidth / data.length;

  // Compute SVG Points for Probability Line (0% to 100%)
  const probPoints = data
    .map((d, i) => {
      const x = paddingLeft + i * colWidth + colWidth / 2;
      const y = paddingTop + effectiveHeight - (d.precipitationProbability / 100) * effectiveHeight;
      return `${x},${y}`;
    })
    .join(' ');

  // Compute SVG Points for Temperature Line (niceMinTemp to niceMaxTemp)
  const tempPoints = data
    .map((d, i) => {
      const x = paddingLeft + i * colWidth + colWidth / 2;
      const norm = Math.max(0, Math.min(1, (d.temperatureC - niceMinTemp) / tempRange));
      const y = paddingTop + effectiveHeight - norm * effectiveHeight;
      return `${x},${y}`;
    })
    .join(' ');

  const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4 shadow-xs">
      {/* Title & Interactive Legend Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 mb-2.5 border-b border-neutral-100 gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-neutral-900 tracking-tight">
              Evolución Meteorológica Horaria (48 Horas)
            </h3>
            <span className="text-sm font-bold text-[#7300E1]">· {mallNombre}</span>
          </div>
          <p className="text-sm text-neutral-600">
            Haga clic en las leyendas de la derecha para mostrar u ocultar cada variable
          </p>
        </div>

        {/* Clickable Toggle Legend */}
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold flex-wrap">
          <button
            type="button"
            onClick={() => setShowPrecip((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              showPrecip
                ? 'bg-sky-50 border-sky-300 text-sky-900 shadow-2xs'
                : 'bg-neutral-50 border-neutral-200 text-neutral-400 line-through opacity-70 hover:opacity-100'
            }`}
            title="Clic para mostrar/ocultar precipitación"
          >
            <span className={`w-3 h-3 rounded-xs ${showPrecip ? 'bg-[#0284c7]' : 'bg-neutral-300'}`}></span>
            <span>Precipitación (mm/h)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProb((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              showProb
                ? 'bg-purple-50 border-purple-300 text-[#7300E1] font-bold shadow-2xs'
                : 'bg-neutral-50 border-neutral-200 text-neutral-400 line-through opacity-70 hover:opacity-100'
            }`}
            title="Clic para mostrar/ocultar probabilidad"
          >
            <span className={`w-4 h-1 rounded-full ${showProb ? 'bg-[#7300E1]' : 'bg-neutral-300'}`}></span>
            <span>Probabilidad (%)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTemp((v) => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
              showTemp
                ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                : 'bg-neutral-50 border-neutral-200 text-neutral-400 line-through opacity-70 hover:opacity-100'
            }`}
            title="Clic para mostrar/ocultar temperatura"
          >
            <span
              className={`w-4 h-0.5 border-t-2 border-dashed ${
                showTemp ? 'border-amber-600' : 'border-neutral-300'
              }`}
            ></span>
            <span>Temp (°C)</span>
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[820px]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            {/* Horizontal Grid lines */}
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={chartWidth - paddingRight}
              y2={paddingTop}
              stroke="#ededed"
              strokeDasharray="3 3"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop + effectiveHeight / 2}
              x2={chartWidth - paddingRight}
              y2={paddingTop + effectiveHeight / 2}
              stroke="#ededed"
              strokeDasharray="3 3"
            />
            <line
              x1={paddingLeft}
              y1={paddingTop + effectiveHeight}
              x2={chartWidth - paddingRight}
              y2={paddingTop + effectiveHeight}
              stroke="#d4d4d4"
            />

            {/* LEFT Y-AXIS: Precipitation Scale (mm/h) */}
            {showPrecip && (
              <g>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop - 10}
                  textAnchor="end"
                  className="text-[10px] fill-[#0284c7] font-sans font-bold uppercase"
                >
                  mm/h
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + 4}
                  textAnchor="end"
                  className="text-[11px] fill-[#0284c7] font-mono font-bold"
                >
                  {formatRainTick(niceMaxRain)}
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + effectiveHeight / 2 + 4}
                  textAnchor="end"
                  className="text-[11px] fill-[#0284c7] font-mono font-semibold"
                >
                  {formatRainTick(rainMid)}
                </text>
                <text
                  x={paddingLeft - 8}
                  y={paddingTop + effectiveHeight + 4}
                  textAnchor="end"
                  className="text-[11px] fill-neutral-500 font-mono font-semibold"
                >
                  0
                </text>
              </g>
            )}

            {/* RIGHT Y-AXIS: Probability (%) & Temperature (°C) */}
            {showProb && (
              <g>
                <text
                  x={chartWidth - paddingRight + 8}
                  y={paddingTop - 10}
                  textAnchor="start"
                  className="text-[10px] fill-[#7300E1] font-sans font-bold uppercase"
                >
                  Prob
                </text>
                <text
                  x={chartWidth - paddingRight + 8}
                  y={paddingTop + 4}
                  textAnchor="start"
                  className="text-[11px] fill-[#7300E1] font-mono font-bold"
                >
                  100%
                </text>
                <text
                  x={chartWidth - paddingRight + 8}
                  y={paddingTop + effectiveHeight / 2 + 4}
                  textAnchor="start"
                  className="text-[11px] fill-[#7300E1] font-mono font-semibold"
                >
                  50%
                </text>
                <text
                  x={chartWidth - paddingRight + 8}
                  y={paddingTop + effectiveHeight + 4}
                  textAnchor="start"
                  className="text-[11px] fill-neutral-500 font-mono font-semibold"
                >
                  0%
                </text>
              </g>
            )}

            {showTemp && (
              <g>
                <text
                  x={chartWidth - paddingRight + (showProb ? 48 : 8)}
                  y={paddingTop - 10}
                  textAnchor="start"
                  className="text-[10px] fill-amber-700 font-sans font-bold uppercase"
                >
                  Temp
                </text>
                <text
                  x={chartWidth - paddingRight + (showProb ? 48 : 8)}
                  y={paddingTop + 4}
                  textAnchor="start"
                  className="text-[11px] fill-amber-700 font-mono font-bold"
                >
                  {niceMaxTemp}°
                </text>
                <text
                  x={chartWidth - paddingRight + (showProb ? 48 : 8)}
                  y={paddingTop + effectiveHeight / 2 + 4}
                  textAnchor="start"
                  className="text-[11px] fill-amber-700 font-mono font-semibold"
                >
                  {tempMid}°
                </text>
                <text
                  x={chartWidth - paddingRight + (showProb ? 48 : 8)}
                  y={paddingTop + effectiveHeight + 4}
                  textAnchor="start"
                  className="text-[11px] fill-neutral-500 font-mono font-semibold"
                >
                  {niceMinTemp}°
                </text>
              </g>
            )}

            {/* Current Lima Hour Marker ("Ahora") */}
            {currentHourIdx >= 0 && (
              <g>
                <line
                  x1={paddingLeft + currentHourIdx * colWidth + colWidth / 2}
                  y1={paddingTop}
                  x2={paddingLeft + currentHourIdx * colWidth + colWidth / 2}
                  y2={paddingTop + effectiveHeight}
                  stroke="#0284c7"
                  strokeWidth="1.25"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />
                <text
                  x={
                    currentHourIdx <= 2
                      ? paddingLeft + currentHourIdx * colWidth + 4
                      : paddingLeft + currentHourIdx * colWidth + colWidth / 2
                  }
                  y={paddingTop - 8}
                  textAnchor={currentHourIdx <= 2 ? 'start' : 'middle'}
                  className="text-[10px] fill-[#0284c7] font-sans font-bold"
                >
                  Ahora ({data[currentHourIdx].displayTime})
                </text>
              </g>
            )}

            {/* Bars for Precipitation mm/h (uniform sky blue, no orange blocks) */}
            {showPrecip &&
              data.map((d, i) => {
                if (d.precipitationMm <= 0) return null;
                const x = paddingLeft + i * colWidth + 2;
                const barW = Math.max(colWidth - 4, 3);
                const barH = Math.min(1, d.precipitationMm / niceMaxRain) * effectiveHeight;
                const y = paddingTop + effectiveHeight - barH;
                const isPast = currentHourIdx > 0 && i < currentHourIdx;

                return (
                  <rect
                    key={i}
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    fill="#38BDF8"
                    fillOpacity={isPast ? 0.45 : 0.9}
                    rx={2}
                    className="transition-all hover:opacity-80"
                  />
                );
              })}

            {/* Probability Line */}
            {showProb && (
              <polyline
                fill="none"
                stroke="#7300E1"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={probPoints}
              />
            )}

            {/* Temperature Line */}
            {showTemp && (
              <polyline
                fill="none"
                stroke="#D97706"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinejoin="round"
                points={tempPoints}
              />
            )}

            {/* Interactive hover overlays */}
            {data.map((d, i) => {
              const x = paddingLeft + i * colWidth;
              return (
                <rect
                  key={`hover-${i}`}
                  x={x}
                  y={0}
                  width={colWidth}
                  height={chartHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}

            {/* Active Hover Indicator Line */}
            {hoveredIndex !== null && (
              <g>
                <line
                  x1={paddingLeft + hoveredIndex * colWidth + colWidth / 2}
                  y1={paddingTop}
                  x2={paddingLeft + hoveredIndex * colWidth + colWidth / 2}
                  y2={paddingTop + effectiveHeight}
                  stroke="#7300E1"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                {showProb && (
                  <circle
                    cx={paddingLeft + hoveredIndex * colWidth + colWidth / 2}
                    cy={
                      paddingTop +
                      effectiveHeight -
                      (data[hoveredIndex].precipitationProbability / 100) * effectiveHeight
                    }
                    r={4}
                    fill="#7300E1"
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                )}
                {showTemp && (
                  <circle
                    cx={paddingLeft + hoveredIndex * colWidth + colWidth / 2}
                    cy={
                      paddingTop +
                      effectiveHeight -
                      Math.max(0, Math.min(1, (data[hoveredIndex].temperatureC - niceMinTemp) / tempRange)) *
                        effectiveHeight
                    }
                    r={4}
                    fill="#D97706"
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            )}

            {/* Bottom X-axis Time Markers (every 4 hours) */}
            {data.map((d, i) => {
              if (i % 4 !== 0) return null;
              const x = paddingLeft + i * colWidth + colWidth / 2;
              return (
                <g key={`time-${i}`}>
                  <text
                    x={x}
                    y={chartHeight - 4}
                    textAnchor="middle"
                    className="text-[11px] fill-neutral-700 font-mono font-bold"
                  >
                    {d.displayTime}
                  </text>
                  <text
                    x={x}
                    y={chartHeight - 16}
                    textAnchor="middle"
                    className="text-[10px] fill-neutral-500 font-mono font-medium"
                  >
                    {d.displayDate}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Interactive Tooltip Card */}
      <div className="mt-3.5 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
        {hoveredItem ? (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-neutral-900 font-mono text-base">
                {hoveredItem.displayDate} {hoveredItem.displayTime}
              </span>
              <span className="text-neutral-500 font-mono text-xs">(Hora Lima)</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-neutral-600">Precipitación:</span>
              <span className="font-black text-[#0284c7] font-mono tabular-nums text-base">
                {hoveredItem.precipitationMm.toFixed(1)} mm/h
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-neutral-600">Probabilidad:</span>
              <span className="font-black text-[#7300E1] font-mono tabular-nums text-base">
                {hoveredItem.precipitationProbability} %
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-neutral-600">Temperatura:</span>
              <span className="font-black text-amber-700 font-mono tabular-nums text-base">
                {hoveredItem.temperatureC} °C
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-neutral-600">Viento:</span>
              <span className="font-mono tabular-nums text-neutral-800 font-semibold">
                {hoveredItem.windSpeedKmH} km/h
              </span>
            </div>
          </div>
        ) : (
          <div className="text-neutral-600 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#7300E1]" />
            <span>Pase el cursor sobre el gráfico para ver el detalle hora a hora.</span>
          </div>
        )}

        <div className="text-xs text-neutral-500 font-mono shrink-0">
          Fuente: Open-Meteo High-Resolution Ensemble
        </div>
      </div>
    </div>
  );
};
