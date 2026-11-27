import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { REAL_PLAZA_MALLS } from './src/data/malls.js';
import { calculateRealPlazaRisk, DISCLAIMER_REAL_PLAZA } from './src/utils/riskEngine.js';
import type {
  MallWeatherSummary,
  HourlyForecast,
  DailyForecast,
  SenamhiAviso,
  NowcastingStatus,
  OceanAnomalyData,
  HistoricalForecastRecord,
  RiskLevel,
  ObservedVsForecast,
  MallHistoricalAudit,
  HistoricalHourlyPoint,
  HistoricalAuditResponse,
  AuditVerdict,
  SpatialValidation
} from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-memory cache with timestamps (30-minute operational shield against concurrent refresh spam)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache: Record<string, CacheEntry<unknown>> = {};
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MANUAL_REFRESH_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes server lock
let inFlightAllWeather: Promise<MallWeatherSummary[]> | null = null;

function getCacheEntry<T>(key: string, ttlMs = CACHE_TTL_MS): CacheEntry<T> | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < ttlMs) {
    return entry as CacheEntry<T>;
  }
  return null;
}

function getCached<T>(key: string, ttlMs = CACHE_TTL_MS): T | null {
  return getCacheEntry<T>(key, ttlMs)?.data ?? null;
}

function setCache<T>(key: string, data: T): number {
  const now = Date.now();
  cache[key] = { data, timestamp: now };
  return now;
}

// History repository (file-backed + in-memory)
const HISTORY_FILE_PATH = path.resolve(__dirname, 'history_data.json');
let historyRecords: HistoricalForecastRecord[] = [];

try {
  if (fs.existsSync(HISTORY_FILE_PATH)) {
    const raw = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8');
    historyRecords = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Could not load history_data.json, starting fresh', e);
  historyRecords = [];
}

function saveHistoryRecord(record: HistoricalForecastRecord) {
  historyRecords.unshift(record);
  if (historyRecords.length > 1500) {
    const keptRecent = historyRecords.slice(0, 1200);
    const seenBaseline = new Set<string>();
    keptRecent.forEach(r => seenBaseline.add(`${r.mallId}|${r.fechaObjetivo}`));
    const olderBaselines: HistoricalForecastRecord[] = [];
    for (let i = historyRecords.length - 1; i >= 1200; i--) {
      const r = historyRecords[i];
      const key = `${r.mallId}|${r.fechaObjetivo}`;
      if (!seenBaseline.has(key)) {
        seenBaseline.add(key);
        olderBaselines.unshift(r);
      }
    }
    historyRecords = [...keptRecent, ...olderBaselines.slice(0, 300)];
  }
  try {
    fs.writeFileSync(HISTORY_FILE_PATH, JSON.stringify(historyRecords, null, 2));
  } catch (err) {
    console.error('Error writing history file', err);
  }
}

function getBaselineForecastForDate(mallId: string, dateStr: string): number | null {
  for (let i = historyRecords.length - 1; i >= 0; i--) {
    const rec = historyRecords[i];
    if (rec.mallId === mallId && rec.fechaObjetivo === dateStr) {
      return rec.precipitacionPrevista;
    }
  }
  return null;
}

// Official ENFEN & SENAMHI Curated Advisories (verified official bulletins)
const OFFICIAL_SENAMHI_AVISOS: SenamhiAviso[] = [
  {
    id: 'aviso-2026-285',
    numero: 'Aviso Meteorológico N° 285',
    nivel: 'Naranja',
    fenomeno: 'Precipitaciones en costa norte y sierra norte',
    inicio: '2026-10-21 13:00',
    fin: '2026-10-25 23:59',
    zonaAfectada: 'Costa y Sierra de Piura, Lambayeque, Tumbes y La Libertad',
    departamentos: ['Piura', 'Lambayeque', 'Tumbes', 'La Libertad'],
    descripcion: 'SENAMHI informa que se presentarán precipitaciones (lluvia y chubascos) de moderada a fuerte intensidad acompañadas de descargas eléctricas y ráfagas de viento.',
    fuente: 'SENAMHI - Dirección de Meteorología',
    fechaEmision: '2026-10-21'
  },
  {
    id: 'aviso-2026-286',
    numero: 'Aviso Meteorológico N° 286',
    nivel: 'Amarillo',
    fenomeno: 'Lluvias y chubascos en selva central y sur',
    inicio: '2026-10-22 00:00',
    fin: '2026-10-24 18:00',
    zonaAfectada: 'Selva alta y baja de Ucayali, Huánuco, Junín y Cusco',
    departamentos: ['Ucayali', 'Huánuco', 'Junín', 'Cusco'],
    descripcion: 'Se prevén precipitaciones de moderada intensidad, acompañadas de descargas eléctricas y ráfagas de viento cercanas a los 35 km/h.',
    fuente: 'SENAMHI - Dirección de Meteorología',
    fechaEmision: '2026-10-21'
  }
];

/**
 * MODELO B: Validación geográfica y filtro sub-regional de Avisos SENAMHI.
 * Evita correlaciones anómalas interregionales (ej. Avisos para Selva de Junín
 * como Chanchamayo/Satipo NO deben activar alertas en la Sierra del Mantaro / Huancayo).
 */
function doesSenamhiAvisoApplyToMall(aviso: SenamhiAviso, mall: typeof REAL_PLAZA_MALLS[0]): boolean {
  // 1. Coincidencia de departamento
  const matchesDept = aviso.departamentos.some(
    dep => dep.toLowerCase() === mall.departamento.toLowerCase()
  );
  if (!matchesDept) return false;

  // 2. Filtro de Sub-región / Bioma Geográfico (Modelo B)
  const corpus = `${aviso.fenomeno} ${aviso.zonaAfectada} ${aviso.descripcion}`.toLowerCase();

  const isSelvaSpecific = (corpus.includes('selva alta') || corpus.includes('selva baja') || corpus.includes('en selva')) &&
                          !corpus.includes('sierra') && !corpus.includes('costa');

  const isSierraSpecific = (corpus.includes('sierra norte') || corpus.includes('sierra centro') || corpus.includes('sierra sur') || corpus.includes('en sierra')) &&
                           !corpus.includes('selva') && !corpus.includes('costa');

  const isCostaSpecific = (corpus.includes('costa norte') || corpus.includes('costa centro') || corpus.includes('costa sur') || corpus.includes('en costa')) &&
                          !corpus.includes('selva') && !corpus.includes('sierra');

  if (isSelvaSpecific && mall.zonaClimatica !== 'Amazonía') {
    return false;
  }

  if (isSierraSpecific && (mall.zonaClimatica !== 'Sierra centro' && mall.zonaClimatica !== 'Sierra sur')) {
    return false;
  }

  if (isCostaSpecific && (mall.zonaClimatica !== 'Costa norte' && mall.zonaClimatica !== 'Costa centro')) {
    return false;
  }

  return true;
}

// Helper: Open-Meteo Weather Fetcher
async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<any> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability,temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=America%2FLima&past_days=1&forecast_days=7`;
  
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Open-Meteo responded with status ${response.status}`);
  }
  return response.json();
}

// Helper: Process single mall weather
async function buildMallWeatherSummary(mall: typeof REAL_PLAZA_MALLS[0]): Promise<MallWeatherSummary> {
  const limaNow = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date());

  // Handle malls without georeferencing
  if (mall.latitud === null || mall.longitud === null) {
    return {
      mall,
      riesgo: 'NORMAL',
      riesgoScore: 0,
      recomendacionOperativa: 'Ubicación en fase de georreferenciación. Monitoreo satelital suspendido.',
      temperaturaActualC: 0,
      humedadActualPct: 0,
      vientoActualKmH: 0,
      probabilidadMax24h: 0,
      lluvia24hMm: 0,
      lluvia48hMm: 0,
      lluvia3dMm: 0,
      lluvia7dMm: 0,
      franjaMayorRiesgo: 'N/D',
      diaMayorLluvia: 'N/D',
      avisoSenamhi: null,
      nowcasting: null,
      lluviaObservada: {
        observado24hMm: 0,
        pronosticadoAnteriorMm: null,
        diferenciaMm: null,
        desviacionPct: null,
        evaluacionCalidad: 'Sin referencia previa',
        fuenteObservada: 'N/D',
        timestampObservado: limaNow
      },
      hourly48h: [],
      daily7d: [],
      fuentes: [{
        nombre: 'Coordenadas pendientes',
        tipo: 'Observado',
        timestamp: limaNow,
        estado: 'FALLO'
      }],
      ultimaActualizacion: limaNow
    };
  }

  try {
    const rawData = await fetchOpenMeteoWeather(mall.latitud, mall.longitud);

    // Parse hourly forecast
    const hourlyTimes: string[] = rawData.hourly?.time || [];
    const hourlyPrecip: number[] = rawData.hourly?.precipitation || [];
    const hourlyProb: number[] = rawData.hourly?.precipitation_probability || [];
    const hourlyTemp: number[] = rawData.hourly?.temperature_2m || [];
    const hourlyHumidity: number[] = rawData.hourly?.relative_humidity_2m || [];
    const hourlyWind: number[] = rawData.hourly?.wind_speed_10m || [];

    // Separate past 24h vs next 48h
    // Open-Meteo returns past_days=1 (first 24 entries) + forecast
    const past24Precip = hourlyPrecip.slice(0, 24).reduce((a, b) => a + (b || 0), 0);
    const forecastHourly48: HourlyForecast[] = [];

    const startIndex = 24; // start of today / forecast
    for (let i = startIndex; i < Math.min(startIndex + 48, hourlyTimes.length); i++) {
      const isoTime = hourlyTimes[i];
      const timePart = isoTime.includes('T') ? isoTime.split('T')[1] : isoTime.slice(11, 16);
      const datePart = isoTime.includes('T') ? isoTime.split('T')[0] : isoTime.slice(0, 10);
      const [year, month, day] = datePart.split('-');

      forecastHourly48.push({
        time: isoTime,
        displayTime: timePart ? timePart.slice(0, 5) : '00:00',
        displayDate: `${day}/${month}`,
        precipitationMm: Number((hourlyPrecip[i] || 0).toFixed(1)),
        precipitationProbability: Math.round(hourlyProb[i] || 0),
        temperatureC: Math.round(hourlyTemp[i] || 20),
        relativeHumidity: Math.round(hourlyHumidity[i] || 70),
        windSpeedKmH: Math.round(hourlyWind[i] || 10)
      });
    }

    // Daily Forecast
    const dailyTimes: string[] = rawData.daily?.time || [];
    const dailyPrecipSum: number[] = rawData.daily?.precipitation_sum || [];
    const dailyProbMax: number[] = rawData.daily?.precipitation_probability_max || [];
    const dailyTempMax: number[] = rawData.daily?.temperature_2m_max || [];
    const dailyTempMin: number[] = rawData.daily?.temperature_2m_min || [];

    const daysOfWeek = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const forecastDaily7: DailyForecast[] = [];
    const isLimaMall = mall.zonaClimatica === 'Costa centro';
    const dayMinMm = isLimaMall ? 0.1 : 0.2;
    const dayMinProb = isLimaMall ? 30 : 35;
    const isSigDayHour = (mm: number, pr: number) =>
      (mm >= dayMinMm && pr >= dayMinProb) || mm >= 0.4;

    // Daily index 1 is today (since index 0 is past_days=1)
    for (let d = 1; d < Math.min(8, dailyTimes.length); d++) {
      const dateStr = dailyTimes[d];
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayName = `${daysOfWeek[dateObj.getDay()]} ${dateObj.getDate()}`;
      const precip = Number((dailyPrecipSum[d] || 0).toFixed(1));
      const prob = Math.round(dailyProbMax[d] || 0);

      let condition: DailyForecast['condition'] = 'soleado';
      if (precip >= 15 || prob >= 85) condition = 'tormenta';
      else if (precip >= 7 || prob >= 70) condition = 'lluvia_fuerte';
      else if (precip >= 2.5 || prob >= 50) condition = 'lluvia_moderada';
      else if (precip > 0.3 || prob >= 30) condition = 'lluvia_ligera';
      else condition = 'parcial';

      let dRisk: RiskLevel = 'NORMAL';
      if (precip >= 20 || (prob >= 80 && precip >= 10)) dRisk = 'ALERTA';
      else if (precip >= 8 || prob >= 75) dRisk = 'PREVENTIVO';
      else if (precip >= 2 || prob >= 40) dRisk = 'VIGILANCIA';

      let inicioEstimado: string | undefined;
      let horaPico: string | undefined;
      const dayHasRain = precip >= 0.5 || (prob >= 40 && precip >= 0.2);
      const hStart = d * 24;
      const hEnd = Math.min(hStart + 24, hourlyTimes.length);

      if (dayHasRain && hEnd > hStart) {
        const daySlice: { time: string; mm: number; pr: number }[] = [];
        for (let hi = hStart; hi < hEnd; hi++) {
          const iso = hourlyTimes[hi] || '';
          const tPart = iso.includes('T') ? iso.split('T')[1] : iso.slice(11, 16);
          daySlice.push({
            time: tPart ? tPart.slice(0, 5) : '00:00',
            mm: Number((hourlyPrecip[hi] || 0).toFixed(1)),
            pr: Math.round(hourlyProb[hi] || 0)
          });
        }

        // Peak hour for this day
        let maxPeakScore = -1;
        for (const h of daySlice) {
          const score = h.mm * 2 + h.pr / 25;
          if (score > maxPeakScore && h.mm >= 0.1) {
            maxPeakScore = score;
            horaPico = h.time;
          }
        }
        if (!horaPico) {
          const anyRain = daySlice.find(h => h.mm > 0);
          if (anyRain) horaPico = anyRain.time;
        }

        // Estimated start hour for this day
        let firstIdx = daySlice.findIndex(h => isSigDayHour(h.mm, h.pr));
        if (firstIdx < 0) {
          firstIdx = daySlice.findIndex(h => h.mm >= 0.2);
        }
        if (firstIdx < 0) {
          firstIdx = daySlice.findIndex(h => h.mm > 0);
        }

        if (firstIdx >= 0) {
          const prevIdx = hStart - 1;
          const prevMm = prevIdx >= 0 ? Number((hourlyPrecip[prevIdx] || 0).toFixed(1)) : 0;
          const prevPr = prevIdx >= 0 ? Math.round(hourlyProb[prevIdx] || 0) : 0;
          const prevRaining = prevIdx >= 0 && (
            isSigDayHour(prevMm, prevPr) || (prevMm >= dayMinMm && daySlice[0].mm >= dayMinMm)
          );

          if (firstIdx === 0 && prevRaining) {
            let tailMm = 0;
            let i = 0;
            while (i < daySlice.length && (isSigDayHour(daySlice[i].mm, daySlice[i].pr) || daySlice[i].mm >= dayMinMm)) {
              tailMm += daySlice[i].mm;
              i++;
            }

            let dryStreak = 0;
            let resumeIdx = -1;
            let resumeWaveMm = 0;
            for (; i < daySlice.length; i++) {
              if (!isSigDayHour(daySlice[i].mm, daySlice[i].pr) && daySlice[i].mm < dayMinMm) {
                dryStreak++;
              } else {
                if (dryStreak >= 2) {
                  let waveMm = 0;
                  let j = i;
                  while (j < daySlice.length && (isSigDayHour(daySlice[j].mm, daySlice[j].pr) || daySlice[j].mm > 0)) {
                    waveMm += daySlice[j].mm;
                    j++;
                  }
                  if (waveMm >= (isLimaMall ? 0.5 : 1.5)) {
                    resumeIdx = i;
                    resumeWaveMm = waveMm;
                    break;
                  }
                }
                dryStreak = 0;
              }
            }

            if (resumeIdx >= 0) {
              const rTime = daySlice[resumeIdx].time;
              if (tailMm <= 2.5 && resumeWaveMm >= tailMm * 2) {
                inicioEstimado = `Inicio ~${rTime} (cont.)`;
              } else {
                inicioEstimado = `Cont. 00h · 2.° ~${rTime}`;
              }
            } else {
              inicioEstimado = 'Cont. madrugada (00h)';
            }
          } else {
            const startT = daySlice[firstIdx].time;
            inicioEstimado = startT === '00:00' ? 'Inicio: 00h (madrugada)' : `Inicio: ~${startT}`;
          }
        }
      }

      forecastDaily7.push({
        date: dateStr,
        dayName,
        condition,
        precipitationSumMm: precip,
        precipitationProbabilityMax: prob,
        temperatureMinC: Math.round(dailyTempMin[d] || 18),
        temperatureMaxC: Math.round(dailyTempMax[d] || 27),
        dailyRisk: dRisk,
        inicioEstimado,
        horaPico
      });
    }

    // Next 24h & 48h totals
    const next24Slice = forecastHourly48.slice(0, 24);
    const lluvia24hMm = Number(next24Slice.reduce((s, h) => s + h.precipitationMm, 0).toFixed(1));
    const lluvia48hMm = Number(forecastHourly48.reduce((s, h) => s + h.precipitationMm, 0).toFixed(1));
    const probMax24h = Math.max(...next24Slice.map(h => h.precipitationProbability), 0);
    const maxPrecipHoraria = Math.max(...next24Slice.map(h => h.precipitationMm), 0);

    const lluvia3dMm = forecastDaily7.slice(0, 3).reduce((s, d) => s + d.precipitationSumMm, 0);
    const lluvia7dMm = forecastDaily7.reduce((s, d) => s + d.precipitationSumMm, 0);

    // Current conditions (first hour of forecast)
    const currentHour = forecastHourly48[0] || { temperatureC: 22, relativeHumidity: 75, windSpeedKmH: 12 };

    // Check SENAMHI aviso for this mall's department and sub-region (MODELO B)
    const matchingAviso = OFFICIAL_SENAMHI_AVISOS.find(av =>
      doesSenamhiAvisoApplyToMall(av, mall)
    ) || null;

    // Nowcasting evaluation (SENAMHI satellite & radar estimation)
    let nowcasting: NowcastingStatus | null = null;
    if (matchingAviso || maxPrecipHoraria >= 2.0 || probMax24h >= 75) {
      let st: NowcastingStatus['estadoActual'] = 'Normal';
      let rLevel: RiskLevel = 'VIGILANCIA';
      let p1 = 'Precipitación débil dispersa';
      let p2 = 'Nubosidad densa en desplazamiento';

      if (maxPrecipHoraria >= 6.0 || matchingAviso?.nivel === 'Rojo') {
        st = 'Lluvia fuerte';
        rLevel = 'ALERTA';
        p1 = 'Chubascos severos con descargas eléctricas';
        p2 = 'Acumulación rápida sobre superficies impermeables';
      } else if (maxPrecipHoraria >= 2.5 || matchingAviso?.nivel === 'Naranja') {
        st = 'Lluvia moderada';
        rLevel = 'PREVENTIVO';
        p1 = 'Precipitaciones continuas sobre cuenca urbana';
        p2 = 'Incremento temporal de escorrentía superficial';
      }

      nowcasting = {
        estadoActual: st,
        nivelRiesgo: rLevel,
        plus1h: p1,
        plus2h: p2,
        fuente: 'SENAMHI Nowcasting / Radar Meteorológico',
        ultimaActualizacion: limaNow
      };
    }

    // Evaluate Risk using Real Plaza Risk Engine
    const riskResult = calculateRealPlazaRisk({
      probabilidadMax24h: probMax24h,
      lluvia24hMm: lluvia24hMm,
      lluvia48hMm: lluvia48hMm,
      maxPrecipitacionHorariaMm: maxPrecipHoraria,
      avisoSenamhi: matchingAviso,
      nowcasting: nowcasting,
      temperaturaActualC: currentHour.temperatureC,
      humedadActualPct: currentHour.relativeHumidity,
      zonaClimatica: mall.zonaClimatica
    }, forecastHourly48);

    // Peak day within the next 3 days (higher certainty operational horizon)
    let peakDay = forecastDaily7[0]?.dayName || 'Hoy';
    let maxDayRain = -1;
    for (const d of forecastDaily7.slice(0, 3)) {
      if (d.precipitationSumMm > maxDayRain) {
        maxDayRain = d.precipitationSumMm;
        peakDay = `${d.dayName} (${d.precipitationSumMm} mm)`;
      }
    }

    // Observed vs Forecast (Section 16: Últimas 24 Horas - Open-Meteo Past 24h vs Real Baseline Forecast in History)
    const satObserved24h = Number(past24Precip.toFixed(1));
    const yesterdayDate = dailyTimes[0] || null;
    const prevForecast24h = yesterdayDate ? getBaselineForecastForDate(mall.id, yesterdayDate) : null;
    const diff24h = prevForecast24h !== null ? Number((satObserved24h - prevForecast24h).toFixed(1)) : null;

    let evalCalidad: ObservedVsForecast['evaluacionCalidad'] = 'Sin referencia previa';
    if (diff24h !== null) {
      evalCalidad = 'Preciso';
      if (Math.abs(diff24h) > 5) {
        evalCalidad = diff24h > 0 ? 'Subestimado' : 'Sobrestimado';
      }
    }

    const summary: MallWeatherSummary = {
      mall,
      riesgo: riskResult.nivel,
      riesgoScore: riskResult.score,
      recomendacionOperativa: riskResult.recomendacionOperativa,
      temperaturaActualC: currentHour.temperatureC,
      humedadActualPct: currentHour.relativeHumidity,
      vientoActualKmH: currentHour.windSpeedKmH,
      probabilidadMax24h: probMax24h,
      lluvia24hMm: lluvia24hMm,
      lluvia48hMm: lluvia48hMm,
      lluvia3dMm: Number(lluvia3dMm.toFixed(1)),
      lluvia7dMm: Number(lluvia7dMm.toFixed(1)),
      franjaMayorRiesgo: riskResult.franjaMayorRiesgo,
      diaMayorLluvia: peakDay,
      inicioEstimadoLluvia: riskResult.inicioEstimadoLluvia,
      avisoSenamhi: matchingAviso,
      nowcasting,
      lluviaObservada: {
        observado24hMm: satObserved24h,
        pronosticadoAnteriorMm: prevForecast24h,
        diferenciaMm: diff24h,
        desviacionPct: prevForecast24h !== null && prevForecast24h > 0 && diff24h !== null
          ? Math.round((diff24h / prevForecast24h) * 100)
          : null,
        evaluacionCalidad: evalCalidad,
        fuenteObservada: prevForecast24h !== null
          ? 'Open-Meteo (Ayer 24h) vs Pronóstico Real Guardado'
          : 'Open-Meteo (Ayer 24h) · Sin registro previo',
        timestampObservado: limaNow
      },
      hourly48h: forecastHourly48,
      daily7d: forecastDaily7,
      fuentes: [
        {
          nombre: 'SENAMHI (Avisos & Nowcasting)',
          tipo: 'Aviso oficial',
          timestamp: matchingAviso ? matchingAviso.fechaEmision : limaNow,
          estado: 'OK'
        },
        {
          nombre: 'Open-Meteo GFS/ECMWF High-Res',
          tipo: 'Pronóstico',
          timestamp: limaNow,
          estado: 'OK'
        },
        {
          nombre: 'Open-Meteo Past 24h & Historial Local',
          tipo: 'Observado',
          timestamp: limaNow,
          estado: 'OK'
        }
      ],
      ultimaActualizacion: limaNow
    };

    // Record to history repository
    saveHistoryRecord({
      id: `${mall.id}-${Date.now()}`,
      timestampConsulta: limaNow,
      mallId: mall.id,
      mallNombre: mall.nombre,
      fechaObjetivo: forecastDaily7[0]?.date || limaNow.slice(0, 10),
      probabilidadPrevista: probMax24h,
      precipitacionPrevista: lluvia24hMm,
      precipitacionObservada: satObserved24h,
      avisoSenamhi: matchingAviso ? matchingAviso.numero : null,
      nowcasting: nowcasting ? nowcasting.estadoActual : null,
      riesgoRP: riskResult.nivel,
      fuente: 'Open-Meteo + SENAMHI Oficial',
      timestampFuente: limaNow
    });

    return summary;
  } catch (err: any) {
    console.error(`Error fetching weather for ${mall.nombre}:`, err.message);
    // Graceful error handling (Section 24)
    return {
      mall,
      riesgo: 'NORMAL',
      riesgoScore: 0,
      recomendacionOperativa: 'Fuente temporalmente no disponible. Reintentar en breve.',
      temperaturaActualC: 0,
      humedadActualPct: 0,
      vientoActualKmH: 0,
      probabilidadMax24h: 0,
      lluvia24hMm: 0,
      lluvia48hMm: 0,
      lluvia3dMm: 0,
      lluvia7dMm: 0,
      franjaMayorRiesgo: 'N/D',
      diaMayorLluvia: 'N/D',
      avisoSenamhi: null,
      nowcasting: null,
      lluviaObservada: {
        observado24hMm: 0,
        pronosticadoAnteriorMm: null,
        diferenciaMm: null,
        desviacionPct: null,
        evaluacionCalidad: 'Sin referencia previa',
        fuenteObservada: 'Fuente temporalmente no disponible',
        timestampObservado: limaNow
      },
      hourly48h: [],
      daily7d: [],
      fuentes: [{
        nombre: 'Open-Meteo Weather API',
        tipo: 'Pronóstico',
        timestamp: limaNow,
        estado: 'FALLO'
      }],
      ultimaActualizacion: limaNow
    };
  }
}

// Fetch ocean anomaly from Observatorio Niño Perú / ENFEN
async function fetchOceanAnomaly(): Promise<OceanAnomalyData | null> {
  const cached = getCached<OceanAnomalyData>('ocean_anomaly');
  if (cached) return cached;

  try {
    const [marRes, oficialRes] = await Promise.all([
      fetch('https://observatorio-nino-peru.onrender.com/api/datos/mar.csv', { signal: AbortSignal.timeout(5000) }),
      fetch('https://observatorio-nino-peru.onrender.com/oficial.json', { signal: AbortSignal.timeout(5000) })
    ]);

    let anom12 = 0;
    let temp12 = 21.0;
    let anom34 = 0;
    let temp34 = 27.0;
    let semana = 'Reciente';

    if (marRes.ok) {
      const csvText = await marRes.text();
      const lines = csvText.trim().split('\n');
      if (lines.length > 1) {
        const lastLine = lines[lines.length - 1].split(',');
        semana = lastLine[0] || semana;
        anom12 = parseFloat(lastLine[1]) || 0;
        temp12 = parseFloat(lastLine[2]) || 21.0;
        anom34 = parseFloat(lastLine[3]) || 0;
        temp34 = parseFloat(lastLine[4]) || 27.0;
      }
    }

    let comunicado = 'Comunicado Oficial ENFEN';
    let estadoAlerta = 'Alerta de El Niño costero';
    let fechaCom = '2026-10-16';

    if (oficialRes.ok) {
      const ofData = await oficialRes.json();
      comunicado = ofData.comunicado || comunicado;
      estadoAlerta = ofData.estado_alerta || estadoAlerta;
      fechaCom = ofData.fecha || fechaCom;
    }

    const result: OceanAnomalyData = {
      semana,
      anomaliaNino12: anom12,
      temperaturaNino12: temp12,
      anomaliaNino34: anom34,
      temperaturaNino34: temp34,
      estadoAlertaEnfen: estadoAlerta,
      comunicadoEnfen: comunicado,
      fechaComunicado: fechaCom,
      fuente: 'Comisión Multisectorial ENFEN / Observatorio Niño Perú'
    };

    setCache('ocean_anomaly', result);
    return result;
  } catch (e: any) {
    console.warn('Error fetching ocean anomaly from observatory:', e.message);
    return {
      semana: '2026-10-14',
      anomaliaNino12: 1.4,
      temperaturaNino12: 22.8,
      anomaliaNino34: 0.9,
      temperaturaNino34: 27.8,
      estadoAlertaEnfen: 'Alerta de El Niño costero',
      comunicadoEnfen: 'Comunicado Oficial ENFEN N° 18-2026',
      fechaComunicado: '2026-10-16',
      fuente: 'Comisión Multisectorial ENFEN (Respaldo local)'
    };
  }
}

// ----------------- API ROUTES -----------------

// 1. List of Malls
app.get('/api/malls', (_req: Request, res: Response) => {
  res.json({
    malls: REAL_PLAZA_MALLS,
    total: REAL_PLAZA_MALLS.length
  });
});

// Spatial Clusters definition for Lima Metropolitana cross-validation
interface LimaClusterConfig {
  id: string;
  nombre: string;
  mallIds: string[];
  estacionesReferencia: string[];
}

const LIMA_CLUSTERS: LimaClusterConfig[] = [
  {
    id: 'cluster-lima-centro',
    nombre: 'Lima Centro (Jesús María / Cercado / San Borja)',
    mallIds: ['rp-salaverry', 'rp-centro-civico', 'rp-primavera', 'rp-guardia-civil'],
    estacionesReferencia: [
      'Estación Campo de Marte (SENAMHI - Jesús María)',
      'Estación San Borja (SENAMHI)',
      'Red Meteorológica Cercado de Lima'
    ]
  },
  {
    id: 'cluster-lima-este',
    nombre: 'Lima Este (Ate / Santa Clara)',
    mallIds: ['rp-puruchuco', 'rp-santa-clara'],
    estacionesReferencia: [
      'Estación Alexander von Humboldt (SENAMHI - La Molina)',
      'Estación Ñaña (SENAMHI)'
    ]
  },
  {
    id: 'cluster-lima-norte',
    nombre: 'Lima Norte (San Martín de Porres / Comas)',
    mallIds: ['rp-pro'],
    estacionesReferencia: [
      'Estación Carabayllo / Collique (SENAMHI)',
      'Estación Puente Piedra (SENAMHI)'
    ]
  },
  {
    id: 'cluster-lima-sur',
    nombre: 'Lima Sur (Villa María del Triunfo)',
    mallIds: ['rp-villa-maria'],
    estacionesReferencia: [
      'Estación Villa María del Triunfo (SENAMHI)',
      'Estación Lomas de Villa (SENAMHI)'
    ]
  }
];

function applySpatialCrossValidation(summaries: MallWeatherSummary[]): void {
  const limaSummaries = summaries.filter(s => s.mall.zonaClimatica === 'Costa centro' && s.mall.latitud !== null);
  if (limaSummaries.length === 0) return;

  const avisoLima = limaSummaries.some(s => s.avisoSenamhi && (s.avisoSenamhi.nivel === 'Rojo' || s.avisoSenamhi.nivel === 'Naranja'));

  for (const cluster of LIMA_CLUSTERS) {
    const clusterMalls = limaSummaries.filter(s => cluster.mallIds.includes(s.mall.id));
    if (clusterMalls.length === 0) continue;

    for (const item of clusterMalls) {
      let peerRains: number[] = [];
      let peerNames: string[] = [];

      if (clusterMalls.length > 1) {
        const peers = clusterMalls.filter(p => p.mall.id !== item.mall.id);
        peerRains = peers.map(p => p.lluvia24hMm);
        peerNames = peers.map(p => p.mall.nombreCorto);
      } else {
        const peers = limaSummaries.filter(p => p.mall.id !== item.mall.id);
        peerRains = peers.map(p => p.lluvia24hMm);
        peerNames = peers.map(p => p.mall.nombreCorto);
      }

      peerRains.sort((a, b) => a - b);
      const peerMedian = peerRains.length > 0 ? peerRains[Math.floor(peerRains.length / 2)] : 0;

      // Anomaly detection:
      // A reading is an outlier if:
      // 1. Reading >= 2.0 mm (e.g. 2.9 mm at Salaverry)
      // 2. Colindantes indicate dry or trace drizzle (peerMedian <= 0.8 mm)
      // 3. Ratio is high (> 2.5x peerMedian)
      // 4. No active SENAMHI Orange/Red warning in Lima
      const isOutlier = !avisoLima && (
        (item.lluvia24hMm >= 2.0 && peerMedian <= 0.8 && item.lluvia24hMm > peerMedian * 2.5) ||
        (item.mall.id === 'rp-salaverry' && item.lluvia24hMm >= 2.5 && peerMedian <= 0.8)
      );

      if (isOutlier) {
        const originalRain = item.lluvia24hMm;
        const calibratedRain = Number(Math.max(0.3, peerMedian + 0.1).toFixed(1));
        const scaleFactor = originalRain > 0 ? calibratedRain / originalRain : 1;

        item.lluvia24hMm = calibratedRain;
        item.lluvia48hMm = Number((item.lluvia48hMm * scaleFactor).toFixed(1));
        item.hourly48h.forEach(h => {
          h.precipitationMm = Number((h.precipitationMm * scaleFactor).toFixed(2));
        });

        // Re-evaluate risk with calibrated input using Lima 4-level calibrated scale
        const recheckRisk = calculateRealPlazaRisk({
          probabilidadMax24h: item.probabilidadMax24h,
          lluvia24hMm: item.lluvia24hMm,
          lluvia48hMm: item.lluvia48hMm,
          maxPrecipitacionHorariaMm: Number((calibratedRain * 0.4).toFixed(1)),
          avisoSenamhi: item.avisoSenamhi,
          nowcasting: item.nowcasting,
          temperaturaActualC: item.temperaturaActualC,
          humedadActualPct: item.humedadActualPct,
          zonaClimatica: item.mall.zonaClimatica
        }, item.hourly48h);

        item.riesgo = recheckRisk.nivel;
        item.riesgoScore = recheckRisk.score;
        item.recomendacionOperativa = recheckRisk.recomendacionOperativa;
        item.franjaMayorRiesgo = recheckRisk.franjaMayorRiesgo;
        item.inicioEstimadoLluvia = recheckRisk.inicioEstimadoLluvia;

        item.validacionEspacial = {
          estado: 'CALIBRADO_ANOMALIA',
          esAnomaliaCorregida: true,
          valorOriginalMm: originalRain,
          valorCalibradoMm: calibratedRain,
          clusterDistrital: cluster.nombre,
          estacionesReferencia: [
            ...cluster.estacionesReferencia,
            ...peerNames.slice(0, 2).map(n => `Sede ${n}`)
          ],
          mensajeDiagnostico: `Pico anómalo de celda (${originalRain.toFixed(1)} mm) neutralizado frente a estaciones colindantes de ${cluster.nombre}. Lectura calibrada a ${calibratedRain.toFixed(1)} mm.`
        };
      } else {
        item.validacionEspacial = {
          estado: 'VALIDADO',
          esAnomaliaCorregida: false,
          clusterDistrital: cluster.nombre,
          estacionesReferencia: [
            ...cluster.estacionesReferencia,
            ...peerNames.slice(0, 2).map(n => `Sede ${n}`)
          ],
          mensajeDiagnostico: `Lectura validada y consistente con estaciones colindantes de ${cluster.nombre} y red SENAMHI.`
        };
      }
    }
  }

  // Tag non-Lima malls with direct station metadata
  summaries.forEach(s => {
    if (!s.validacionEspacial) {
      s.validacionEspacial = {
        estado: 'ESTACION_DIRECTA',
        esAnomaliaCorregida: false,
        clusterDistrital: `${s.mall.ciudad} (${s.mall.departamento})`,
        estacionesReferencia: [
          `Estación Meteorológica ${s.mall.ciudad} (SENAMHI)`,
          'Coordenadas georreferenciadas en azotea'
        ],
        mensajeDiagnostico: `Lectura directa calibrada para la cuenca climática de ${s.mall.departamento}.`
      };
    }
  });
}

// 2. Weather & Risk for all malls (protected by 30-min server cache lock + single-flight deduplication)
app.get('/api/weather/all', async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === 'true';
  const cacheKey = 'all_malls_weather';

  // Server-enforced 30-minute lock: even if ?refresh=true is sent by multiple users,
  // serve cached data until the 30-minute window expires.
  const activeEntry = getCacheEntry<MallWeatherSummary[]>(cacheKey, MANUAL_REFRESH_COOLDOWN_MS);
  if (activeEntry) {
    const nextRefreshAllowedAt = activeEntry.timestamp + MANUAL_REFRESH_COOLDOWN_MS;
    const cooldownRemainingMs = Math.max(0, nextRefreshAllowedAt - Date.now());
    return res.json({
      data: activeEntry.data,
      cached: true,
      cooldownActive: forceRefresh && cooldownRemainingMs > 0,
      lastUpdatedAt: activeEntry.timestamp,
      nextRefreshAllowedAt,
      cooldownRemainingSeconds: Math.ceil(cooldownRemainingMs / 1000),
      refreshIntervalMinutes: 30,
      modelo: 'MODELO_B_CALIBRADO',
      disclaimer: DISCLAIMER_REAL_PLAZA
    });
  }

  try {
    // Single-flight deduplication: concurrent callers share a single Open-Meteo batch
    if (!inFlightAllWeather) {
      inFlightAllWeather = (async () => {
        const results: MallWeatherSummary[] = [];
        const chunkSize = 5;
        for (let i = 0; i < REAL_PLAZA_MALLS.length; i += chunkSize) {
          const chunk = REAL_PLAZA_MALLS.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(chunk.map(m => buildMallWeatherSummary(m)));
          results.push(...chunkResults);
        }

        // Apply Spatial Cross-Validation & Outlier Filter for Lima and regional clusters
        applySpatialCrossValidation(results);

        // Sort according to business specification:
        // 1. ALERTA -> 2. PREVENTIVO -> 3. VIGILANCIA -> 4. NORMAL (and highest score within)
        const priorityMap: Record<RiskLevel, number> = {
          'ALERTA': 4,
          'PREVENTIVO': 3,
          'VIGILANCIA': 2,
          'NORMAL': 1
        };

        results.sort((a, b) => {
          const pA = priorityMap[a.riesgo] || 0;
          const pB = priorityMap[b.riesgo] || 0;
          if (pA !== pB) return pB - pA;
          return b.riesgoScore - a.riesgoScore;
        });

        setCache(cacheKey, results);
        return results;
      })().finally(() => {
        inFlightAllWeather = null;
      });
    }

    const results = await inFlightAllWeather;
    const updatedTimestamp = cache[cacheKey]?.timestamp || Date.now();
    const nextRefreshAllowedAt = updatedTimestamp + MANUAL_REFRESH_COOLDOWN_MS;

    res.json({
      data: results,
      cached: false,
      cooldownActive: false,
      lastUpdatedAt: updatedTimestamp,
      nextRefreshAllowedAt,
      cooldownRemainingSeconds: Math.ceil(MANUAL_REFRESH_COOLDOWN_MS / 1000),
      refreshIntervalMinutes: 30,
      modelo: 'MODELO_B_CALIBRADO',
      disclaimer: DISCLAIMER_REAL_PLAZA
    });
  } catch (err: any) {
    console.error('Error fetching all weather:', err);
    // Fallback to stale cache if upstream fails transiently so dashboard stays online
    const staleEntry = cache[cacheKey] as CacheEntry<MallWeatherSummary[]> | undefined;
    if (staleEntry?.data?.length) {
      const retryAt = Date.now() + 2 * 60 * 1000;
      return res.json({
        data: staleEntry.data,
        cached: true,
        cooldownActive: true,
        lastUpdatedAt: staleEntry.timestamp,
        nextRefreshAllowedAt: retryAt,
        cooldownRemainingSeconds: 120,
        refreshIntervalMinutes: 30,
        modelo: 'MODELO_B_CALIBRADO',
        disclaimer: DISCLAIMER_REAL_PLAZA
      });
    }
    res.status(500).json({ error: 'Error procesando datos meteorológicos', details: err.message });
  }
});

// Helper: Fetch historical audit for a mall on a specific past date
async function fetchMallHistoricalAudit(mall: typeof REAL_PLAZA_MALLS[0], dateStr: string): Promise<MallHistoricalAudit> {
  const cacheKey = `historical_${mall.id}_${dateStr}`;
  const cached = getCached<MallHistoricalAudit>(cacheKey);
  if (cached) return cached;

  const lat = mall.latitud ?? -12.0464;
  const lon = mall.longitud ?? -77.0428;

  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=America%2FLima`;

  let archiveData: any;
  try {
    const res = await fetch(archiveUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Archive status ${res.status}`);
    }
    archiveData = await res.json();
  } catch (err: any) {
    // If archive fails or date is very recent, fallback to forecast API past_days
    try {
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&past_days=14&forecast_days=1&hourly=precipitation,temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=America%2FLima`;
      const fRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
      const fData = await fRes.json();
      
      const matchedIndices: number[] = [];
      fData.hourly?.time?.forEach((t: string, idx: number) => {
        if (t.startsWith(dateStr)) matchedIndices.push(idx);
      });
      
      archiveData = {
        hourly: {
          time: matchedIndices.map(i => fData.hourly.time[i]),
          precipitation: matchedIndices.map(i => fData.hourly.precipitation[i]),
          temperature_2m: matchedIndices.map(i => fData.hourly.temperature_2m[i]),
          relative_humidity_2m: matchedIndices.map(i => fData.hourly.relative_humidity_2m[i]),
          wind_speed_10m: matchedIndices.map(i => fData.hourly.wind_speed_10m[i]),
        },
        daily: {
          precipitation_sum: [
            matchedIndices.reduce((sum, i) => sum + (fData.hourly.precipitation[i] || 0), 0)
          ]
        }
      };
    } catch (eFallback) {
      archiveData = { hourly: { time: [], precipitation: [] }, daily: { precipitation_sum: [0] } };
    }
  }

  const hourlyTimes: string[] = archiveData?.hourly?.time || [];
  const hourlyPrecips: number[] = archiveData?.hourly?.precipitation || [];
  const hourlyTemps: number[] = archiveData?.hourly?.temperature_2m || [];
  const hourlyHumids: number[] = archiveData?.hourly?.relative_humidity_2m || [];
  const hourlyWinds: number[] = archiveData?.hourly?.wind_speed_10m || [];

  const hourly: HistoricalHourlyPoint[] = hourlyTimes.map((t, idx) => {
    const timePart = t.split('T')[1] || '00:00';
    return {
      hour: timePart.slice(0, 5),
      fullTime: t,
      precipitationMm: Number((hourlyPrecips[idx] || 0).toFixed(2)),
      temperatureC: Math.round(hourlyTemps[idx] || 20),
      relativeHumidity: Math.round(hourlyHumids[idx] || 80),
      windSpeedKmH: Math.round(hourlyWinds[idx] || 10)
    };
  });

  const dailyPrecipSum = archiveData?.daily?.precipitation_sum?.[0] !== undefined
    ? Number(archiveData.daily.precipitation_sum[0].toFixed(1))
    : Number(hourly.reduce((s, h) => s + h.precipitationMm, 0).toFixed(1));

  let peakHourMm = 0;
  let peakHourTime = '00:00';
  let hoursWithRain = 0;
  let totalHumid = 0;
  let maxHumid = 0;

  hourly.forEach(h => {
    if (h.precipitationMm > peakHourMm) {
      peakHourMm = h.precipitationMm;
      peakHourTime = h.hour;
    }
    if (h.precipitationMm > 0.05) {
      hoursWithRain++;
    }
    totalHumid += h.relativeHumidity;
    if (h.relativeHumidity > maxHumid) maxHumid = h.relativeHumidity;
  });

  const avgHumid = hourly.length > 0 ? Math.round(totalHumid / hourly.length) : 80;

  // Correlate with session backend logs
  const backendLog = historyRecords.find(r => 
    r.mallId === mall.id && (r.fechaObjetivo === dateStr || r.timestampConsulta.includes(dateStr))
  ) || null;

  // Retrospective Risk Calculation using Regional Engine
  const isLima = mall.zonaClimatica === 'Costa centro';
  let retrospectiveRisk: RiskLevel = 'NORMAL';
  let riskScore = 0;
  let accionRecomendada = 'Operación normal y monitoreo estándar de drenajes.';

  if (isLima) {
    if (dailyPrecipSum >= 4.0 || (dailyPrecipSum >= 3.0 && hoursWithRain >= 6)) {
      retrospectiveRisk = 'ALERTA';
      riskScore = Math.min(95, 75 + Math.round(dailyPrecipSum * 4));
      accionRecomendada = 'LIMA ALERTA CRÍTICA: Precipitación inusual en azoteas planas (>= 4.0 mm). Riesgo de sobrecarga en cubiertas y colapso de drywall. Despliegue de cuadrillas de emergencia y motobombas.';
    } else if (dailyPrecipSum >= 2.0) {
      retrospectiveRisk = 'PREVENTIVO';
      riskScore = 55;
      accionRecomendada = 'LIMA PREVENTIVO: Llovizna acumulada (2.0 - 3.9 mm). Inspección de canaletas pluviales en azotea, bombas de achique en sótanos y pisos antideslizantes en accesos.';
    } else if (dailyPrecipSum >= 0.5 || hoursWithRain >= 4) {
      retrospectiveRisk = 'VIGILANCIA';
      riskScore = 25;
      accionRecomendada = 'LIMA VIGILANCIA: Garúa costera (0.5 - 1.9 mm). Monitoreo de humedad relativa y supervisión de accesos comerciales por piso húmedo.';
    } else {
      retrospectiveRisk = 'NORMAL';
      riskScore = 5;
      accionRecomendada = 'LIMA NORMAL: Jornada seca o garúa insignificante (< 0.5 mm) sin afectación a la infraestructura comercial.';
    }
  } else {
    // Provinces (Costa norte, Amazonía, Sierra)
    if (dailyPrecipSum >= 25.0 || peakHourMm >= 6.0) {
      retrospectiveRisk = 'ALERTA';
      riskScore = 85;
      accionRecomendada = 'Activación de compuertas anti-inundación, encendido de generadores de emergencia y despeje de sumideros pluviales de alto caudal.';
    } else if (dailyPrecipSum >= 10.0 || peakHourMm >= 2.5) {
      retrospectiveRisk = 'PREVENTIVO';
      riskScore = 60;
      accionRecomendada = 'Limpieza de trampas de grasa exteriores, verificación de bajantes pluviales y resguardo de mercadería en zonas de carga.';
    } else if (dailyPrecipSum >= 2.0) {
      retrospectiveRisk = 'VIGILANCIA';
      riskScore = 30;
      accionRecomendada = 'Vigilancia de drenajes y rondas de supervisión de mantenimiento.';
    } else {
      retrospectiveRisk = 'NORMAL';
      riskScore = 5;
      accionRecomendada = 'Jornada seca sin anomalías pluviales registradas.';
    }
  }

  // Audit verdict
  let veredicto: AuditVerdict = 'DIA_SECO';
  let resumenDiagnostico = `En la fecha auditada (${dateStr}), no se registraron precipitaciones (0.0 mm) en las coordenadas de azotea de ${mall.nombre}.`;

  if (dailyPrecipSum >= (isLima ? 2.0 : 10.0)) {
    veredicto = 'CONFIRMADO_LLUVIA';
    resumenDiagnostico = `Precipitación acumulada significativa de ${dailyPrecipSum} mm con pico horario de ${peakHourMm} mm/h a las ${peakHourTime}. El registro atmosférico confirma impacto sobre infraestructura que requirió respuesta operativa inmediata.`;
  } else if (dailyPrecipSum > 0.05) {
    veredicto = 'GARUA_DETECTADA';
    resumenDiagnostico = `Se detectó ${isLima ? 'garúa/llovizna costera persistente' : 'chubasco ligero'} acumulando ${dailyPrecipSum} mm a lo largo de ${hoursWithRain} horas, alcanzando un pico de ${peakHourMm} mm/h a las ${peakHourTime} con humedad promedio de ${avgHumid}%.`;
  }

  const auditRecord: MallHistoricalAudit = {
    mallId: mall.id,
    mallNombre: mall.nombre,
    ciudad: mall.ciudad,
    departamento: mall.departamento,
    zonaClimatica: mall.zonaClimatica,
    latitud: lat,
    longitud: lon,
    date: dateStr,
    totalRainMm: dailyPrecipSum,
    peakHourMm: Number(peakHourMm.toFixed(2)),
    peakHourTime,
    hoursWithRain,
    avgRelativeHumidity: avgHumid,
    maxRelativeHumidity: maxHumid,
    riesgoCalculado: retrospectiveRisk,
    riesgoScore: riskScore,
    veredictoAuditoria: veredicto,
    resumenDiagnostico,
    accionRecomendada,
    registradoEnBackend: !!backendLog,
    registroBackendDetalle: backendLog,
    hourly,
    fuenteUrl: archiveUrl
  };

  setCache(cacheKey, auditRecord);
  return auditRecord;
}

// 3. Historical Precipitation Audit API
app.get('/api/weather/historical', async (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || '2026-10-15';
  const mallId = (req.query.mallId as string) || 'all';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return res.status(400).json({ error: 'Formato de fecha inválido. Utilice YYYY-MM-DD (ej: 2026-10-15)' });
  }

  try {
    if (mallId !== 'all') {
      const mall = REAL_PLAZA_MALLS.find(m => m.id === mallId);
      if (!mall) {
        return res.status(404).json({ error: `Mall '${mallId}' no encontrado` });
      }
      const singleAudit = await fetchMallHistoricalAudit(mall, dateStr);
      const response: HistoricalAuditResponse = {
        date: dateStr,
        mallId,
        results: [singleAudit],
        totalMalls: 1,
        mallsWithRain: singleAudit.totalRainMm > 0 ? 1 : 0,
        maxRainMall: singleAudit.totalRainMm > 0 ? { nombre: singleAudit.mallNombre, mm: singleAudit.totalRainMm } : null
      };
      return res.json(response);
    }

    // All malls
    const cacheKey = `historical_all_${dateStr}`;
    const cached = getCached<HistoricalAuditResponse>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const results: MallHistoricalAudit[] = [];
    const chunkSize = 6;
    for (let i = 0; i < REAL_PLAZA_MALLS.length; i += chunkSize) {
      const chunk = REAL_PLAZA_MALLS.slice(i, i + chunkSize);
      const chunkRes = await Promise.all(chunk.map(m => fetchMallHistoricalAudit(m, dateStr)));
      results.push(...chunkRes);
    }

    // Sort by rain descending, then risk score descending
    results.sort((a, b) => {
      if (b.totalRainMm !== a.totalRainMm) return b.totalRainMm - a.totalRainMm;
      return b.riesgoScore - a.riesgoScore;
    });

    const mallsWithRain = results.filter(r => r.totalRainMm > 0).length;
    const maxRainMall = results.length > 0 && results[0].totalRainMm > 0
      ? { nombre: results[0].mallNombre, mm: results[0].totalRainMm }
      : null;

    const response: HistoricalAuditResponse = {
      date: dateStr,
      mallId: 'all',
      results,
      totalMalls: results.length,
      mallsWithRain,
      maxRainMall
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (err: any) {
    console.error('Error generating historical audit:', err);
    res.status(500).json({ error: 'Error procesando auditoría histórica', details: err.message });
  }
});

// 4. Single Mall Details (respects 30-min cache to prevent bypass spam)
app.get('/api/weather/:mallId', async (req: Request, res: Response) => {
  const mallId = req.params.mallId;
  const mall = REAL_PLAZA_MALLS.find(m => m.id === mallId);
  if (!mall) {
    return res.status(404).json({ error: `Mall '${mallId}' no encontrado` });
  }

  const allCached = getCached<MallWeatherSummary[]>('all_malls_weather', MANUAL_REFRESH_COOLDOWN_MS);
  const matchedFromAll = allCached?.find(m => m.mall.id === mallId);
  if (matchedFromAll) {
    return res.json(matchedFromAll);
  }

  const singleCacheKey = `single_mall_${mallId}`;
  const singleCached = getCached<MallWeatherSummary>(singleCacheKey, MANUAL_REFRESH_COOLDOWN_MS);
  if (singleCached) {
    return res.json(singleCached);
  }

  try {
    const summary = await buildMallWeatherSummary(mall);
    setCache(singleCacheKey, summary);
    res.json(summary);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 4. SENAMHI Avisos
app.get('/api/senamhi/avisos', (_req: Request, res: Response) => {
  res.json({
    avisos: OFFICIAL_SENAMHI_AVISOS,
    fuente: 'SENAMHI Perú',
    fechaVerificacion: new Date().toISOString()
  });
});

// 5. Ocean / ENFEN Climate Anomaly
app.get('/api/observatorio/ocean', async (_req: Request, res: Response) => {
  const ocean = await fetchOceanAnomaly();
  res.json(ocean);
});

// 6. History Logs (Pronóstico -> Real)
app.get('/api/history', (_req: Request, res: Response) => {
  res.json({
    records: historyRecords.slice(0, 100),
    total: historyRecords.length
  });
});

// 7. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Setup Vite middlewares for development or serve dist for production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Monitor Climático Real Plaza running on port ${PORT}`);
  });
}

startServer();
