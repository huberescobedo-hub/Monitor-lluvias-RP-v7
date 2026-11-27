export type RiskLevel = 'NORMAL' | 'VIGILANCIA' | 'PREVENTIVO' | 'ALERTA';

export type ClimateZone = 'Costa norte' | 'Costa centro' | 'Sierra centro' | 'Sierra sur' | 'Amazonía';

export type MonitoringPriority = 'ALTA' | 'MEDIA' | 'ESTÁNDAR';

export type TimeHorizon = 'actual' | '24h' | '48h' | '3d' | '7d';

export interface RealPlazaMall {
  id: string;
  nombre: string;
  nombreCorto: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  activo: boolean;
  prioridadMonitoreo: MonitoringPriority;
  zonaClimatica: ClimateZone;
}

export interface SenamhiAviso {
  id: string;
  numero: string;
  nivel: 'Amarillo' | 'Naranja' | 'Rojo';
  fenomeno: string;
  inicio: string;
  fin: string;
  zonaAfectada: string;
  departamentos: string[];
  descripcion: string;
  fuente: string;
  fechaEmision: string;
}

export interface NowcastingStatus {
  estadoActual: 'Normal' | 'Lluvia ligera' | 'Lluvia moderada' | 'Lluvia fuerte' | 'Tormenta';
  nivelRiesgo: RiskLevel;
  plus1h: string;
  plus2h: string;
  fuente: string;
  ultimaActualizacion: string;
}

export interface HourlyForecast {
  time: string; // ISO string or format
  displayTime: string; // "14:00"
  displayDate: string; // "26/10"
  precipitationMm: number;
  precipitationProbability: number;
  temperatureC: number;
  relativeHumidity: number;
  windSpeedKmH: number;
  isPeakRisk?: boolean;
}

export interface DailyForecast {
  date: string; // "2026-10-22"
  dayName: string; // "LUN 26"
  condition: 'soleado' | 'parcial' | 'nublado' | 'lluvia_ligera' | 'lluvia_moderada' | 'lluvia_fuerte' | 'tormenta';
  precipitationSumMm: number;
  precipitationProbabilityMax: number;
  temperatureMinC: number;
  temperatureMaxC: number;
  dailyRisk: RiskLevel;
  inicioEstimado?: string;
  horaPico?: string;
}

export interface ObservedVsForecast {
  observado24hMm: number;
  pronosticadoAnteriorMm: number | null;
  diferenciaMm: number | null;
  desviacionPct: number | null;
  evaluacionCalidad: 'Preciso' | 'Subestimado' | 'Sobrestimado' | 'Sin referencia previa';
  fuenteObservada: string;
  timestampObservado: string;
}

export interface MallWeatherSummary {
  mall: RealPlazaMall;
  riesgo: RiskLevel;
  riesgoScore: number; // 0 - 100 for ranking
  recomendacionOperativa: string | null;
  
  // Current & Highlights
  temperaturaActualC: number;
  humedadActualPct: number;
  vientoActualKmH: number;
  probabilidadMax24h: number;
  
  // Rain metrics
  lluvia24hMm: number;
  lluvia48hMm: number;
  lluvia3dMm: number;
  lluvia7dMm: number;
  
  // Timing
  franjaMayorRiesgo: string; // "15:00 - 19:00"
  diaMayorLluvia: string; // "Lunes 26"
  inicioEstimadoLluvia?: string; // "Desde las 15:00 (En curso)" o "~22:00 (Hoy 26/11)"
  
  // Senamhi & official
  avisoSenamhi: SenamhiAviso | null;
  nowcasting: NowcastingStatus | null;
  
  // Observed vs Forecast
  lluviaObservada: ObservedVsForecast;
  
  // Detailed series
  hourly48h: HourlyForecast[];
  daily7d: DailyForecast[];
  
  // Traceability
  fuentes: {
    nombre: string;
    tipo: 'Observado' | 'Pronóstico' | 'Satelital' | 'Aviso oficial';
    timestamp: string;
    estado: 'OK' | 'CACHE' | 'FALLO';
  }[];
  ultimaActualizacion: string;
  // Spatial Cross-Validation & Outlier Filter
  validacionEspacial?: SpatialValidation;
  esDatoDemostrativo?: boolean;
}

export interface SpatialValidation {
  estado: 'VALIDADO' | 'CALIBRADO_ANOMALIA' | 'ESTACION_DIRECTA';
  esAnomaliaCorregida: boolean;
  valorOriginalMm?: number;
  valorCalibradoMm?: number;
  clusterDistrital: string;
  estacionesReferencia: string[];
  mensajeDiagnostico: string;
}

export interface OceanAnomalyData {
  semana: string;
  anomaliaNino12: number;
  temperaturaNino12: number;
  anomaliaNino34: number;
  temperaturaNino34: number;
  estadoAlertaEnfen: string;
  comunicadoEnfen: string;
  fechaComunicado: string;
  fuente: string;
}

export interface HistoricalForecastRecord {
  id: string;
  timestampConsulta: string;
  mallId: string;
  mallNombre: string;
  fechaObjetivo: string;
  probabilidadPrevista: number;
  precipitacionPrevista: number;
  precipitacionObservada: number | null;
  avisoSenamhi: string | null;
  nowcasting: string | null;
  riesgoRP: RiskLevel;
  fuente: string;
  timestampFuente: string;
}

export interface HistoricalHourlyPoint {
  hour: string; // "00:00", "01:00", etc.
  fullTime: string; // ISO string
  precipitationMm: number;
  temperatureC: number;
  relativeHumidity: number;
  windSpeedKmH: number;
}

export type AuditVerdict = 'CONFIRMADO_LLUVIA' | 'GARUA_DETECTADA' | 'DIA_SECO' | 'SIN_DATOS';

export interface MallHistoricalAudit {
  mallId: string;
  mallNombre: string;
  ciudad: string;
  departamento: string;
  zonaClimatica: ClimateZone;
  latitud: number;
  longitud: number;
  date: string; // "2026-10-15"
  totalRainMm: number;
  peakHourMm: number;
  peakHourTime: string; // "22:00"
  hoursWithRain: number;
  avgRelativeHumidity: number;
  maxRelativeHumidity: number;
  riesgoCalculado: RiskLevel;
  riesgoScore: number;
  veredictoAuditoria: AuditVerdict;
  resumenDiagnostico: string;
  accionRecomendada: string;
  registradoEnBackend: boolean;
  registroBackendDetalle?: HistoricalForecastRecord | null;
  hourly: HistoricalHourlyPoint[];
  fuenteUrl: string;
}

export interface HistoricalAuditResponse {
  date: string;
  mallId: string;
  results: MallHistoricalAudit[];
  totalMalls: number;
  mallsWithRain: number;
  maxRainMall: {
    nombre: string;
    mm: number;
  } | null;
}

export type SortOption = 'riesgo' | 'probabilidad' | 'lluvia24h' | 'lluvia7d' | 'nombre';

export interface FilterState {
  mallId: string; // 'all' or specific id
  departamento: string; // 'all' or dept
  riesgo: string; // 'all' or RiskLevel
  horizonte: TimeHorizon;
  soloCriticos: boolean;
  conAvisoSenamhi: boolean;
  probabilidadMayor80: boolean;
  searchQuery: string;
  ordenarPor: SortOption;
}
