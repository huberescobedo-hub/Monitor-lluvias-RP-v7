import React, { useState } from 'react';
import { MallWeatherSummary, RiskLevel, TimeHorizon } from '../types';
import { getCurrentLimaHourPrecip, getNext24hRollingPrecip, getRemainingTodayPrecip, getFallenTodayPrecip } from '../utils/horizonMetrics';
import { ArrowUpDown, AlertTriangle, ShieldAlert, ShieldCheck, BellRing, MapPin } from 'lucide-react';

interface DataTableProps {
  summaries: MallWeatherSummary[];
  selectedMallId: string | null;
  onSelectMall: (mallId: string) => void;
  horizonte?: TimeHorizon;
}

type SortField = 'mall' | 'ciudad' | 'riesgo' | 'probabilidad' | 'lluvia24h' | 'lluvia48h' | 'lluvia3d' | 'lluvia7d' | 'senamhi';

const RISK_BADGES: Record<RiskLevel, { text: string; bg: string; dot: string; textClass: string }> = {
  'ALERTA': { text: 'Alerta', bg: 'bg-red-50', dot: 'bg-red-600', textClass: 'text-red-700' },
  'PREVENTIVO': { text: 'Preventivo', bg: 'bg-amber-50', dot: 'bg-[#F59E0B]', textClass: 'text-amber-800' },
  'VIGILANCIA': { text: 'Vigilancia', bg: 'bg-sky-50', dot: 'bg-sky-500', textClass: 'text-sky-800' },
  'NORMAL': { text: 'Normal', bg: 'bg-emerald-50', dot: 'bg-emerald-600', textClass: 'text-emerald-700' }
};

export const DataTable: React.FC<DataTableProps> = ({
  summaries,
  selectedMallId,
  onSelectMall,
  horizonte = '24h'
}) => {
  const [sortField, setSortField] = useState<SortField>('riesgo');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default descending for metrics
    }
  };

  const riskWeight: Record<RiskLevel, number> = {
    'ALERTA': 4,
    'PREVENTIVO': 3,
    'VIGILANCIA': 2,
    'NORMAL': 1
  };

  const sortedSummaries = [...summaries].sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case 'mall':
        diff = a.mall.nombre.localeCompare(b.mall.nombre);
        break;
      case 'ciudad':
        diff = a.mall.ciudad.localeCompare(b.mall.ciudad);
        break;
      case 'riesgo':
        diff = (riskWeight[a.riesgo] || 0) - (riskWeight[b.riesgo] || 0);
        if (diff === 0) diff = a.riesgoScore - b.riesgoScore;
        break;
      case 'probabilidad':
        diff = a.probabilidadMax24h - b.probabilidadMax24h;
        break;
      case 'lluvia24h':
        diff = getNext24hRollingPrecip(a) - getNext24hRollingPrecip(b);
        break;
      case 'lluvia48h':
        diff = a.lluvia48hMm - b.lluvia48hMm;
        break;
      case 'lluvia3d':
        diff = a.lluvia3dMm - b.lluvia3dMm;
        break;
      case 'lluvia7d':
        diff = a.lluvia7dMm - b.lluvia7dMm;
        break;
      case 'senamhi':
        diff = (a.avisoSenamhi ? 1 : 0) - (b.avisoSenamhi ? 1 : 0);
        break;
    }
    return sortAsc ? diff : -diff;
  });

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
      
      {/* Table Header */}
      <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-50/50">
        <div>
          <h3 className="font-bold text-base text-neutral-900 tracking-tight">
            Monitoreo Operativo de Sedes Real Plaza
          </h3>
          <p className="text-sm text-neutral-600">
            Haga clic sobre una sede para centrar en el mapa e inspeccionar el detalle técnico
          </p>
        </div>
        <span className="text-sm font-semibold text-neutral-500 font-mono">
          {sortedSummaries.length} sedes listadas
        </span>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-neutral-700">
          <thead className="bg-neutral-50 text-xs font-bold text-neutral-700 uppercase tracking-wider border-b border-neutral-200 select-none">
            <tr>
              <th className="py-3 px-4 cursor-pointer hover:text-neutral-900" onClick={() => handleSort('mall')}>
                <div className="flex items-center gap-1.5">
                  <span>Mall</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-neutral-900" onClick={() => handleSort('ciudad')}>
                <div className="flex items-center gap-1.5">
                  <span>Ciudad</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-neutral-900" onClick={() => handleSort('riesgo')}>
                <div className="flex items-center gap-1.5">
                  <span>Riesgo</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className="py-3 px-3 text-right cursor-pointer hover:text-neutral-900" onClick={() => handleSort('probabilidad')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Probabilidad</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className={`py-3 px-3 text-right cursor-pointer hover:text-neutral-900 ${horizonte === '24h' || horizonte === 'actual' ? 'bg-purple-50/70 text-[#7300E1]' : ''}`} onClick={() => handleSort('lluvia24h')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>{horizonte === 'actual' ? 'Ahora (mm/h)' : 'Próx. 24 h'}</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className={`py-3 px-3 text-right cursor-pointer hover:text-neutral-900 ${horizonte === '48h' ? 'bg-purple-50/70 text-[#7300E1]' : ''}`} onClick={() => handleSort('lluvia48h')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Lluvia 48 h</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className={`py-3 px-3 text-right cursor-pointer hover:text-neutral-900 ${horizonte === '3d' ? 'bg-purple-50/70 text-[#7300E1]' : ''}`} onClick={() => handleSort('lluvia3d')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Lluvia 3 d</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className={`py-3 px-3 text-right cursor-pointer hover:text-neutral-900 ${horizonte === '7d' ? 'bg-purple-50/70 text-[#7300E1]' : ''}`} onClick={() => handleSort('lluvia7d')}>
                <div className="flex items-center justify-end gap-1.5">
                  <span>Lluvia 7 días</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className="py-3 px-3">Mayor Riesgo</th>
              <th className="py-3 px-3 cursor-pointer hover:text-neutral-900" onClick={() => handleSort('senamhi')}>
                <div className="flex items-center gap-1.5">
                  <span>SENAMHI</span>
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Actualización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-medium text-sm">
            {sortedSummaries.map((summary) => {
              const mall = summary.mall;
              const isSelected = selectedMallId === mall.id;
              const badge = RISK_BADGES[summary.riesgo] || RISK_BADGES.NORMAL;

              return (
                <tr
                  key={mall.id}
                  onClick={() => onSelectMall(mall.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-purple-50/80 hover:bg-purple-50'
                      : 'hover:bg-neutral-50/80'
                  }`}
                >
                  {/* Mall Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-[#7300E1]' : 'bg-transparent'}`}></div>
                      <div>
                        <span className="font-bold text-neutral-900 block tracking-tight text-sm">
                          {mall.nombre}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-xs text-neutral-500 block font-normal">
                            {mall.direccion}
                          </span>
                          {summary.validacionEspacial?.esAnomaliaCorregida ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded" title={summary.validacionEspacial.mensajeDiagnostico}>
                              ⚖ Calibrado
                            </span>
                          ) : summary.validacionEspacial?.estado === 'VALIDADO' ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded" title={summary.validacionEspacial.mensajeDiagnostico}>
                              ✓ Validado
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Ciudad / Dept */}
                  <td className="py-3 px-3 text-neutral-700">
                    <span className="block font-semibold text-sm">{mall.ciudad}</span>
                    <span className="text-xs text-neutral-500 block">{mall.departamento}</span>
                  </td>

                  {/* Riesgo */}
                  <td className="py-3 px-3">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs sm:text-sm font-bold ${badge.bg} ${badge.textClass}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${badge.dot}`}></span>
                      <span>{badge.text}</span>
                    </div>
                  </td>

                  {/* Probabilidad */}
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-neutral-900 text-sm">
                    {summary.probabilidadMax24h}%
                  </td>

                  {/* Próx. 24h o Actual */}
                  <td className={`py-3 px-3 text-right font-mono tabular-nums font-bold text-sm ${
                    horizonte === '24h' || horizonte === 'actual' ? 'bg-purple-50/40 text-[#7300E1]' : 'text-[#0284c7]'
                  }`}>
                    {horizonte === 'actual' ? (
                      `${getCurrentLimaHourPrecip(summary).toFixed(1)} mm/h`
                    ) : (
                      <>
                        <span className="block">{getNext24hRollingPrecip(summary).toFixed(1)} mm</span>
                        {getFallenTodayPrecip(summary) >= 0.5 && (
                          <span className="block text-[11px] font-sans font-normal text-neutral-500">
                            Resta hoy: {getRemainingTodayPrecip(summary).toFixed(1)}
                          </span>
                        )}
                      </>
                    )}
                  </td>

                  {/* Lluvia 48h */}
                  <td className={`py-3 px-3 text-right font-mono tabular-nums text-sm ${
                    horizonte === '48h' ? 'bg-purple-50/40 font-bold text-[#7300E1]' : 'text-neutral-800'
                  }`}>
                    {summary.lluvia48hMm.toFixed(1)} mm
                  </td>

                  {/* Lluvia 3d */}
                  <td className={`py-3 px-3 text-right font-mono tabular-nums text-sm ${
                    horizonte === '3d' ? 'bg-purple-50/40 font-bold text-[#7300E1]' : 'text-neutral-800'
                  }`}>
                    {summary.lluvia3dMm.toFixed(1)} mm
                  </td>

                  {/* Lluvia 7d */}
                  <td className={`py-3 px-3 text-right font-mono tabular-nums text-sm ${
                    horizonte === '7d' ? 'bg-purple-50/40 font-bold text-[#7300E1]' : 'text-neutral-800'
                  }`}>
                    {summary.lluvia7dMm.toFixed(1)} mm
                  </td>

                  {/* Mayor riesgo */}
                  <td className="py-3 px-3 text-neutral-700 font-mono text-xs font-medium">
                    {summary.franjaMayorRiesgo}
                  </td>

                  {/* SENAMHI */}
                  <td className="py-3 px-3">
                    {summary.avisoSenamhi ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <span>⚠️</span>
                        <span>{summary.avisoSenamhi.numero}</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs">Sin aviso</span>
                    )}
                  </td>

                  {/* Actualización */}
                  <td className="py-3 px-4 text-right text-xs text-neutral-500 font-mono">
                    {summary.ultimaActualizacion.slice(11, 16)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
