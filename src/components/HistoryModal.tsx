import React, { useEffect, useState } from 'react';
import { HistoricalForecastRecord } from '../types';
import { fetchHistoryRecords } from '../services/weatherService';
import { X, History, Download, Database, CheckCircle2 } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHistoricalAudit?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenHistoricalAudit
}) => {
  const [records, setRecords] = useState<HistoricalForecastRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchHistoryRecords()
        .then((data) => setRecords(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      'timestampConsulta',
      'mallId',
      'mallNombre',
      'fechaObjetivo',
      'probabilidadPrevista',
      'precipitacionPrevista',
      'precipitacionObservada',
      'avisoSenamhi',
      'nowcasting',
      'riesgoRP',
      'fuente'
    ];
    const rows = records.map((r) => [
      r.timestampConsulta,
      r.mallId,
      `"${r.mallNombre}"`,
      r.fechaObjetivo,
      r.probabilidadPrevista,
      r.precipitacionPrevista,
      r.precipitacionObservada ?? '',
      `"${r.avisoSenamhi || ''}"`,
      `"${r.nowcasting || ''}"`,
      r.riesgoRP,
      `"${r.fuente}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `real_plaza_historico_pronosticos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-[#7300E1]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900">
                Historial y Calibración: Pronóstico vs Real
              </h3>
              <p className="text-xs text-neutral-500">
                Repositorio de trazabilidad para validación del modelo predictivo por sede
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Quick link to Historical Precipitation Audit (15 de octubre, etc.) */}
          {onOpenHistoricalAudit && (
            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📅</span>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">
                    ¿Deseas auditar fechas pasadas específicas (ej: 15 de octubre)?
                  </h4>
                  <p className="text-[11px] text-neutral-600">
                    Accede a la telemetría histórica por azotea comercial y desglose horario de 24h.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenHistoricalAudit();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7300E1] text-white hover:bg-[#5e00b8] transition cursor-pointer shadow-xs shrink-0"
              >
                Abrir Auditoría de Días Pasados →
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-neutral-400">
              Cargando registros históricos de persistencia...
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              Sin registros en la sesión actual. Al consultar pronósticos se registran automáticamente.
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-[10px] font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-200">
                  <tr>
                    <th className="py-2.5 px-3">Consulta</th>
                    <th className="py-2.5 px-3">Sede</th>
                    <th className="py-2.5 px-3">Fecha Obj.</th>
                    <th className="py-2.5 px-3 text-right">Prob. (%)</th>
                    <th className="py-2.5 px-3 text-right">Previsto (mm)</th>
                    <th className="py-2.5 px-3 text-right">Observado (mm)</th>
                    <th className="py-2.5 px-3">Riesgo RP</th>
                    <th className="py-2.5 px-3">Aviso SENAMHI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono text-[11px]">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/70">
                      <td className="py-2 px-3 text-neutral-500">{r.timestampConsulta}</td>
                      <td className="py-2 px-3 font-sans font-bold text-neutral-900">{r.mallNombre}</td>
                      <td className="py-2 px-3 text-neutral-600">{r.fechaObjetivo}</td>
                      <td className="py-2 px-3 text-right text-[#7300E1] font-bold">{r.probabilidadPrevista}%</td>
                      <td className="py-2 px-3 text-right text-[#0284c7] font-bold">{r.precipitacionPrevista.toFixed(1)}</td>
                      <td className="py-2 px-3 text-right text-neutral-800">
                        {r.precipitacionObservada !== null ? r.precipitacionObservada.toFixed(1) : 'Pendiente'}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.riesgoRP === 'ALERTA'
                            ? 'bg-red-100 text-red-800'
                            : r.riesgoRP === 'PREVENTIVO'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {r.riesgoRP}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-neutral-500 font-sans">{r.avisoSenamhi || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500 flex justify-between items-center">
          <span>Persistencia lista para Firestore / PostgreSQL en entorno corporativo Real Plaza.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
