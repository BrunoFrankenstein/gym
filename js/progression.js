// Sugerencia local de sobrecarga progresiva: "doble progresión" guiada por RIR.
//
// Idea: dentro de un rango de reps (ej. 8-12) primero se suman reps con el mismo peso;
// cuando TODAS las series con el peso más alto llegan al tope del rango sin ir al fallo
// (RIR cerca del objetivo), se sube un escalón de peso y se vuelve al piso del rango.
// Es el esquema que recomiendan Helms et al. (The Muscle & Strength Pyramids) y es
// consistente con la evidencia de que entrenar a 0-3 RIR da hipertrofia similar a ir al
// fallo (Refalo et al., 2023). Claude afina esto en el repaso semanal con más contexto;
// esta regla es la ayuda inmediata, sin internet, en el momento de entrenar.
//
// RIR = reps en reserva: cuántas reps más podrías haber hecho con buena técnica.

const round = x => Math.round(x * 4) / 4; // múltiplos de 0,25 kg

export function suggest({ target, last, increment = 2.5 }) {
  const rirGoal = target?.rir ?? 2;

  if (!last) {
    if (target?.weight) {
      return { weight: target.weight, reps: target.repMin ?? null, text: `Peso sugerido por el plan: ${target.weight} kg.` };
    }
    return { weight: null, reps: target?.repMin ?? null, text: `Primera vez: buscá un peso que te deje ~${rirGoal} reps en reserva.` };
  }

  // Se mira sólo el peso más alto de la última vez: las series más livianas suelen ser
  // de aproximación o "back-off" y no dicen si ya toca subir.
  const top = Math.max(...last.sets.map(s => s.weight || 0));
  const topSets = last.sets.filter(s => (s.weight || 0) === top);
  const minReps = Math.min(...topSets.map(s => s.reps));
  const rirs = topSets.map(s => s.rir).filter(r => r != null);
  const minRir = rirs.length ? Math.min(...rirs) : null;
  const canAddWeight = increment > 0;
  const up = round(top + increment);

  if (target?.repMax) {
    const { repMin, repMax } = target;
    if (minReps >= repMax) {
      // Tolerancia de 1 RIR: si el objetivo es RIR 2 y quedaste en RIR 1, igual se sube.
      if (canAddWeight && (minRir == null || minRir >= rirGoal - 1)) {
        return { weight: up, reps: repMin, text: `Llegaste a ${repMax} reps en todas las series → subí a ${up} kg y volvé a ${repMin} reps.` };
      }
      if (!canAddWeight) {
        return { weight: top, reps: repMax + 1, text: `Tope del rango alcanzado. Sin escalón de peso: sumá una rep o pasá a una variante más difícil.` };
      }
      return { weight: top, reps: repMax, text: `Llegaste al tope pero muy cerca del fallo (RIR ${minRir}) → repetí ${top} kg buscando RIR ${rirGoal}.` };
    }
    if (minReps < repMin && minRir === 0 && canAddWeight && top - increment > 0) {
      const down = round(top - increment);
      return { weight: down, reps: repMin, text: `No llegaste a ${repMin} reps yendo al fallo → bajá a ${down} kg.` };
    }
    const goal = Math.min(minReps + 1, repMax);
    return { weight: top, reps: goal, text: `Mismo peso (${top} kg), buscá ${goal} reps por serie.` };
  }

  // Sin rango definido (entrenamiento libre): se decide sólo con el RIR.
  if (minRir == null) {
    return { weight: top, reps: minReps + 1, text: `Última vez ${top} kg × ${minReps}. Intentá una rep más (cargá el RIR para mejores sugerencias).` };
  }
  if (minRir >= 3 && canAddWeight) {
    return { weight: up, reps: minReps, text: `Te sobraban ${minRir}+ reps → subí a ${up} kg.` };
  }
  if (minRir >= 1) {
    return { weight: top, reps: minReps + 1, text: `Mismo peso (${top} kg), intentá ${minReps + 1} reps.` };
  }
  return { weight: top, reps: minReps, text: `Fuiste al fallo → repetí ${top} kg × ${minReps} con mejor técnica antes de subir.` };
}
