import { MallWeatherSummary, TimeHorizon } from '../types';

export interface HorizonMetric {
  value: number;
  unit: 'mm' | 'mm/h';
  shortLabel: string; // "Actual (hora)", "Próx. 24 h", "48 horas", "3 días", "7 días"
  compactTag: string; // "Actual", "Próx. 24h", "48h", "3d", "7d"
  formatted: string;  // "50.4 mm" or "2.2 mm/h"
  pinText: string;    // "50.4mm" or "2.2mm/h"
}

export function getCurrentLimaHourIndex(summary: MallWeatherSummary): number {
  if (!summary.hourly48h || summary.hourly48h.length === 0) return 0;

  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      hour12: false
    }).formatToParts(new Date());

    const dd = parts.find(p => p.type === 'day')?.value || '';
    const mm = parts.find(p => p.type === 'month')?.value || '';
    const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10) % 24;
    const todayStr = `${dd}/${mm}`;

    const idx = summary.hourly48h.findIndex(
      h => h.displayDate === todayStr && parseInt(h.displayTime.split(':')[0], 10) === hh
    );
    if (idx >= 0) return idx;
  } catch {
    // Fallback to 0 if Intl fails
  }

  return 0;
}

export function getCurrentLimaHourPrecip(summary: MallWeatherSummary): number {
  if (!summary.hourly48h || summary.hourly48h.length === 0) return 0;
  const idx = getCurrentLimaHourIndex(summary);
  return summary.hourly48h[idx]?.precipitationMm ?? 0;
}

/**
 * Rain expected from the next hour until 23:00 of today (remaining calendar day).
 */
export function getRemainingTodayPrecip(summary: MallWeatherSummary): number {
  if (!summary.hourly48h || summary.hourly48h.length === 0) return summary.lluvia24hMm;
  const idx = getCurrentLimaHourIndex(summary);
  const todayLimit = Math.min(24, summary.hourly48h.length);
  if (idx >= todayLimit - 1) return 0;
  const sum = summary.hourly48h
    .slice(idx + 1, todayLimit)
    .reduce((acc, h) => acc + (h.precipitationMm || 0), 0);
  return Number(sum.toFixed(1));
}

/**
 * Rain already fallen/occurring today up to and including the current hour.
 */
export function getFallenTodayPrecip(summary: MallWeatherSummary): number {
  if (!summary.hourly48h || summary.hourly48h.length === 0) return 0;
  const idx = getCurrentLimaHourIndex(summary);
  const todayLimit = Math.min(24, summary.hourly48h.length);
  const end = Math.min(idx + 1, todayLimit);
  const sum = summary.hourly48h
    .slice(0, end)
    .reduce((acc, h) => acc + (h.precipitationMm || 0), 0);
  return Number(sum.toFixed(1));
}

/**
 * Expected rainfall in the rolling next 24 hours starting from the current Lima hour.
 */
export function getNext24hRollingPrecip(summary: MallWeatherSummary): number {
  if (!summary.hourly48h || summary.hourly48h.length === 0) return summary.lluvia24hMm;
  const idx = getCurrentLimaHourIndex(summary);
  const slice = summary.hourly48h.slice(idx, Math.min(idx + 24, summary.hourly48h.length));
  const sum = slice.reduce((acc, h) => acc + (h.precipitationMm || 0), 0);
  return Number(sum.toFixed(1));
}

export function getHorizonMetric(summary: MallWeatherSummary, horizon: TimeHorizon): HorizonMetric {
  switch (horizon) {
    case 'actual': {
      const val = getCurrentLimaHourPrecip(summary);
      return {
        value: val,
        unit: 'mm/h',
        shortLabel: 'Actual (hora)',
        compactTag: 'Actual',
        formatted: `${val.toFixed(1)} mm/h`,
        pinText: `${val.toFixed(1)}mm/h`
      };
    }
    case '48h':
      return {
        value: summary.lluvia48hMm,
        unit: 'mm',
        shortLabel: '48 horas',
        compactTag: '48h',
        formatted: `${summary.lluvia48hMm.toFixed(1)} mm`,
        pinText: `${summary.lluvia48hMm.toFixed(1)}mm`
      };
    case '3d':
      return {
        value: summary.lluvia3dMm,
        unit: 'mm',
        shortLabel: '3 días',
        compactTag: '3d',
        formatted: `${summary.lluvia3dMm.toFixed(1)} mm`,
        pinText: `${summary.lluvia3dMm.toFixed(1)}mm`
      };
    case '7d':
      return {
        value: summary.lluvia7dMm,
        unit: 'mm',
        shortLabel: '7 días',
        compactTag: '7d',
        formatted: `${summary.lluvia7dMm.toFixed(1)} mm`,
        pinText: `${summary.lluvia7dMm.toFixed(1)}mm`
      };
    case '24h':
    default: {
      const val = getNext24hRollingPrecip(summary);
      return {
        value: val,
        unit: 'mm',
        shortLabel: 'Próx. 24 h',
        compactTag: 'Próx. 24h',
        formatted: `${val.toFixed(1)} mm`,
        pinText: `${val.toFixed(1)}mm`
      };
    }
  }
}
