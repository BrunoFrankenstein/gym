// Receta para cargar una carrera estructurada en el Apple Watch como "entrenamiento
// personalizado" (app Entrenamiento). Una web app no puede escribir en el Watch, así que
// la app te dice qué tocar, paso por paso y en el mismo orden en que el Watch lo pregunta:
// calentamiento → bloques (trabajo + recuperación, con repeticiones) → enfriamiento.
// Durante la carrera el Watch vibra (y avisa en los AirPods) en cada cambio de paso.
//
// Los nombres de menú son los de watchOS en castellano y pueden variar un poco según la
// versión; la estructura (calentamiento / bloques / enfriamiento) es la misma desde watchOS 9.

import { fmtDuration } from './running.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Objetivo del paso tal como se elige en el Watch: Distancia, Tiempo o Abierto.
function goal(step) {
  if (step.km != null) return `<b>Distancia</b> ${step.km < 1 ? `${Math.round(step.km * 1000)} m` : `${step.km} km`}`;
  if (step.min != null) return `<b>Tiempo</b> ${step.min % 1 ? fmtDuration(step.min * 60) : `${step.min} min`}`;
  return '<b>Abierto</b> (pasás de paso tocando la pantalla)';
}

// La alerta de ritmo del Watch se configura como rango. Si el plan da un ritmo único,
// se usa ±10 s/km: lo bastante angosto para que sirva y lo bastante ancho para que no
// vibre a cada rato por el ruido del GPS.
export function paceRange(pace) {
  const t = String(pace || '').replace(/\/?\s*km/i, '').trim();
  if (!t) return null; // paso sin ritmo: sin alerta
  // Sólo se aceptan ritmos con forma m:ss (ej. "4:50"); cualquier otra cosa no genera alerta.
  const toSec = x => { const m = x.match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
  const parts = t.split(/\s*[-–]\s*/).map(toSec).filter(v => v != null);
  if (!parts.length) return null;
  const [a, b] = parts.length > 1 ? parts.sort((x, y) => x - y) : [parts[0] - 10, parts[0] + 10];
  return `${fmtDuration(a)}–${fmtDuration(b)} /km`;
}

function stepLine(label, step) {
  const range = paceRange(step.pace);
  return `${label}: ${goal(step)}${range ? ` · alerta de <b>ritmo</b> ${range}` : ''} <span class="muted">(${esc(step.action)})</span>`;
}

export function hasSteps(run) {
  return !!run?.steps && (run.steps.blocks.length || run.steps.warmup || run.steps.cooldown);
}

// Devuelve el HTML de la receta. `name` es el nombre sugerido para guardarlo en el Watch.
export function recipeHtml(run, name) {
  const s = run.steps;
  const items = [
    `En el Watch abrí <b>Entrenamiento</b>, en <b>Correr al aire libre</b> tocá <b>⋯</b> → <b>Crear entrenamiento</b> → <b>Personalizado</b>.`,
    s.warmup ? stepLine('<b>Calentamiento</b>', s.warmup) : '<b>Calentamiento</b>: dejalo sin agregar.',
    ...s.blocks.map((b, i) => `<b>Bloque ${i + 1}</b>${i ? ' (tocá <b>Agregar bloque</b>)' : ''}:
      <ul>
        <li>${stepLine('Trabajo', b.work)}</li>
        ${b.recovery ? `<li>${stepLine('Recuperación', b.recovery)}</li>` : '<li>Recuperación: borrala (sin pausa entre repeticiones).</li>'}
        <li>Repeticiones: <b>${b.reps}</b></li>
      </ul>`),
    s.cooldown ? stepLine('<b>Enfriamiento</b>', s.cooldown) : '<b>Enfriamiento</b>: dejalo sin agregar.',
    `Nombre: <b>${esc(name)}</b> → <b>Crear entrenamiento</b>. Queda guardado para repetirlo.`,
    `El día de la carrera: Entrenamiento → <b>⋯</b> de Correr al aire libre → elegí <b>${esc(name)}</b>.`,
  ];
  return `<ol class="recipe">${items.map(i => `<li>${i}</li>`).join('')}</ol>
    ${summary(s)}
    <p class="muted small">Para escuchar los cambios en los auriculares: en el Watch, Ajustes → Entrenamiento → activá los
    <b>comentarios de voz</b>, y conectá los AirPods <b>al Watch</b> (si están conectados al iPhone no se escucha).
    Probalo en una salida corta la primera vez.</p>`;
}

// Total aproximado: suma tiempos y distancias de todos los pasos (con repeticiones).
function summary(s) {
  let min = 0, km = 0;
  const add = (st, n = 1) => { if (!st) return; if (st.min) min += st.min * n; if (st.km) km += st.km * n; };
  add(s.warmup);
  s.blocks.forEach(b => { add(b.work, b.reps); add(b.recovery, b.reps); });
  add(s.cooldown);
  const parts = [min ? `${Math.round(min)} min` : '', km ? `${Math.round(km * 10) / 10} km` : ''].filter(Boolean);
  return parts.length ? `<p class="small">Total de los pasos: <b>${parts.join(' + ')}</b>.</p>` : '';
}

// Armador propio: arma `steps` a partir del formulario simple (un solo bloque).
// unit = 'min' | 'km'.
export function buildSteps(f) {
  const step = (action, value, unit, pace = '') => {
    const v = parseFloat(String(value).replace(',', '.'));
    if (!v) return null;
    return { action, min: unit === 'min' ? v : null, km: unit === 'km' ? v : null, pace };
  };
  const work = step(f.workAction, f.workValue, f.workUnit, f.workPace);
  return {
    warmup: step('trotar', f.warmup, 'min'),
    blocks: work ? [{ reps: parseInt(f.reps, 10) || 1, work, recovery: step(f.recAction, f.recValue, f.recUnit, f.recPace) }] : [],
    cooldown: step('trotar', f.cooldown, 'min'),
  };
}
