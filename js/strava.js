// Integración con Strava: traer tus carreras (que el Apple Watch ya sube a Strava vía Salud).
//
// Flujo OAuth de Strava, sin servidor propio: su API acepta llamadas directas desde el
// navegador (CORS abierto), así que el teléfono canjea el código por tokens él mismo.
//   1. Creás una "app" tuya en strava.com/settings/api (gratis) → Client ID y Secret.
//   2. "Conectar" te manda a Strava; al autorizar, vuelve a strava.html con un código.
//   3. Ese código se canjea por un token de acceso (dura 6 h) y uno de refresco (no vence),
//      con el que se piden tokens nuevos cuando hace falta.
//
// Las credenciales se guardan aparte del estado (clave gym.strava) para que NO viajen en
// los respaldos exportados.

const KEY = 'gym.strava';
const CODE_KEY = 'gym.stravaCode';
const API = 'https://www.strava.com/api/v3';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
function setAuth(a) {
  if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY);
}

export const isConnected = () => !!getAuth()?.refreshToken;

// strava.html vive al lado de index.html; Strava sólo acepta volver a un dominio que vos
// registraste como "Authorization Callback Domain" (localhost siempre está permitido).
export const redirectUri = () => new URL('strava.html', location.href.replace(/[?#].*$/, '')).href;

export function saveClient(clientId, clientSecret) {
  setAuth({ ...(getAuth() || {}), clientId: clientId.trim(), clientSecret: clientSecret.trim() });
}

export function authorizeUrl() {
  const a = getAuth();
  const p = new URLSearchParams({
    client_id: a.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all', // activity:read_all incluye actividades privadas
  });
  return `https://www.strava.com/oauth/authorize?${p}`;
}

async function tokenRequest(params) {
  const a = getAuth();
  const body = new URLSearchParams({ client_id: a.clientId, client_secret: a.clientSecret, ...params });
  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const why = data.message || `error ${r.status}`;
    throw new Error(`Strava rechazó el pedido (${why}). Revisá el Client ID y el Secret, o volvé a conectar.`);
  }
  setAuth({
    ...a,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at, // segundos epoch
    athlete: data.athlete ? `${data.athlete.firstname || ''} ${data.athlete.lastname || ''}`.trim() : a.athlete,
  });
}

// El código puede llegar solo (strava.html lo deja en localStorage si comparte almacenamiento
// con la app) o pegado a mano (en iPhone, Safari y la app instalada no comparten datos).
export function takePendingCode() {
  const c = localStorage.getItem(CODE_KEY);
  if (c) localStorage.removeItem(CODE_KEY);
  return c;
}

export async function exchangeCode(code) {
  // Si pegaron la URL entera de retorno en lugar del código, se extrae el parámetro.
  const m = String(code).match(/[?&]code=([^&#\s]+)/);
  await tokenRequest({ code: (m ? m[1] : code).trim(), grant_type: 'authorization_code' });
}

async function accessToken() {
  const a = getAuth();
  if (!a?.refreshToken) throw new Error('Strava no está conectado. Conectalo en Gimnasio y perfil → Strava.');
  // Margen de 2 minutos para no usar un token que vence en medio del pedido.
  if (!a.accessToken || a.expiresAt * 1000 < Date.now() + 120e3) {
    await tokenRequest({ grant_type: 'refresh_token', refresh_token: a.refreshToken });
  }
  return getAuth().accessToken;
}

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (r.status === 429) throw new Error('Strava limita a 100 pedidos cada 15 min. Probá de nuevo en un rato.');
  if (!r.ok) throw new Error(`Strava respondió ${r.status}. Si persiste, desconectá y volvé a conectar.`);
  return r.json();
}

export function disconnect() {
  const a = getAuth();
  // Se conserva la app (Client ID/Secret) para reconectar sin volver a tipearla.
  setAuth(a ? { clientId: a.clientId, clientSecret: a.clientSecret } : null);
}

const RUN_SPORTS = ['Run', 'TrailRun', 'VirtualRun'];

// workout_type de Strava para carreras: 1 = competencia, 2 = fondo, 3 = entrenamiento
// (series/intervalos), 0 o vacío = rodaje común.
const TYPE_BY_WORKOUT = { 1: 'carrera', 2: 'fondo', 3: 'intervalos' };

// Trae las carreras posteriores a `afterSec` (epoch) que no estén en `skipIds`, con el
// detalle de cada una (parciales por km). Devuelve objetos listos para el historial.
export async function fetchRuns(afterSec, skipIds) {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const list = await api(`/athlete/activities?after=${afterSec}&per_page=50&page=${page}`);
    for (const a of list) {
      if (!RUN_SPORTS.includes(a.sport_type || a.type) || skipIds.has(String(a.id))) continue;
      const d = await api(`/activities/${a.id}`);
      out.push(toRun(d));
    }
    if (list.length < 50) break;
  }
  return out;
}

// Si Strava no trae workout_type (Runna y el Watch no lo completan), se deduce del nombre:
// Runna titula sus sesiones "Easy Run", "Tempo", "Intervals", "Long Run"... (+ "with Runna").
// Se prueba en orden: lo más específico primero.
const TYPE_BY_NAME = [
  [/race|carrera|10k|21k|42k|marat|half/i, 'carrera'],
  [/interval|series|repeats|fartlek|hill|cuesta|track|pista/i, 'intervalos'],
  [/tempo|threshold|umbral|progress/i, 'tempo'],
  [/long|fondo|largo/i, 'fondo'],
  [/recover|recup|shake/i, 'recuperación'],
];

function guessType(d) {
  if (TYPE_BY_WORKOUT[d.workout_type]) return TYPE_BY_WORKOUT[d.workout_type];
  const hit = TYPE_BY_NAME.find(([re]) => re.test(d.name || ''));
  return hit ? hit[1] : 'rodaje';
}

function toRun(d) {
  const km = Math.round(d.distance / 10) / 100; // metros → km con 2 decimales
  return {
    stravaId: String(d.id),
    name: d.name,
    startedAt: d.start_date,
    date: d.start_date_local.slice(0, 10), // fecha local del lugar donde corriste
    run: {
      type: guessType(d),
      distanceKm: km,
      durationSec: d.moving_time,   // tiempo en movimiento (sin paradas), el que usa Strava para el ritmo
      elapsedSec: d.elapsed_time,
      rpe: d.perceived_exertion ?? null,
      notes: d.description || '',
      avgHr: d.average_heartrate ? Math.round(d.average_heartrate) : null,
      maxHr: d.max_heartrate ? Math.round(d.max_heartrate) : null,
      elevGain: d.total_elevation_gain != null ? Math.round(d.total_elevation_gain) : null,
      // Parciales por km: segundos y FC media de cada uno.
      splits: (d.splits_metric || []).map(s => ({
        km: Math.round(s.distance / 10) / 100,
        sec: s.moving_time,
        hr: s.average_heartrate ? Math.round(s.average_heartrate) : null,
      })),
    },
  };
}
