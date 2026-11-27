import { RiskLevel, SenamhiAviso, NowcastingStatus, HourlyForecast } from '../types';

export interface RiskInput {
  probabilidadMax24h: number;
  lluvia24hMm: number;
  lluvia48hMm: number;
  maxPrecipitacionHorariaMm: number;
  avisoSenamhi: SenamhiAviso | null;
  nowcasting: NowcastingStatus | null;
  temperaturaActualC?: number;
  humedadActualPct?: number;
  zonaClimatica?: string;
}

export interface RiskEvaluation {
  nivel: RiskLevel;
  score: number; // 0 to 100
  factoresClave: string[];
  recomendacionOperativa: string | null;
  franjaMayorRiesgo: string;
  inicioEstimadoLluvia: string;
}

/**
 * Motor de Evaluación de Riesgo Preventivo Real Plaza.
 * Clasificación preventiva interna enfocada en la infraestructura y operación de centros comerciales.
 * NO corresponde a una categoría oficial de SENAMHI.
 */
export function calculateRealPlazaRisk(
  input: RiskInput,
  hourly: HourlyForecast[] = []
): RiskEvaluation {
  let score = 0;
  const factores: string[] = [];

  const isLima = input.zonaClimatica === 'Costa centro';
  const horasConPrecip = hourly.slice(0, 24).filter((h) => h.precipitationMm > 0.05).length;

  // 1. Evaluación por volumen de lluvia 24h y 48h (Diferenciado por vulnerabilidad regional - MODELO B)
  if (isLima) {
    // LIMA METROPOLITANA: Clima árido desértico sin drenajes pluviales urbanos.
    // Techos planos, membranas asfálticas y falsos techos de drywall sufren con 1.5 - 3.0 mm.
    if (input.lluvia24hMm >= 3.0 || input.lluvia48hMm >= 5.5) {
      score += 45;
      factores.push(`Volumen crítico para Lima (${input.lluvia24hMm.toFixed(1)} mm 24h / ${input.lluvia48hMm.toFixed(1)} mm 48h)`);
    } else if (input.lluvia24hMm >= 1.8 || input.lluvia48hMm >= 4.0) {
      score += 34;
      factores.push(`Llovizna persistente moderada-alta en Lima (${input.lluvia24hMm.toFixed(1)} mm)`);
    } else if (input.lluvia24hMm >= 1.0 || input.lluvia48hMm >= 2.2) {
      score += 24;
      factores.push(`Garúa acumulada en Lima (${input.lluvia24hMm.toFixed(1)} mm)`);
    } else if (input.lluvia24hMm >= 0.4) {
      score += 12;
      factores.push(`Llovizna ligera (${input.lluvia24hMm.toFixed(1)} mm)`);
    }

    // Persistencia horaria en Lima: llovizna fina durante horas satura cubiertas y accesos
    if (horasConPrecip >= 6) {
      score += 18;
      factores.push(`Garúa persistente continua (${horasConPrecip} horas con precipitación activa)`);
    } else if (horasConPrecip >= 3) {
      score += 10;
      factores.push(`Llovizna intermitente (${horasConPrecip} horas activas)`);
    }

    // Ponderación multi-ventana 48h para Lima (Modelo B):
    if (input.lluvia48hMm >= 6.0) {
      score += 12;
      factores.push(`Saturación acumulada 48h en Lima: ${input.lluvia48hMm.toFixed(1)} mm`);
    } else if (input.lluvia48hMm >= 3.5) {
      score += 6;
      factores.push(`Acumulación sostenida 48h en Lima: ${input.lluvia48hMm.toFixed(1)} mm`);
    }
  } else {
    // PROVINCIAS (Costa norte, Amazonía, Sierra): Infraestructura preparada para volúmenes mayores (MODELO B)
    if (input.lluvia24hMm >= 25) {
      score += 40;
      factores.push(`Volumen crítico 24h: ${input.lluvia24hMm.toFixed(1)} mm`);
    } else if (input.lluvia24hMm >= 12) {
      score += 28;
      factores.push(`Lluvia moderada a fuerte 24h: ${input.lluvia24hMm.toFixed(1)} mm`);
    } else if (input.lluvia24hMm >= 5) {
      score += 18;
      factores.push(`Precipitación esperada 24h: ${input.lluvia24hMm.toFixed(1)} mm`);
    } else if (input.lluvia24hMm >= 1) {
      score += 8;
      factores.push(`Lloviznas menores 24h: ${input.lluvia24hMm.toFixed(1)} mm`);
    }

    // Ponderación multi-ventana 48h para Provincias (Modelo B):
    if (input.lluvia48hMm >= 35) {
      score += 14;
      factores.push(`Acumulación multi-día 48h: ${input.lluvia48hMm.toFixed(1)} mm`);
    } else if (input.lluvia48hMm >= 20) {
      score += 7;
      factores.push(`Acumulación sostenida 48h: ${input.lluvia48hMm.toFixed(1)} mm`);
    }
  }

  // 2. Concentración horaria (pico de intensidad por hora)
  if (isLima) {
    if (input.maxPrecipitacionHorariaMm >= 1.2) {
      score += 22;
      factores.push(`Pico horario anómalo en Lima: ${input.maxPrecipitacionHorariaMm.toFixed(1)} mm/h`);
    } else if (input.maxPrecipitacionHorariaMm >= 0.5) {
      score += 12;
      factores.push(`Intensidad de garúa: ${input.maxPrecipitacionHorariaMm.toFixed(1)} mm/h`);
    }
  } else {
    if (input.maxPrecipitacionHorariaMm >= 8) {
      score += 25;
      factores.push(`Pico horario severo: ${input.maxPrecipitacionHorariaMm.toFixed(1)} mm/h`);
    } else if (input.maxPrecipitacionHorariaMm >= 4) {
      score += 15;
      factores.push(`Concentración horaria moderada: ${input.maxPrecipitacionHorariaMm.toFixed(1)} mm/h`);
    } else if (input.maxPrecipitacionHorariaMm >= 1.5) {
      score += 8;
    }
  }

  // 3. Probabilidad de precipitación
  if (input.probabilidadMax24h >= 80) {
    score += 22;
    factores.push(`Probabilidad muy alta: ${input.probabilidadMax24h}%`);
  } else if (input.probabilidadMax24h >= 60) {
    score += 14;
    factores.push(`Probabilidad media-alta: ${input.probabilidadMax24h}%`);
  } else if (input.probabilidadMax24h >= 40) {
    score += 8;
  }

  // 4. Incidencia de Avisos Oficiales SENAMHI (Filtrados por sub-región y bioma en Modelo B)
  if (input.avisoSenamhi) {
    if (input.avisoSenamhi.nivel === 'Rojo') {
      score += 30;
      factores.push(`Aviso SENAMHI Rojo (${input.avisoSenamhi.fenomeno})`);
    } else if (input.avisoSenamhi.nivel === 'Naranja') {
      score += 20;
      factores.push(`Aviso SENAMHI Naranja (${input.avisoSenamhi.fenomeno})`);
    } else if (input.avisoSenamhi.nivel === 'Amarillo') {
      score += 10;
      factores.push(`Aviso SENAMHI Amarillo (${input.avisoSenamhi.fenomeno})`);
    }
  }

  // 5. Nowcasting a corto plazo (0-2 horas)
  if (input.nowcasting) {
    if (input.nowcasting.nivelRiesgo === 'ALERTA') {
      score += 25;
      factores.push(`Nowcasting SENAMHI: Lluvia intensa inmediata`);
    } else if (input.nowcasting.nivelRiesgo === 'PREVENTIVO') {
      score += 15;
      factores.push(`Nowcasting SENAMHI: Evento en desarrollo`);
    } else if (input.nowcasting.nivelRiesgo === 'VIGILANCIA') {
      score += 8;
    }
  }

  // Ajuste según zona climática (ej. Costa norte y Amazonía son altamente sensibles al Fenómeno El Niño)
  if (input.zonaClimatica === 'Costa norte' && input.lluvia24hMm > 3) {
    score += 5;
  }

  // Normalizar score a 0-100
  score = Math.min(100, Math.max(0, score));

  // Determinar Nivel de Riesgo (Calibrado por región - MODELO B)
  let nivel: RiskLevel = 'NORMAL';

  if (isLima) {
    // ESCALA DE 4 NIVELES CALIBRADA PARA LIMA METROPOLITANA:
    // 1. ALERTA: Precipitación >= 4.0 mm Y Probabilidad >= 70% (o aviso SENAMHI Naranja/Rojo).
    // 2. PREVENTIVO: Precipitación entre 2.0 mm y 3.9 mm Y Probabilidad >= 40% (o >= 4.0 mm con prob 40-69%).
    // 3. VIGILANCIA: Precipitación entre 0.5 mm y 1.9 mm Y Probabilidad >= 35% (o persistencia >= 5 horas).
    // 4. NORMAL: Precipitación < 0.5 mm o sin probabilidad significativa (< 35%).
    const esAlertaCritica = 
      (input.lluvia24hMm >= 4.0 && input.probabilidadMax24h >= 70) ||
      input.avisoSenamhi?.nivel === 'Rojo' ||
      (input.avisoSenamhi?.nivel === 'Naranja' && input.lluvia24hMm >= 2.0) ||
      (input.nowcasting?.nivelRiesgo === 'ALERTA' && input.lluvia24hMm >= 2.0) ||
      (input.lluvia48hMm >= 7.0 && input.probabilidadMax24h >= 70);

    const esPreventivo = 
      !esAlertaCritica && (
        (input.lluvia24hMm >= 2.0 && input.lluvia24hMm < 4.0 && input.probabilidadMax24h >= 40) ||
        (input.lluvia24hMm >= 4.0 && input.probabilidadMax24h >= 40) ||
        input.avisoSenamhi?.nivel === 'Naranja' ||
        (input.avisoSenamhi?.nivel === 'Amarillo' && input.lluvia24hMm >= 1.5) ||
        (input.nowcasting?.nivelRiesgo === 'PREVENTIVO' && input.lluvia24hMm >= 1.5) ||
        (input.lluvia48hMm >= 4.0 && input.probabilidadMax24h >= 50) ||
        score >= 45
      );

    const esVigilancia = 
      !esAlertaCritica && !esPreventivo && (
        (input.lluvia24hMm >= 0.5 && input.lluvia24hMm < 2.0 && input.probabilidadMax24h >= 35) ||
        (input.lluvia24hMm >= 2.0 && input.probabilidadMax24h < 40) ||
        (horasConPrecip >= 5 && input.lluvia24hMm >= 0.4) ||
        input.avisoSenamhi !== null ||
        score >= 20
      );

    if (esAlertaCritica) {
      nivel = 'ALERTA';
    } else if (esPreventivo) {
      nivel = 'PREVENTIVO';
    } else if (esVigilancia) {
      nivel = 'VIGILANCIA';
    } else {
      nivel = 'NORMAL';
    }
  } else {
    // UMBRALES CALIBRADOS PARA PROVINCIAS (MODELO B):
    // Evita falsos rojos en Sierra por lluvias estacionales moderadas (ej. 6 - 8 mm).
    // Reserva ALERTA CRÍTICA para eventos reales de severidad o saturación acumulada.
    const esAlertaProvincias = 
      score >= 75 ||
      (input.lluvia24hMm >= 25 && input.probabilidadMax24h >= 65) ||
      (input.lluvia24hMm >= 18 && input.lluvia48hMm >= 35 && input.probabilidadMax24h >= 70) ||
      (input.avisoSenamhi?.nivel === 'Rojo' && input.lluvia24hMm >= 15);

    const esPreventivoProvincias = 
      !esAlertaProvincias && (
        score >= 48 ||
        (input.probabilidadMax24h >= 80 && input.lluvia24hMm >= 5) ||
        input.lluvia24hMm >= 12 ||
        (input.lluvia48hMm >= 22 && input.probabilidadMax24h >= 60) ||
        (input.avisoSenamhi?.nivel === 'Naranja' && input.lluvia24hMm >= 5)
      );

    const esVigilanciaProvincias = 
      !esAlertaProvincias && !esPreventivoProvincias && (
        score >= 22 ||
        input.probabilidadMax24h >= 50 ||
        input.lluvia24hMm >= 2.0 ||
        input.avisoSenamhi !== null
      );

    if (esAlertaProvincias) {
      nivel = 'ALERTA';
    } else if (esPreventivoProvincias) {
      nivel = 'PREVENTIVO';
    } else if (esVigilanciaProvincias) {
      nivel = 'VIGILANCIA';
    } else {
      nivel = 'NORMAL';
    }
  }

  // Identificar franja de mayor riesgo en las próximas horas
  let franjaMayorRiesgo = 'Sin franja crítica identificada';
  if (hourly.length > 0) {
    let maxHourlyRain = -1;
    let peakIndex = -1;
    for (let i = 0; i < Math.min(24, hourly.length); i++) {
      const h = hourly[i];
      const metric = (h.precipitationMm * 2) + (h.precipitationProbability / 25);
      if (metric > maxHourlyRain) {
        maxHourlyRain = metric;
        peakIndex = i;
      }
    }
    if (peakIndex >= 0 && (hourly[peakIndex].precipitationMm > (isLima ? 0.1 : 0.5) || hourly[peakIndex].precipitationProbability >= (isLima ? 35 : 50))) {
      const peakItem = hourly[peakIndex];
      const nextHour = (parseInt(peakItem.displayTime.split(':')[0], 10) + 3) % 24;
      const formattedNext = `${String(nextHour).padStart(2, '0')}:00`;
      franjaMayorRiesgo = `${peakItem.displayTime} – ${formattedNext}`;
      peakItem.isPeakRisk = true;
    }
  }

  // Estimar hora de inicio e intensidad actual/inicial de la lluvia
  let inicioEstimadoLluvia = 'Sin lluvia (48 h)';
  if (hourly.length > 0) {
    const limaParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      hour12: false
    }).formatToParts(new Date());
    const dd = limaParts.find(p => p.type === 'day')?.value || '';
    const mm = limaParts.find(p => p.type === 'month')?.value || '';
    const currentLimaHour = parseInt(limaParts.find(p => p.type === 'hour')?.value || '0', 10) % 24;
    const todayDisplay = `${dd}/${mm}`;

    const minMm = isLima ? 0.1 : 0.2;
    const minProb = isLima ? 30 : 35;
    const isSignificantRain = (h: HourlyForecast) =>
      (h.precipitationMm >= minMm && h.precipitationProbability >= minProb) || h.precipitationMm >= 0.4;

    const getIntensityLabel = (mmVal: number): string => {
      if (isLima) {
        if (mmVal >= 1.5) return 'Muy fuerte';
        if (mmVal >= 0.8) return 'Fuerte';
        if (mmVal >= 0.3) return 'Moderada';
        return 'Baja';
      } else {
        if (mmVal >= 5.0) return 'Muy fuerte';
        if (mmVal >= 2.5) return 'Fuerte';
        if (mmVal >= 0.8) return 'Moderada';
        return 'Baja';
      }
    };

    let currentIdx = hourly.findIndex(
      h => h.displayDate === todayDisplay && parseInt(h.displayTime.split(':')[0], 10) === currentLimaHour
    );
    if (currentIdx < 0) currentIdx = 0;

    if (isSignificantRain(hourly[currentIdx])) {
      let startIdx = currentIdx;
      while (startIdx > 0 && isSignificantRain(hourly[startIdx - 1])) {
        startIdx--;
      }
      const startItem = hourly[startIdx];
      const currentIntensity = getIntensityLabel(hourly[currentIdx].precipitationMm);
      const dayTag = startItem.displayDate === todayDisplay ? 'En curso' : startItem.displayDate;
      inicioEstimadoLluvia = `${startItem.displayTime} (${dayTag} · ${currentIntensity})`;
    } else {
      const nextIdx = hourly.findIndex((h, idx) => idx > currentIdx && isSignificantRain(h));
      if (nextIdx >= 0) {
        const nextItem = hourly[nextIdx];
        const nextIntensity = getIntensityLabel(nextItem.precipitationMm);
        const dayLabel = nextItem.displayDate === todayDisplay ? 'Hoy' : 'Mañana';
        inicioEstimadoLluvia = `~${nextItem.displayTime} (${dayLabel} · ${nextIntensity})`;
      } else {
        const prevToday = hourly.slice(0, currentIdx).find(h => isSignificantRain(h));
        if (prevToday) {
          inicioEstimadoLluvia = `~${prevToday.displayTime} (Previa hoy · Baja)`;
        }
      }
    }
  }

  // Asignar recomendación operativa según nivel y región
  let recomendacionOperativa: string | null = null;
  if (isLima) {
    if (nivel === 'ALERTA') {
      recomendacionOperativa = 'LIMA ALERTA CRÍTICA: Precipitación inusual (>= 4.0 mm con prob >= 70% o aviso SENAMHI). Riesgo de sobrecarga en cubiertas planas, colapso de sumideros y desprendimiento de drywall. Activar cuadrilla técnica de emergencia.';
    } else if (nivel === 'PREVENTIVO') {
      recomendacionOperativa = 'LIMA PREVENTIVO: Llovizna moderada-persistente (2.0 - 3.9 mm con prob >= 40%). Monitorear cubiertas planas, bombas de sumidero y colocar felpudos antideslizantes en accesos peatonales.';
    } else if (nivel === 'VIGILANCIA') {
      recomendacionOperativa = 'LIMA VIGILANCIA: Garúa ligera costera (0.5 - 1.9 mm). Inspección preventiva de rutina en cubiertas y sumideros.';
    } else {
      recomendacionOperativa = 'LIMA NORMAL: Condiciones estables (< 0.5 mm o prob < 35%). Operación y mantenimiento estándar.';
    }
  } else {
    if (nivel === 'ALERTA') {
      if (input.maxPrecipitacionHorariaMm >= 5) {
        recomendacionOperativa = 'Revisar drenajes, sumideros y bombas de achique. Activar cuadrilla de emergencia.';
      } else {
        recomendacionOperativa = 'Validar puntos críticos de ingreso de agua y asegurar cubiertas superiores.';
      }
    } else if (nivel === 'PREVENTIVO') {
      if (input.probabilidadMax24h >= 80) {
        recomendacionOperativa = 'Mantener monitoreo durante la franja crítica y despejar canaletas perimétricas.';
      } else {
        recomendacionOperativa = 'Verificar operatividad de sumideros y estanqueidad en áreas de carga.';
      }
    } else if (nivel === 'VIGILANCIA') {
      recomendacionOperativa = 'Monitoreo de rutina y verificación de alertas meteorológicas programadas.';
    }
  }

  return {
    nivel,
    score,
    factoresClave: factores,
    recomendacionOperativa,
    franjaMayorRiesgo,
    inicioEstimadoLluvia
  };
}

export const ACTIVE_RISK_MODEL = 'Modelo B (Calibrado 2026 - Multiescala & Filtro Sub-Regional)';
export const DISCLAIMER_REAL_PLAZA = 'Clasificación preventiva interna de Real Plaza (Modelo B Calibrado 2026 — Multiescala & Filtro Sub-Regional). No corresponde a una categoría oficial de SENAMHI.';
