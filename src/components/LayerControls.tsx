import React from 'react';
import { Layers, Eye, EyeOff, Info } from 'lucide-react';

export interface LayerState {
  mallsRealPlaza: boolean;
  lluviaObservada24h: boolean;
  lluviaEsperada24h: boolean;
  lluviaEsperada3d: boolean;
  avisosSenamhi: boolean;
  emergenciasClimaticas: boolean;
  temperaturaMar: boolean;
  zonaNino12: boolean;
}

interface LayerControlsProps {
  layers: LayerState;
  onToggleLayer: (layerName: keyof LayerState) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layers,
  onToggleLayer,
  isOpen,
  onToggleOpen
}) => {
  return (
    <div className="absolute top-4 right-4 z-[500]">
      {/* Floating Toggle Button */}
      <button
        onClick={onToggleOpen}
        className="flex items-center gap-2 bg-white/95 hover:bg-white text-neutral-800 px-3.5 py-2 rounded-lg shadow-md border border-neutral-200 text-sm font-bold transition-all cursor-pointer backdrop-blur-xs"
        title="Capas del mapa meteorológico"
      >
        <Layers className="w-4 h-4 text-[#7300E1]" />
        <span>Capas ({Object.values(layers).filter(Boolean).length})</span>
      </button>

      {/* Layer Selection Dropdown Popover */}
      {isOpen && (
        <div className="mt-2 w-80 bg-white rounded-xl shadow-xl border border-neutral-200 p-3.5 text-sm text-neutral-800 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-100">
            <span className="font-bold text-neutral-900 flex items-center gap-1.5 text-sm">
              <Layers className="w-4 h-4 text-[#7300E1]" />
              Capas Meteorológicas
            </span>
            <span className="text-xs text-neutral-500 font-mono">Control Visual</span>
          </div>

          <div className="space-y-2">
            {/* 1. Malls Real Plaza */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.mallsRealPlaza}
                  onChange={() => onToggleLayer('mallsRealPlaza')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="font-bold text-neutral-900 text-sm">Malls Real Plaza</span>
              </div>
              <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded">
                Activa
              </span>
            </label>

            {/* 2. Lluvia Observada 24h */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.lluviaObservada24h}
                  onChange={() => onToggleLayer('lluviaObservada24h')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="text-sm">Lluvia observada 24 h</span>
              </div>
              <span className="text-xs text-neutral-600 font-medium">NASA IMERG</span>
            </label>

            {/* 3. Lluvia Esperada 24h */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.lluviaEsperada24h}
                  onChange={() => onToggleLayer('lluviaEsperada24h')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="font-semibold text-neutral-900 text-sm">Lluvia esperada 24 h</span>
              </div>
              <span className="text-xs text-neutral-600 font-medium">Open-Meteo</span>
            </label>

            {/* 4. Lluvia Esperada 3 días */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.lluviaEsperada3d}
                  onChange={() => onToggleLayer('lluviaEsperada3d')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="text-sm">Lluvia esperada 3 días</span>
              </div>
              <span className="text-xs text-neutral-600 font-medium">72 h</span>
            </label>

            {/* 5. Avisos SENAMHI */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.avisosSenamhi}
                  onChange={() => onToggleLayer('avisosSenamhi')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="font-bold text-neutral-900 text-sm">Avisos SENAMHI</span>
              </div>
              <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Oficial
              </span>
            </label>

            {/* 6. Emergencias climáticas */}
            <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={layers.emergenciasClimaticas}
                  onChange={() => onToggleLayer('emergenciasClimaticas')}
                  className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                />
                <span className="text-sm">Emergencias climáticas</span>
              </div>
              <span className="text-xs text-neutral-500 italic">Fuente pendiente</span>
            </label>

            <div className="pt-2.5 mt-2 border-t border-neutral-100">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
                Capas Océano-Atmosféricas
              </span>

              {/* 7. Temperatura del mar */}
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={layers.temperaturaMar}
                    onChange={() => onToggleLayer('temperaturaMar')}
                    className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                  />
                  <span className="text-sm">Temperatura del mar</span>
                </div>
                <span className="text-xs text-blue-700 font-bold">ENFEN</span>
              </label>

              {/* 8. Zona Niño 1+2 */}
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={layers.zonaNino12}
                    onChange={() => onToggleLayer('zonaNino12')}
                    className="rounded text-[#7300E1] focus:ring-[#7300E1] w-4 h-4"
                  />
                  <span className="text-sm">Polígono Niño 1+2</span>
                </div>
                <span className="text-xs text-blue-700 font-bold">Observatorio</span>
              </label>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-neutral-100 flex items-start gap-1.5 text-xs text-neutral-600">
            <Info className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
            <span>Capas geográficas de referencia para monitoreo preventivo en Perú.</span>
          </div>
        </div>
      )}
    </div>
  );
};
