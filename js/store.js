// Estado de la app: todo vive en un único objeto JSON guardado en localStorage.
// Es chico (unos cientos de KB aun con años de entrenamientos), y así el respaldo
// es simplemente exportar/importar ese mismo JSON.
// Nota iOS: Safari puede borrar datos de sitios que no usás en 7 días, PERO no lo hace
// con las apps agregadas a la pantalla de inicio. Por eso hay que instalarla así.

const KEY = 'gym.v1';

export const DEFAULT = () => ({
  version: 1,
  profile: {
    goal: 'hipertrofia',
    experience: 'intermedio',
    daysPerWeek: 4,      // días de gimnasio
    runDaysPerWeek: 3,   // días de running (pueden coincidir con días de gimnasio)
    sessionMinutes: 60,
    notes: '',
    runNotes: '',        // km semanales actuales, marcas, experiencia corriendo
  },
  races: [],         // carreras objetivo: [{ id, name, date, distanceKm, goalTime, priority: 'A'|'B'|'C', notes }]
  gyms: [],          // [{ id, name, equipment: [{ id, name, kind, increment, notes }] }]
  activeGymId: null,
  templates: [],     // planillas: [{ id, name, source: 'manual'|'claude', exercises: [target] }]
  plan: null,        // plan semanal de Claude (ver claude.js → applyPlan)
  sessions: [],      // entrenamientos terminados, en orden cronológico
  active: null,      // entrenamiento en curso (se guarda a cada cambio para no perder nada)
  lastExport: null,
  stravaImported: [], // IDs de actividades de Strava ya traídas (aunque después las borres)
  stravaLastSync: null,
});

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return withDefaults(JSON.parse(raw));
  } catch (e) {
    console.error('No se pudo leer el estado guardado', e);
  }
  return DEFAULT();
}

// Completa con valores por defecto los campos que no existían cuando se guardó el dato
// (respaldos viejos, versiones anteriores de la app).
function withDefaults(saved) {
  const d = DEFAULT();
  return { ...d, ...saved, profile: { ...d.profile, ...(saved.profile || {}) } };
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function replaceState(next) {
  state = withDefaults(next);
  save();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Fecha local en formato AAAA-MM-DD (toISOString daría la fecha UTC, que de noche en
// Uruguay ya es "mañana").
export function localDate(d = new Date()) {
  const x = new Date(d);
  const p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function activeGym() {
  return state.gyms.find(g => g.id === state.activeGymId) || null;
}

// Los ejercicios se identifican por nombre (sin distinguir mayúsculas ni espacios de más).
// Así Claude y vos hablan del mismo ejercicio sin necesidad de IDs.
export const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
