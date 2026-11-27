import {
  MallWeatherSummary,
  OceanAnomalyData,
  HistoricalForecastRecord,
  SenamhiAviso,
  HistoricalAuditResponse
} from '../types';

export interface WeatherAllResponse {
  data: MallWeatherSummary[];
  cached: boolean;
  cooldownActive: boolean;
  lastUpdatedAt: number;
  nextRefreshAllowedAt: number;
  cooldownRemainingSeconds: number;
  refreshIntervalMinutes: number;
}

export async function fetchAllMallWeatherWithMeta(forceRefresh = false): Promise<WeatherAllResponse> {
  const url = `/api/weather/all${forceRefresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error en servidor: ${response.statusText}`);
  }
  const result = await response.json();
  const cooldownSeconds =
    typeof result.cooldownRemainingSeconds === 'number' ? result.cooldownRemainingSeconds : 30 * 60;
  const now = Date.now();
  return {
    data: result.data || [],
    cached: Boolean(result.cached),
    cooldownActive: Boolean(result.cooldownActive),
    lastUpdatedAt: typeof result.lastUpdatedAt === 'number' ? result.lastUpdatedAt : now,
    nextRefreshAllowedAt:
      typeof result.nextRefreshAllowedAt === 'number'
        ? result.nextRefreshAllowedAt
        : now + cooldownSeconds * 1000,
    cooldownRemainingSeconds: cooldownSeconds,
    refreshIntervalMinutes:
      typeof result.refreshIntervalMinutes === 'number' ? result.refreshIntervalMinutes : 30
  };
}

export async function fetchAllMallWeather(forceRefresh = false): Promise<MallWeatherSummary[]> {
  const result = await fetchAllMallWeatherWithMeta(forceRefresh);
  return result.data;
}

export async function fetchSingleMallWeather(mallId: string): Promise<MallWeatherSummary> {
  const response = await fetch(`/api/weather/${mallId}`);
  if (!response.ok) {
    throw new Error(`Error consultando sede: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchOceanAnomaly(): Promise<OceanAnomalyData | null> {
  try {
    const response = await fetch('/api/observatorio/ocean');
    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.warn('Could not fetch ocean anomaly:', err);
    return null;
  }
}

export async function fetchSenamhiAvisos(): Promise<SenamhiAviso[]> {
  try {
    const response = await fetch('/api/senamhi/avisos');
    if (!response.ok) return [];
    const json = await response.json();
    return json.avisos || [];
  } catch (err) {
    console.warn('Could not fetch SENAMHI avisos:', err);
    return [];
  }
}

export async function fetchHistoryRecords(): Promise<HistoricalForecastRecord[]> {
  try {
    const response = await fetch('/api/history');
    if (!response.ok) return [];
    const json = await response.json();
    return json.records || [];
  } catch (err) {
    console.warn('Could not fetch history records:', err);
    return [];
  }
}

export async function fetchHistoricalAudit(date: string, mallId = 'all'): Promise<HistoricalAuditResponse> {
  const response = await fetch(`/api/weather/historical?date=${encodeURIComponent(date)}&mallId=${encodeURIComponent(mallId)}`);
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || `Error consultando auditoría histórica: ${response.statusText}`);
  }
  return response.json();
}
