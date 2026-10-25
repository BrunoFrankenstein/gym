// Utilidades de running: tiempos, ritmos y cuenta regresiva a las carreras.

export const RUN_TYPES = ['rodaje', 'intervalos', 'tempo', 'fondo', 'recuperación', 'carrera'];

// Acepta lo que uno escribe rápido en el teléfono:
//   "45"      → 45 min
//   "45:30"   → 45 min 30 s
//   "1:05:20" → 1 h 5 min 20 s
// Devuelve segundos, o null si no se entiende.
export function parseDuration(txt) {
  const s = String(txt ?? '').trim().replace(/[.,]/g, ':');
  if (!s) return null;
  const parts = s.split(':').map(Number);
  if (parts.some(n => isNaN(n))) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function fmtDuration(sec) {
  if (sec == null) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

// Ritmo en min/km: tiempo total dividido la distancia.
export function fmtPace(sec, km) {
  if (!sec || !km) return '';
  return `${fmtDuration(sec / km)} /km`;
}

export function daysUntil(isoDate) {
  const a = new Date(isoDate + 'T00:00');
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 864e5);
}
