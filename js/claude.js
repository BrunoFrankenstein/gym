// Intercambio con Claude por copiar y pegar.
//
// La app arma un pedido en texto con todo el contexto (perfil, máquinas del gimnasio,
// carreras objetivo, plan actual, historial reciente) y le pide a Claude que responda con
// un bloque JSON de formato fijo. Vos pegás la respuesta y la app extrae ese JSON y lo
// convierte en el plan de la semana. Así se usa tu suscripción de Claude sin pagar API ni
// tener servidor.

import { state, activeGym, localDate, uid } from './store.js';
import { fmtDuration, fmtPace, daysUntil } from './running.js';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Formato que se le pide a Claude. Las claves están en castellano para que la respuesta
// sea legible si la abrís a mano. Un día puede traer "ejercicios" (gimnasio), "carrera"
// (running) o ambos.
const SCHEMA = `{
  "tipo": "plan-gym",
  "modo": "nuevo",
  "resumen": "1-2 frases con la lógica de la semana",
  "dias": [
    {
      "dia": "Lunes",
      "nombre": "Torso A + rodaje",
      "ejercicios": [
        { "nombre": "Press de pecho en máquina", "equipo": "Press de pecho", "series": 3,
          "repsMin": 8, "repsMax": 12, "rir": 2, "pesoKg": 40, "descansoSeg": 120, "notas": "" }
      ],
      "carrera": { "tipo": "intervalos", "distanciaKm": 7, "duracionMin": null, "ritmo": "4:50/km",
                   "descripcion": "6×800 m a ritmo de 10K",
                   "pasos": {
                     "calentamiento": { "accion": "trotar", "min": 10 },
                     "bloques": [
                       { "repeticiones": 6,
                         "trabajo": { "accion": "correr", "km": 0.8, "ritmo": "4:50" },
                         "recuperacion": { "accion": "caminar", "min": 2 } }
                     ],
                     "enfriamiento": { "accion": "trotar", "min": 5 }
                   } }
    }
  ],
  "progresion": [
    { "ejercicio": "Press de pecho en máquina", "consejo": "Subí a 45 kg: completaste 3×12 a RIR 2 (doble progresión)." }
  ],
  "notas": "advertencias, descarga (deload), puesta a punto para carreras, etc."
}`;

const load = p => `${p.daysPerWeek} sesiones de gimnasio y ${p.runDaysPerWeek} de running (pueden combinarse el mismo día), de ~${p.sessionMinutes} minutos cada día`;

const REQUESTS = {
  nuevo: p => `Armame el entrenamiento de los próximos 7 días: ${load(p)}. ` +
    `Para cada ejercicio de gimnasio indicá el peso sugerido según mi historial; si no hay historial de ese ejercicio, poné "pesoKg": null y lo calibro yo en la primera serie. Usá "modo": "nuevo".`,
  reorganizar: () => `Esta semana salteé sesiones o no voy a poder cumplir el plan (ver estado del plan y mi comentario). ` +
    `Reorganizá SÓLO las sesiones que quedan (no repitas las que figuran como HECHA) en los días que me quedan, priorizando lo más importante (volumen de los grupos musculares más atrasados, y la sesión de calidad o el fondo de running si hay una carrera cerca), sin hacer sesiones excesivas. Usá "modo": "reorganizar" y devolvé en "dias" únicamente las sesiones pendientes nuevas.`,
  revisar: p => `Revisá mi progresión de las últimas semanas (fuerza y running) y devolveme el plan de los próximos 7 días ajustado: ${load(p)}. ` +
    `Ajustá pesos, reps, series, volumen de running y, si corresponde, una semana de descarga. En "progresion" dejá un consejo concreto por ejercicio. Usá "modo": "nuevo".`,
};

const fmtSet = s => `${s.weight ?? 0}×${s.reps}${s.rir != null ? '@' + s.rir : ''}`;

export function fmtRun(r) {
  const parts = [r.distanceKm ? `${r.distanceKm} km` : null, r.durationSec ? `en ${fmtDuration(r.durationSec)}` : null];
  const pace = fmtPace(r.durationSec, r.distanceKm);
  return `${r.type}: ${parts.filter(Boolean).join(' ')}${pace ? ` (${pace})` : ''}${r.avgHr ? `, FC media ${r.avgHr}${r.maxHr ? `/máx ${r.maxHr}` : ''}` : ''}${r.rpe ? `, RPE ${r.rpe}` : ''}${r.notes ? `, ${r.notes}` : ''}`;
}

// Para Claude: ritmo (y FC si hay) de cada km, que muestra si el ritmo fue parejo, si hubo
// intervalos o si la FC se fue subiendo con el mismo ritmo (deriva cardíaca = fatiga).
function fmtSplits(splits) {
  if (!splits?.length) return '';
  return splits.map(s => fmtDuration(s.km ? s.sec / s.km : s.sec) + (s.hr ? `@${s.hr}` : '')).join(', ');
}

export function runTargetText(t) {
  const parts = [t.type, t.distanceKm ? `${t.distanceKm} km` : null, t.durationMin ? `${t.durationMin} min` : null, t.pace ? `ritmo ${t.pace}` : null];
  return parts.filter(Boolean).join(' · ') + (t.description ? ` — ${t.description}` : '');
}

// useProject: el pedido va a un Project de Claude que ya tiene las instrucciones de
// coaching (js/project.js), así que se omite ese preámbulo para no duplicarlo ni
// contradecirlo. Los datos y el formato JSON van siempre: dependen de la versión de la app.
export function buildPrompt(mode, note = '', useProject = false) {
  const p = state.profile;
  const gym = activeGym();
  const today = new Date();
  const out = [];

  if (useProject) out.push(`Pedido de la app (aplicá las instrucciones del Project).`);
  else out.push(`Sos mi entrenador personal de fuerza y running. Basá tus decisiones en la evidencia científica actual:
- Fuerza/hipertrofia: volumen semanal por grupo muscular de ~10-20 series efectivas según nivel (Schoenfeld et al., 2017), proximidad al fallo de 0-3 RIR (Refalo et al., 2023), frecuencia de al menos 2 veces por semana por grupo muscular, sobrecarga progresiva por doble progresión.
- Running: distribución de intensidad ~80/20 entre fácil y calidad (Seiler), aumentos graduales del volumen semanal (orientativo ~10%), especificidad hacia la distancia de la carrera objetivo, y puesta a punto (tapering) de 1-3 semanas según la distancia (Bosquet et al., 2007).
- Entrenamiento concurrente: separá lo más posible las sesiones pesadas de piernas de las de calidad o fondo, y priorizá según la carrera más cercana de prioridad A.
Cuando recomiendes subir peso, reps, series o kilómetros, explicá en una línea por qué y en qué principio o estudio te basás. Si algo que te pido contradice la evidencia, decímelo.`);

  out.push(`\n## Pedido\nHoy es ${WEEKDAYS[today.getDay()]} ${localDate(today)}. ${REQUESTS[mode](p)}`);
  if (note.trim()) out.push(`\nComentario mío: ${note.trim()}`);

  out.push(`\n## Mi perfil\n- Objetivo de fuerza: ${p.goal}\n- Experiencia: ${p.experience}\n- Días de gimnasio por semana: ${p.daysPerWeek}\n- Días de running por semana: ${p.runDaysPerWeek}\n- Tiempo por día: ~${p.sessionMinutes} min` +
    (p.notes ? `\n- Notas (lesiones, preferencias): ${p.notes}` : '') +
    (p.runNotes ? `\n- Running (volumen actual, marcas): ${p.runNotes}` : ''));

  const races = state.races.filter(r => daysUntil(r.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
  out.push(`\n## Carreras objetivo\n` + (races.length
    ? races.map(r => `- [${r.priority}] ${r.name}: ${r.date} (en ${daysUntil(r.date)} días), ${r.distanceKm} km` +
        (r.goalTime ? `, objetivo ${r.goalTime}` : '') + (r.notes ? ` — ${r.notes}` : '')).join('\n') +
      `\nPrioridad A = la importante, B = intermedia, C = de preparación o por diversión.`
    : 'Ninguna cargada por ahora.'));

  if (gym && gym.equipment.length) {
    out.push(`\n## Equipamiento de mi gimnasio actual ("${gym.name}")\nUsá SÓLO este equipamiento. El escalón es el salto mínimo de peso de cada máquina.\n` +
      gym.equipment.map(e => `- ${e.name} (${e.kind}${e.increment ? `, escalón ${e.increment} kg` : ''}${e.notes ? `, ${e.notes}` : ''})`).join('\n'));
  } else {
    out.push(`\n## Equipamiento\nTodavía no cargué el equipamiento: asumí un gimnasio comercial estándar.`);
  }

  if (state.plan) {
    const pl = state.plan;
    out.push(`\n## Plan actual (creado el ${pl.weekStart})\n` + pl.days.map(d => {
      const st = d.status === 'hecha' ? `HECHA el ${d.doneDate}` : d.status === 'salteada' ? 'SALTEADA' : 'PENDIENTE';
      const lines = [];
      if (d.exercises.length) lines.push('  ' + d.exercises.map(e => `${e.name} ${e.sets}×${e.repMin}-${e.repMax}`).join('; '));
      if (d.run) lines.push(`  Carrera: ${runTargetText(d.run)}`);
      return `- ${d.label} · ${d.name}: ${st}\n${lines.join('\n')}`;
    }).join('\n'));
  }

  // Últimas 4 semanas: suficiente para ver tendencia sin hacer el pedido enorme.
  const since = localDate(Date.now() - 28 * 864e5);
  const recent = state.sessions.filter(s => s.date >= since);
  const km = recent.reduce((t, s) => t + (s.run?.distanceKm || 0), 0);
  out.push(`\n## Historial de las últimas 4 semanas\nNotación de fuerza: peso×reps@RIR (RIR = reps en reserva). Total corrido: ${Math.round(km * 10) / 10} km.\n` +
    (recent.length
      ? recent.map(s => {
          const lines = s.exercises.map(e => `  ${e.name}: ${e.sets.map(fmtSet).join(', ')}`);
          if (s.run) {
            lines.push(`  Carrera ${fmtRun(s.run)}`);
            if (s.run.splits?.length) lines.push(`    parciales por km (ritmo@FC): ${fmtSplits(s.run.splits)}`);
          }
          return `${s.date} · ${s.name}\n${lines.join('\n')}`;
        }).join('\n')
      : 'Sin entrenamientos registrados todavía.'));

  out.push(`\n## Formato de respuesta\nPrimero explicame brevemente la lógica. Al final, incluí UN único bloque \`\`\`json con exactamente este formato (mismas claves):\n\`\`\`json\n${SCHEMA}\n\`\`\`\n` +
    `Reglas: un día puede tener sólo "ejercicios", sólo "carrera" o ambos (omití la clave que no corresponda). Usá exactamente los mismos nombres de ejercicio que aparecen en mi historial cuando sea el mismo ejercicio (así sigo la progresión). "equipo" debe ser uno de los nombres de mi equipamiento. "rir" es el RIR objetivo de las series de trabajo. "tipo" de carrera es uno de: rodaje, intervalos, tempo, fondo, recuperación, carrera. ` +
    `Cuando una carrera tenga cambios de ritmo (intervalos, correr/caminar, tempo con calentamiento), completá "pasos": lo cargo en el Apple Watch como entrenamiento personalizado, que vibra y avisa en cada cambio. Cada paso lleva "min" o "km" (uno solo), "accion" (correr, trotar o caminar) y opcionalmente "ritmo" (min/km, o un rango "5:30-5:45"). Para un rodaje continuo omití "pasos".`);

  return out.join('\n');
}

// Extrae el JSON de la respuesta: busca el último bloque ```json; si no hay, toma desde la
// primera "{" hasta la última "}". Tira errores con mensajes que dicen qué hacer.
export function parseResponse(text) {
  const blocks = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]);
  let raw = blocks.reverse().find(b => b.trim().startsWith('{'));
  if (!raw) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('No encontré un bloque JSON. Pedile a Claude: "repetí el plan en el bloque json del formato pedido".');
    raw = text.slice(a, b + 1);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`El JSON está mal formado (${e.message}). Copiá la respuesta completa, o pedile a Claude que lo corrija.`);
  }
  if (!Array.isArray(data.dias) || !data.dias.length) {
    throw new Error('El JSON no trae "dias". Pedile a Claude que use exactamente el formato del pedido.');
  }

  const int = v => (v == null || v === '' ? null : parseInt(v, 10));
  const numOrNull = v => (v == null || v === '' || isNaN(+v) ? null : +v);
  // Opcional: un plan puede traer también el gimnasio con su equipamiento, para cargar
  // todo de una vez (por ejemplo al cambiarte de gimnasio).
  const g = data.gimnasio;
  return {
    gym: g && g.nombre && Array.isArray(g.equipamiento) ? {
      name: g.nombre,
      equipment: g.equipamiento.filter(e => e.nombre).map(e => ({
        name: e.nombre, kind: e.tipo || 'máquina', increment: numOrNull(e.escalon) ?? 2.5, notes: e.notas || '',
      })),
    } : null,
    mode: data.modo === 'reorganizar' ? 'reorganizar' : 'nuevo',
    summary: data.resumen || '',
    notes: data.notas || '',
    progression: (data.progresion || []).map(p => ({ exercise: p.ejercicio || '', advice: p.consejo || '' })),
    days: data.dias.map((d, i) => ({
      label: d.dia || `Día ${i + 1}`,
      name: d.nombre || `Sesión ${i + 1}`,
      exercises: (d.ejercicios || []).map(e => {
        const repMin = int(e.repsMin) ?? int(e.reps) ?? 8;
        return {
          name: e.nombre || 'Ejercicio',
          equipment: e.equipo || '',
          sets: int(e.series) || 3,
          repMin,
          repMax: int(e.repsMax) ?? repMin,
          rir: numOrNull(e.rir),
          weight: numOrNull(e.pesoKg),
          restSec: int(e.descansoSeg),
          notes: e.notas || '',
        };
      }),
      run: d.carrera ? {
        type: d.carrera.tipo || 'rodaje',
        distanceKm: numOrNull(d.carrera.distanciaKm),
        durationMin: numOrNull(d.carrera.duracionMin),
        pace: d.carrera.ritmo || '',
        description: d.carrera.descripcion || '',
        steps: parseSteps(d.carrera.pasos),
      } : null,
    })),
  };
}

// Pasos de una carrera estructurada, con la misma forma que un entrenamiento personalizado
// del Apple Watch: calentamiento, bloques (trabajo + recuperación × repeticiones) y
// enfriamiento. Cada paso: { action, min, km, pace }.
function parseSteps(p) {
  if (!p) return null;
  const n = v => (v == null || v === '' || isNaN(+v) ? null : +v);
  const step = s => (s && (s.min != null || s.km != null || s.accion)
    ? { action: s.accion || 'correr', min: n(s.min), km: n(s.km), pace: s.ritmo || '' }
    : null);
  const blocks = (p.bloques || []).map(b => ({
    reps: parseInt(b.repeticiones, 10) || 1,
    work: step(b.trabajo),
    recovery: step(b.recuperacion),
  })).filter(b => b.work);
  if (!blocks.length && !p.calentamiento && !p.enfriamiento) return null;
  return { warmup: step(p.calentamiento), blocks, cooldown: step(p.enfriamiento) };
}

// "nuevo" reemplaza la semana entera; "reorganizar" conserva las sesiones ya hechas y
// reemplaza el resto por lo que propuso Claude.
export function applyPlan(parsed, alsoTemplates) {
  if (parsed.gym) {
    // Si ya existe un gimnasio con ese nombre, se le suman los equipos que falten (no se
    // pisa lo que hayas editado); si no, se crea. En ambos casos queda como activo.
    let gym = state.gyms.find(x => x.name.trim().toLowerCase() === parsed.gym.name.trim().toLowerCase());
    if (!gym) {
      gym = { id: uid(), name: parsed.gym.name, equipment: [] };
      state.gyms.push(gym);
    }
    const have = new Set(gym.equipment.map(e => e.name.trim().toLowerCase()));
    for (const e of parsed.gym.equipment) {
      if (!have.has(e.name.trim().toLowerCase())) gym.equipment.push({ id: uid(), ...e });
    }
    state.activeGymId = gym.id;
  }
  const newDays = parsed.days.map(d => ({ ...d, id: uid(), status: 'pendiente' }));
  const keep = parsed.mode === 'reorganizar' && state.plan ? state.plan.days.filter(d => d.status === 'hecha') : [];
  state.plan = {
    id: uid(),
    weekStart: parsed.mode === 'reorganizar' && state.plan ? state.plan.weekStart : localDate(),
    summary: parsed.summary,
    notes: parsed.notes,
    progression: parsed.progression,
    days: [...keep, ...newDays],
  };
  if (alsoTemplates) {
    // Las planillas son sólo de gimnasio: los días de puro running no generan planilla.
    for (const d of newDays.filter(d => d.exercises.length)) {
      state.templates.push({ id: uid(), name: `${d.name} (Claude)`, source: 'claude', exercises: d.exercises.map(e => ({ ...e })) });
    }
  }
}
