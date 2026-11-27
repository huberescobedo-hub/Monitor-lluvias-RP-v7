import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MallWeatherSummary, RiskLevel, TimeHorizon } from '../types';
import { getHorizonMetric, getRemainingTodayPrecip, getNext24hRollingPrecip } from '../utils/horizonMetrics';
import { LayerState } from './LayerControls';
import { Maximize2, Minimize2, MapPin, Compass } from 'lucide-react';

interface MapComponentProps {
  summaries: MallWeatherSummary[];
  selectedMallId: string | null;
  onSelectMall: (mallId: string) => void;
  onResetToNational: () => void;
  layers: LayerState;
  horizonte?: TimeHorizon;
}

const RISK_COLOR_MAP: Record<RiskLevel, { hex: string; bgClass: string; label: string }> = {
  'ALERTA': { hex: '#DC2626', bgClass: 'bg-red-600', label: 'ALERTA' },
  'PREVENTIVO': { hex: '#F59E0B', bgClass: 'bg-amber-500', label: 'PREVENTIVO' },
  'VIGILANCIA': { hex: '#0284C7', bgClass: 'bg-sky-500', label: 'VIGILANCIA' },
  'NORMAL': { hex: '#10B981', bgClass: 'bg-emerald-600', label: 'NORMAL' }
};

// Dispersed coordinates for Lima malls when zoomed out (zoom < 11)
// Staggered in two vertical columns in the Pacific Ocean west of Lima
// Massive spacing of ~0.85° latitude between each node in a column, guaranteeing ZERO overlap
const LIMA_CALLOUT_OFFSETS: Record<string, { lat: number; lon: number; label: string; arrowDir: string }> = {
  // Columna Externa (Océano profundo, lon ~ -78.95)
  'rp-pro': { lat: -11.00, lon: -78.95, label: 'RP Pro (Norte)', arrowDir: '↘' },
  'rp-salaverry': { lat: -11.85, lon: -79.05, label: 'RP Salaverry', arrowDir: '→' },
  'rp-puruchuco': { lat: -12.70, lon: -79.05, label: 'RP Puruchuco (Ate)', arrowDir: '↗' },
  'rp-guardia-civil': { lat: -13.55, lon: -78.95, label: 'RP Guardia Civil', arrowDir: '↗' },

  // Columna Intermedia (Mar medio, lon ~ -78.05)
  'rp-centro-civico': { lat: -11.42, lon: -78.05, label: 'RP Centro Cívico', arrowDir: '→' },
  'rp-primavera': { lat: -12.27, lon: -78.10, label: 'RP Primavera', arrowDir: '↗' },
  'rp-santa-clara': { lat: -13.12, lon: -78.05, label: 'RP Santa Clara', arrowDir: '↗' },
  'rp-villa-maria': { lat: -13.97, lon: -77.95, label: 'RP Villa María', arrowDir: '↗' }
};

export const MapComponent: React.FC<MapComponentProps> = ({
  summaries,
  selectedMallId,
  onSelectMall,
  onResetToNational,
  layers,
  horizonte = '24h'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const linesLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);
  const markerLookupRef = useRef<Map<string, L.Marker>>(new Map());

  // Allow user to toggle height expansion
  const [isTallMode, setIsTallMode] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(6);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered on Peru
    const map = L.map(mapContainerRef.current, {
      center: [-9.19, -75.0152],
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: false
    });

    // Clean OpenStreetMap Standard Tiles (Zero key required, zero watermarks)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    polygonsLayerRef.current = L.layerGroup().addTo(map);
    linesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Layers (Niño 1+2 polygon & Senamhi zones)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polyGroup = polygonsLayerRef.current;
    if (!map || !polyGroup) return;

    polyGroup.clearLayers();

    // 1. Niño 1+2 Ocean Polygon
    if (layers.zonaNino12) {
      const nino12Polygon = L.polygon([
        [0, -90],
        [0, -80],
        [-10, -80],
        [-10, -90]
      ], {
        color: '#4ABFFF',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#4ABFFF',
        fillOpacity: 0.12
      }).bindTooltip('Zona Niño 1+2 (ENFEN / Costa Perú)', { sticky: true });
      polyGroup.addLayer(nino12Polygon);
    }

    // 2. Avisos SENAMHI Zone
    if (layers.avisosSenamhi) {
      const avisoNorte = L.polygon([
        [-3.4, -81.2],
        [-3.4, -79.5],
        [-8.5, -78.0],
        [-8.5, -79.5],
        [-6.0, -81.2]
      ], {
        color: '#EA580C',
        weight: 1.5,
        fillColor: '#EA580C',
        fillOpacity: 0.08,
        dashArray: '4, 4'
      }).bindTooltip('Aviso SENAMHI N° 285: Precipitaciones Costa y Sierra Norte', { sticky: true });
      polyGroup.addLayer(avisoNorte);
    }
  }, [layers]);

  // Update Real Plaza Markers with Anti-Overlap Logic for Lima
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markersLayerRef.current;
    const lineGroup = linesLayerRef.current;
    if (!map || !markerGroup || !lineGroup) return;

    markerGroup.clearLayers();
    lineGroup.clearLayers();
    markerLookupRef.current.clear();

    if (!layers.mallsRealPlaza) return;

    const zoom = map.getZoom();
    const useLimaCallouts = zoom < 11; // When zoomed out, use callout lines to prevent overlap in Lima

    summaries.forEach((summary) => {
      const mall = summary.mall;
      if (mall.latitud === null || mall.longitud === null) return;

      const riskInfo = RISK_COLOR_MAP[summary.riesgo] || RISK_COLOR_MAP.NORMAL;
      const isSelected = selectedMallId === mall.id;
      const isCritical = summary.riesgo === 'ALERTA' || summary.riesgo === 'PREVENTIVO';
      const isLimaMall = mall.departamento.toLowerCase() === 'lima' && LIMA_CALLOUT_OFFSETS[mall.id];

      // Position logic:
      // If Lima mall and zoom < 11 -> position at callout offset, and draw line to physical ground coordinate
      let markerLat = mall.latitud;
      let markerLon = mall.longitud;
      const callout = isLimaMall && useLimaCallouts ? LIMA_CALLOUT_OFFSETS[mall.id] : null;

      if (callout) {
        markerLat = callout.lat;
        markerLon = callout.lon;

        // 1. Draw Ground Anchor Dot on actual building rooftop
        const groundDot = L.circleMarker([mall.latitud, mall.longitud], {
          radius: 4,
          color: riskInfo.hex,
          fillColor: '#FFFFFF',
          fillOpacity: 0.9,
          weight: 2
        }).bindTooltip(`${mall.nombreCorto} (Predio Exacto)`, { direction: 'top' });

        groundDot.on('click', () => onSelectMall(mall.id));
        lineGroup.addLayer(groundDot);

        // 2. Draw Leader Line from callout marker to ground anchor
        const leaderLine = L.polyline(
          [
            [callout.lat, callout.lon],
            [mall.latitud, mall.longitud]
          ],
          {
            color: isSelected ? '#7300E1' : riskInfo.hex,
            weight: isSelected ? 2.5 : 1.5,
            dashArray: '4, 4',
            opacity: isSelected ? 1 : 0.75
          }
        );
        lineGroup.addLayer(leaderLine);
      }

      // Marker HTML
      const pulseHtml = isCritical
        ? `<div class="absolute -inset-2 rounded-full animate-ping opacity-35" style="background-color: ${riskInfo.hex}"></div>`
        : '';

      let markerHtml = '';

      const hzMetric = getHorizonMetric(summary, horizonte);
      const actualMetric = getHorizonMetric(summary, 'actual');

      if (callout) {
        // Dispersed Lima Callout Badge with directional arrow
        markerHtml = `
          <div class="relative flex items-center gap-1.5 bg-white/95 text-neutral-900 border ${
            isSelected ? 'border-[#7300E1] ring-3 ring-[#FFC740] shadow-lg' : 'border-neutral-300 shadow-md'
          } rounded-full py-0.5 px-2.5 cursor-pointer transition-transform hover:scale-105 whitespace-nowrap">
            <div class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0" style="background-color: ${riskInfo.hex}">
              RP
            </div>
            <span class="text-xs font-bold text-neutral-900">${callout.label}</span>
            <span class="text-[11px] font-bold text-[#0284c7] font-mono">${hzMetric.pinText}</span>
            <span class="text-xs font-bold text-neutral-400 font-sans" title="Señala al predio exacto">${callout.arrowDir}</span>
          </div>
        `;
      } else {
        // Standard National Pin Marker
        const showPinValue = hzMetric.value > 0 || horizonte === 'actual';
        markerHtml = `
          <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
            ${pulseHtml}
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md border-2 ${
              isSelected ? 'border-[#7300E1] ring-3 ring-[#FFC740] scale-125 z-50' : 'border-white'
            }" style="background-color: ${riskInfo.hex}">
              <span class="text-xs font-black tracking-tighter">RP</span>
            </div>
            ${
              layers.lluviaEsperada24h && showPinValue
                ? `<div class="absolute -bottom-4 bg-white/95 text-neutral-900 border ${
                    horizonte !== '24h' ? 'border-[#7300E1]/50 text-[#7300E1]' : 'border-neutral-300'
                  } font-mono font-bold text-[10px] px-1.5 py-0.2 rounded shadow-xs whitespace-nowrap">
                    ${hzMetric.pinText}
                  </div>`
                : ''
            }
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'real-plaza-custom-marker',
        iconSize: callout ? [145, 28] : [36, 36],
        iconAnchor: callout ? [72, 14] : [18, 18],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([markerLat, markerLon], { icon: customIcon });

      // Popup with exact physical address and GPS verification
      const popupHtml = `
        <div class="p-1 font-sans text-neutral-900 max-w-[280px]">
          <div class="border-b border-neutral-200 pb-1.5 mb-2">
            <span class="font-black text-base text-[#7300E1] tracking-tight block">${mall.nombre.toUpperCase()}</span>
            <span class="text-xs text-neutral-600 font-medium block truncate mt-0.5">${mall.direccion}</span>
          </div>
          
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${riskInfo.hex}"></span>
              <span class="text-sm font-black tracking-wide" style="color: ${riskInfo.hex}">${riskInfo.label}</span>
            </div>
            <span class="text-xs font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded font-bold">GPS: ${mall.latitud.toFixed(4)}, ${mall.longitud.toFixed(4)}</span>
          </div>

          <div class="space-y-1.5 text-sm text-neutral-800 font-mono tabular-nums bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 mb-2.5">
            <div class="flex justify-between">
              <span class="text-neutral-600 font-sans">🌧 Probabilidad:</span>
              <span class="font-bold">${summary.probabilidadMax24h} %</span>
            </div>
            <div class="flex justify-between ${horizonte === 'actual' ? 'text-[#7300E1] font-black' : ''}">
              <span class="${horizonte === 'actual' ? 'text-[#7300E1]' : 'text-neutral-600'} font-sans">⏱ Ahora (hora):</span>
              <span class="font-bold">${actualMetric.formatted}</span>
            </div>
            <div class="flex justify-between ${horizonte === '24h' ? 'text-[#0284c7] font-black' : ''}">
              <span class="${horizonte === '24h' ? 'text-[#0284c7]' : 'text-neutral-600'} font-sans">💧 Próx. 24 h:</span>
              <span class="font-bold">${getNext24hRollingPrecip(summary).toFixed(1)} mm</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-neutral-500 font-sans">📅 Hoy (00–23h):</span>
              <span class="font-semibold text-neutral-700">${summary.lluvia24hMm.toFixed(1)} mm (Resta: ${getRemainingTodayPrecip(summary).toFixed(1)})</span>
            </div>
            <div class="flex justify-between ${horizonte === '48h' || horizonte === '3d' ? 'text-[#7300E1] font-black' : ''}">
              <span class="${horizonte === '48h' || horizonte === '3d' ? 'text-[#7300E1]' : 'text-neutral-600'} font-sans">📊 ${horizonte === '3d' ? '3 días' : '48 h'}:</span>
              <span class="font-bold">${(horizonte === '3d' ? summary.lluvia3dMm : summary.lluvia48hMm).toFixed(1)} mm</span>
            </div>
            <div class="flex justify-between ${horizonte === '7d' ? 'text-[#7300E1] font-black' : ''}">
              <span class="${horizonte === '7d' ? 'text-[#7300E1]' : 'text-neutral-600'} font-sans">📆 7 días:</span>
              <span class="font-bold">${summary.lluvia7dMm.toFixed(1)} mm</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-neutral-200 text-xs">
              <span class="text-neutral-600 font-sans">Mayor riesgo:</span>
              <span class="font-bold text-neutral-950 font-sans">${summary.franjaMayorRiesgo}</span>
            </div>
          </div>

          <div class="text-[11px] text-neutral-500 font-sans mb-2 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>Malla directa en azotea comercial (~1.5 km)</span>
          </div>

          <div class="mb-2.5 pt-1.5 border-t border-neutral-100 flex items-center justify-between text-xs">
            <a 
              href="https://api.open-meteo.com/v1/forecast?latitude=${mall.latitud}&longitude=${mall.longitud}&hourly=precipitation,precipitation_probability,temperature_2m&daily=precipitation_sum&timezone=America%2FLima"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[#7300E1] hover:underline font-bold flex items-center gap-1"
              title="Abrir telemetría Open-Meteo en vivo para estas coordenadas exactas"
            >
              <span>🔗 Ver datos Open-Meteo API</span>
            </a>
            <a
              href="https://www.google.com/maps/search/?api=1&query=${mall.latitud},${mall.longitud}"
              target="_blank"
              rel="noopener noreferrer"
              class="text-neutral-600 hover:text-neutral-900 font-semibold hover:underline"
              title="Ver predio en Google Maps"
            >
              📍 Ver en Maps
            </a>
          </div>

          <button
            id="btn-ver-detalle-${mall.id}"
            class="w-full bg-[#7300E1] hover:bg-[#5f00bb] text-white font-bold text-sm py-2 px-3.5 rounded-lg shadow-xs transition-colors cursor-pointer text-center block"
          >
            Ver Ficha Técnica y Gráfico →
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: false,
        className: 'rp-clean-popup'
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-ver-detalle-${mall.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectMall(mall.id);
            marker.closePopup();
          };
        }
      });

      marker.on('click', () => {
        onSelectMall(mall.id);
      });

      markerLookupRef.current.set(mall.id, marker);
      markerGroup.addLayer(marker);
    });
  }, [summaries, selectedMallId, layers, onSelectMall, currentZoom, horizonte]);

  // Adjust zoom/bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (selectedMallId) {
      const target = summaries.find((s) => s.mall.id === selectedMallId);
      if (target && target.mall.latitud !== null && target.mall.longitud !== null) {
        map.flyTo([target.mall.latitud, target.mall.longitud], 13, {
          duration: 0.9
        });
        const m = markerLookupRef.current.get(target.mall.id);
        if (m) {
          m.openPopup();
        }
      }
    } else {
      // National overview: fitBounds to all visible malls
      const coords = summaries
        .filter((s) => s.mall.latitud !== null && s.mall.longitud !== null)
        .map((s) => [s.mall.latitud!, s.mall.longitud!] as [number, number]);

      if (coords.length > 0) {
        const bounds = L.latLngBounds(coords);
        // Generous padding so Tumbes in North and Tacna/Puno in South are completely visible
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 8 });
      } else {
        map.setView([-9.19, -75.0152], 6);
      }
    }
  }, [selectedMallId, summaries]);

  // Quick zoom to Lima Metropolitana
  const handleZoomLima = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([-12.08, -77.02], 12, { duration: 1.0 });
  };

  // Recompute map size when height changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [isTallMode]);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-neutral-200 shadow-xs bg-neutral-100 transition-all duration-300 ${
        isTallMode
          ? 'h-[850px] lg:h-[950px] xl:h-[1000px]'
          : 'h-[680px] lg:h-[780px] xl:h-[840px]'
      }`}
    >
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Top Left Navigation Toolbar */}
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2.5 flex-wrap">
        {/* National Reset Button */}
        <button
          onClick={onResetToNational}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md cursor-pointer backdrop-blur-xs ${
            selectedMallId === null
              ? 'bg-[#7300E1] text-white ring-2 ring-purple-300'
              : 'bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200 hover:border-neutral-300'
          }`}
          title="Ver mapa completo del Perú y restablecer vista nacional"
        >
          <span>🇵🇪</span>
          <span>VER TODOS LOS MALLS</span>
        </button>

        {/* Quick Lima Focus Button with Callouts indication */}
        <button
          onClick={handleZoomLima}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold bg-white/95 hover:bg-white text-neutral-800 border border-neutral-200 shadow-md transition-all cursor-pointer backdrop-blur-xs"
          title="Enfocar Lima Metropolitana y ver sedes desagrupadas"
        >
          <span>🏙️</span>
          <span>Vista Lima (8 Sedes)</span>
        </button>

        {/* Expand / Taller Map Toggle */}
        <button
          onClick={() => setIsTallMode(!isTallMode)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-white/95 hover:bg-white text-neutral-700 border border-neutral-200 shadow-md transition-all cursor-pointer backdrop-blur-xs"
          title={isTallMode ? 'Reducir tamaño del mapa' : 'Ampliar altura del mapa'}
        >
          {isTallMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isTallMode ? 'Normal' : 'Ampliar'}</span>
        </button>

        {selectedMallId && (
          <span className="hidden sm:inline-block bg-white/95 px-3 py-2 rounded-lg text-sm font-bold text-[#7300E1] border border-neutral-200 shadow-xs font-mono">
            {summaries.find((s) => s.mall.id === selectedMallId)?.mall.nombreCorto || ''}
          </span>
        )}

        <span className="hidden sm:inline-block bg-white/95 px-3 py-2 rounded-lg text-xs font-bold text-neutral-700 border border-neutral-200 shadow-xs font-mono">
          Vista: <span className="text-[#7300E1] uppercase">{horizonte === 'actual' ? 'Actual (mm/h)' : horizonte}</span>
        </span>
      </div>

      {/* Floating Legend (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-[400] bg-white/95 backdrop-blur-xs px-4 py-3 rounded-xl border border-neutral-200 shadow-md text-sm">
        <span className="text-xs font-black text-neutral-500 uppercase tracking-wider block mb-2">
          Nivel de Riesgo Preventivo
        </span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600"></span>
            <span className="font-bold text-neutral-800 text-xs">Alerta</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span>
            <span className="font-bold text-neutral-800 text-xs">Preventivo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-500"></span>
            <span className="font-bold text-neutral-800 text-xs">Vigilancia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
            <span className="font-bold text-neutral-800 text-xs">Normal</span>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-neutral-200 space-y-0.5">
          <div className="text-xs text-[#7300E1] font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#7300E1]" />
            <span>Lima: Flechas de señalamiento anti-solape</span>
          </div>
          <div className="text-[11px] text-neutral-500 italic">
            Clasificación preventiva interna Real Plaza
          </div>
        </div>
      </div>

    </div>
  );
};
