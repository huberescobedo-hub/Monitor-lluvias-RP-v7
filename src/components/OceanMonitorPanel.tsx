import React, { useEffect, useState } from 'react';
import { OceanAnomalyData } from '../types';
import { fetchOceanAnomaly } from '../services/weatherService';
import { X, Waves, ExternalLink, ShieldAlert, Thermometer, Info } from 'lucide-react';

interface OceanMonitorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OceanMonitorPanel: React.FC<OceanMonitorPanelProps> = ({ isOpen, onClose }) => {
  const [oceanData, setOceanData] = useState<OceanAnomalyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchOceanAnomaly()
        .then((data) => setOceanData(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-[#4ABFFF]">
              <Waves className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-neutral-900">
                Monitoreo Océano-Atmosférico ENFEN / Niño 1+2
              </h3>
              <p className="text-xs text-neutral-500">
                Condiciones macroclimáticas en el Pacífico Oriental frente a la Costa del Perú
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-neutral-700">
          {loading ? (
            <div className="py-10 text-center text-neutral-400">
              Consultando datos oceanográficos...
            </div>
          ) : oceanData ? (
            <>
              {/* ENFEN Official Alert Banner */}
              <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-amber-950">
                      {oceanData.estadoAlertaEnfen}
                    </span>
                    <span className="text-[10px] font-mono bg-amber-200/60 text-amber-900 px-2 py-0.5 rounded font-bold">
                      {oceanData.comunicadoEnfen}
                    </span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Comisión Multisectorial encargada del Estudio Nacional del Fenómeno El Niño (ENFEN).
                    Vigente desde: {oceanData.fechaComunicado}.
                  </p>
                </div>
              </div>

              {/* Sea Surface Temp & Anomaly Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                
                {/* Niño 1+2 (Costa del Perú / Ecuador) */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Región Niño 1+2 (Costa Norte Perú)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl font-black font-mono tabular-nums text-neutral-900">
                      {oceanData.temperaturaNino12.toFixed(1)} °C
                    </span>
                    <span className={`text-xs font-bold font-mono ${
                      oceanData.anomaliaNino12 > 0 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {oceanData.anomaliaNino12 > 0 ? '+' : ''}{oceanData.anomaliaNino12.toFixed(1)} °C anom.
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block">
                    Semana calculada: {oceanData.semana}
                  </span>
                </div>

                {/* Niño 3.4 (Pacífico Central) */}
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/60">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Región Niño 3.4 (Pacífico Central)
                  </span>
                  <div className="flex items-baseline gap-2 my-1">
                    <span className="text-2xl font-black font-mono tabular-nums text-neutral-900">
                      {oceanData.temperaturaNino34.toFixed(1)} °C
                    </span>
                    <span className={`text-xs font-bold font-mono ${
                      oceanData.anomaliaNino34 > 0 ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {oceanData.anomaliaNino34 > 0 ? '+' : ''}{oceanData.anomaliaNino34.toFixed(1)} °C anom.
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400 block">
                    Semana calculada: {oceanData.semana}
                  </span>
                </div>

              </div>

              {/* Data Attribution & Provenance */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
                <span className="font-bold text-neutral-800 flex items-center gap-1.5 uppercase text-[10px]">
                  <Info className="w-3.5 h-3.5 text-neutral-500" />
                  Procedencia de Datos
                </span>
                <p className="text-[11px] text-neutral-600">
                  • <strong>Fuente primaria oficial:</strong> Comisión Multisectorial ENFEN (Instituto del Mar del Perú - IMARPE / SENAMHI / DHN).
                </p>
                <p className="text-[11px] text-neutral-600">
                  • <strong>Recurso de consulta:</strong> {oceanData.fuente}.
                </p>
                <p className="text-[11px] text-neutral-500 italic pt-1">
                  * Estos datos proporcionan contexto de gran escala para la vigilancia de lluvias extraordinarias en la Costa Norte y Central.
                </p>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-neutral-400">
              Fuente de datos oceanográficos temporalmente no disponible.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 bg-neutral-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#7300E1] text-white rounded-lg text-xs font-bold hover:bg-[#5e00b8] transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
