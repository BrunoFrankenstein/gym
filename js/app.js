// Interfaz de la app. Patrón simple, sin frameworks:
//   - cada pestaña es una función que devuelve HTML a partir de `state`;
//   - los botones llevan data-action="..." y un único listener despacha a ACTIONS;
//   - los campos llevan data-field="..." y se guardan en `state` a medida que escribís,
//     sin redibujar (para no perder el foco del teclado).

import { state, save, replaceState, uid, localDate, activeGym, norm } from './store.js';
import { suggest } from './progression.js';
import { buildPrompt, parseResponse, applyPlan, fmtRun, runTargetText } from './claude.js';
import { RUN_TYPES, parseDuration, fmtDuration, fmtPace, daysUntil } from './running.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? null : n; };

// Estado sólo de la interfaz (no se guarda en el respaldo).
const ui = {
  tab: safeGet('gym.tab') || 'entrenar',
  claudeMode: 'nuevo',
  note: '',
  resp: '',
  parsed: null, // respuesta de Claude ya interpretada, esperando confirmación
  draft: null,  // planilla en edición
};

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }

const TITLES = { entrenar: 'Entrenar', historial: 'Historial', rutinas: 'Planillas', gym: 'Gimnasio y perfil', claude: 'Claude' };

// Escalón de peso por defecto según el tipo de equipo; se puede cambiar en cada máquina.
// Valores típicos de gimnasio comercial: placas de 5 kg en máquinas de placas, poleas con
// pasos de 2,5 kg y mancuernas de a 2 kg.
const KINDS = { 'máquina': 5, 'polea': 2.5, 'peso libre': 2, 'peso corporal': 0, 'cardio': 0, 'otro': 2.5 };

// ---------- utilidades de fechas e historial ----------

function fmtDate(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('es-UY', { weekday: 'short', day: 'numeric', month: 'numeric' });
}
const fmtTime = iso => new Date(iso).toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
const fmtSets = sets => sets.map(s => `${s.weight ?? 0}×${s.reps}${s.rir != null ? ` @${s.rir}` : ''}`).join(', ');

// Última vez que se hizo un ejercicio (las sesiones están en orden cronológico).
function lastPerformance(name) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    const ex = s.exercises.find(e => norm(e.name) === norm(name));
    if (ex && ex.sets.length) return { date: s.date, sets: ex.sets };
  }
  return null;
}

function incrementFor(ex) {
  const eq = activeGym()?.equipment.find(e => norm(e.name) === norm(ex.target?.equipment) || norm(e.name) === norm(ex.name));
  return eq ? eq.increment : 2.5;
}

function suggestionFor(ex) {
  return suggest({ target: ex.target, last: lastPerformance(ex.name), increment: incrementFor(ex) });
}

const claudeAdvice = name => state.plan?.progression?.find(p => norm(p.exercise) === norm(name))?.advice;

function knownExerciseNames() {
  const names = new Map();
  const add = n => { if (n && !names.has(norm(n))) names.set(norm(n), n); };
  activeGym()?.equipment.forEach(e => add(e.name));
  state.templates.forEach(t => t.exercises.forEach(e => add(e.name)));
  state.plan?.days.forEach(d => d.exercises.forEach(e => add(e.name)));
  state.sessions.forEach(s => s.exercises.forEach(e => add(e.name)));
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'es'));
}
const datalist = () => `<datalist id="exnames">${knownExerciseNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;

// ---------- render ----------

function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('#title').textContent = ui.tab === 'entrenar' && state.active ? state.active.name : TITLES[ui.tab];
  $('#view').innerHTML = VIEWS[ui.tab]();
}

const VIEWS = {
  entrenar: () => (state.active ? viewActive() : viewHome()),
  historial: viewHistory,
  rutinas: viewTemplates,
  gym: viewGym,
  claude: viewClaude,
};

function nextRaceCard() {
  const r = state.races.filter(r => daysUntil(r.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!r) return '';
  const d = daysUntil(r.date);
  return `<section class="card race-next"><div class="row between"><div><small class="muted">Próxima carrera</small><h2>${esc(r.name)}</h2>
    <small class="muted">${r.distanceKm} km · ${fmtDate(r.date)}${r.goalTime ? ` · objetivo ${esc(r.goalTime)}` : ''}</small></div>
    <div class="countdown"><b>${d}</b><small>${d === 1 ? 'día' : 'días'}</small></div></div></section>`;
}

function dayIcons(d) {
  return `${d.exercises.length ? '🏋️' : ''}${d.run ? '🏃' : ''}`;
}

function viewHome() {
  const p = state.plan;
  let html = nextRaceCard();
  if (p) {
    html += `<section class="card"><div class="row between"><h2>Plan de la semana</h2><small class="muted">desde ${fmtDate(p.weekStart)}</small></div>
      ${p.summary ? `<p class="muted small">${esc(p.summary)}</p>` : ''}
      <ul class="list">${p.days.map(d => `<li class="day ${d.status}">
        <div><b>${esc(d.label)}</b> · ${esc(d.name)} ${dayIcons(d)}<br>
          <small class="muted">${[d.exercises.length ? `${d.exercises.length} ejercicios` : '', d.run ? runTargetText(d.run) : ''].filter(Boolean).map(esc).join(' · ')}
          ${d.status === 'hecha' ? ` · ✓ ${fmtDate(d.doneDate)}` : d.status === 'salteada' ? ' · salteada' : ''}</small></div>
        <div class="btns">${d.status === 'pendiente'
          ? `<button class="sm primary" data-action="start-plan" data-id="${d.id}">Empezar</button><button class="sm" data-action="skip-day" data-id="${d.id}">Saltear</button>`
          : d.status === 'salteada' ? `<button class="sm" data-action="unskip-day" data-id="${d.id}">Deshacer</button>` : ''}</div></li>`).join('')}</ul>
      ${p.days.some(d => d.status === 'salteada') ? `<button class="block ghost" data-action="goto-reorg">Pedirle a Claude que reorganice</button>` : ''}
    </section>`;
  } else {
    html += `<section class="card"><h2>Sin plan semanal</h2><p class="muted small">Cargá las máquinas de tu gimnasio y tus carreras, y pedile a Claude un plan.</p>
      <button class="primary block" data-action="goto" data-tab="claude">Ir a Claude</button></section>`;
  }
  html += `<section class="card"><h2>Desde una planilla</h2>${state.templates.length
    ? `<ul class="list">${state.templates.map(t => `<li><div><b>${esc(t.name)}</b><br><small class="muted">${t.exercises.length} ejercicios</small></div>
        <button class="sm" data-action="start-template" data-id="${t.id}">Empezar</button></li>`).join('')}</ul>`
    : `<p class="muted small">Todavía no hay planillas. Creá una en la pestaña Planillas o guardá un entrenamiento libre como planilla.</p>`}</section>
    <div class="row two"><button class="primary big" data-action="start-free">🏋️ Gimnasio libre</button><button class="primary big" data-action="start-run">🏃 Carrera libre</button></div>`;
  return html;
}

function viewActive() {
  const a = state.active;
  return `<div class="row between session-head"><small class="muted">Empezó ${fmtTime(a.startedAt)}</small>
      <div class="btns"><button class="sm danger" data-action="discard">Descartar</button><button class="sm primary" data-action="finish">Terminar</button></div></div>
    ${a.run ? runCard(a.run) : ''}
    ${a.exercises.map(exerciseCard).join('')}
    <div class="row two"><button data-action="add-exercise">+ Ejercicio</button>${a.run ? '' : '<button data-action="add-run">+ Carrera</button>'}</div>`;
}

function exerciseCard(ex, i) {
  const last = lastPerformance(ex.name);
  const sug = suggestionFor(ex);
  const t = ex.target;
  const advice = claudeAdvice(ex.name);
  const rirOpts = s => ['', '0', '1', '2', '3', '4'].map(v => `<option value="${v}" ${String(s.rir) === v ? 'selected' : ''}>${v === '' ? '–' : v === '4' ? '4+' : v}</option>`).join('');
  return `<section class="card ex">
    <div class="row between"><h3>${esc(ex.name)}</h3><button class="icon" data-action="remove-exercise" data-i="${i}" aria-label="Quitar ejercicio">✕</button></div>
    ${t ? `<div class="target">${t.sets}×${t.repMin}${t.repMax !== t.repMin ? '–' + t.repMax : ''}${t.rir != null ? ` · RIR ${t.rir}` : ''}${t.restSec ? ` · ${t.restSec}s` : ''}${t.notes ? ` · ${esc(t.notes)}` : ''}</div>` : ''}
    ${last ? `<div class="muted small">Última (${fmtDate(last.date)}): ${fmtSets(last.sets)}</div>` : ''}
    ${advice ? `<div class="hint claude">✨ ${esc(advice)}</div>` : ''}
    <div class="hint">💡 ${esc(sug.text)}</div>
    <div class="sethead"><span>#</span><span>kg</span><span>reps</span><span>RIR</span><span></span></div>
    ${ex.sets.map((s, j) => `<div class="set ${s.done ? 'done' : ''}"><span>${j + 1}</span>
      <input inputmode="decimal" data-field="set.weight" data-i="${i}" data-j="${j}" value="${esc(s.weight)}" placeholder="${sug.weight ?? 'kg'}">
      <input inputmode="numeric" data-field="set.reps" data-i="${i}" data-j="${j}" value="${esc(s.reps)}" placeholder="${sug.reps ?? 'reps'}">
      <select data-field="set.rir" data-i="${i}" data-j="${j}">${rirOpts(s)}</select>
      <button class="check" data-action="toggle-set" data-i="${i}" data-j="${j}" aria-label="Serie hecha">✓</button></div>`).join('')}
    <div class="row"><button class="sm" data-action="add-set" data-i="${i}">+ Serie</button>${ex.sets.length > 1 ? `<button class="sm ghost" data-action="remove-set" data-i="${i}">− Serie</button>` : ''}</div>
  </section>`;
}

function runCard(r) {
  return `<section class="card ex run">
    <div class="row between"><h3>🏃 Carrera</h3><button class="icon" data-action="remove-run" aria-label="Quitar carrera">✕</button></div>
    ${r.target ? `<div class="target">${esc(runTargetText(r.target))}</div>` : ''}
    <label>Tipo</label><select data-field="run.type">${RUN_TYPES.map(t => `<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <div class="grid2">
      <div><label>Distancia (km)</label><input inputmode="decimal" data-field="run.distance" value="${esc(r.distance)}" placeholder="${r.target?.distanceKm ?? '8'}"></div>
      <div><label>Tiempo</label><input data-field="run.time" value="${esc(r.time)}" placeholder="45:30"></div>
    </div>
    <div class="pace" id="pace">${paceText(r)}</div>
    <label>Esfuerzo percibido (RPE 1 = muy fácil, 10 = máximo)</label>
    <select data-field="run.rpe"><option value="">–</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option ${String(r.rpe) === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label>Notas</label><input data-field="run.notes" value="${esc(r.notes)}" placeholder="Ej: viento, piernas cargadas">
  </section>`;
}

function paceText(r) {
  const p = fmtPace(parseDuration(r.time), num(r.distance));
  return p ? `Ritmo: <b>${p}</b>` : '<span class="muted small">El ritmo se calcula con distancia y tiempo.</span>';
}

function viewHistory() {
  if (!state.sessions.length) return `<section class="card"><p class="muted">Todavía no hay entrenamientos guardados.</p></section>`;
  return [...state.sessions].reverse().map(s => {
    const nSets = s.exercises.reduce((t, e) => t + e.sets.length, 0);
    const bits = [s.exercises.length ? `${s.exercises.length} ejercicios · ${nSets} series` : '', s.run ? fmtRun(s.run) : ''].filter(Boolean);
    return `<section class="card tap" data-action="open-session" data-id="${s.id}">
      <div class="row between"><b>${esc(s.name)}</b><small class="muted">${fmtDate(s.date)}</small></div>
      <small class="muted">${bits.map(esc).join(' · ')}</small></section>`;
  }).join('');
}

function viewTemplates() {
  return `<button class="primary block" data-action="new-template">+ Nueva planilla</button>
    ${state.templates.length ? state.templates.map(t => `<section class="card">
      <div class="row between"><b>${esc(t.name)}${t.source === 'claude' ? '<span class="badge">Claude</span>' : ''}</b>
        <div class="btns"><button class="sm" data-action="edit-template" data-id="${t.id}">Editar</button><button class="sm primary" data-action="start-template" data-id="${t.id}">Empezar</button></div></div>
      <small class="muted">${t.exercises.map(e => `${esc(e.name)} ${e.sets}×${e.repMin}${e.repMax !== e.repMin ? '–' + e.repMax : ''}`).join(' · ')}</small>
    </section>`).join('') : `<section class="card"><p class="muted small">Las planillas son rutinas de gimnasio que armás vos (o que guardás de un plan de Claude) para repetirlas cuando quieras.</p></section>`}`;
}

function viewGym() {
  const g = activeGym();
  const p = state.profile;
  let html = '';
  if (!state.gyms.length) {
    html += `<section class="card"><h2>Tu gimnasio</h2><p class="muted small">Creá tu gimnasio y cargá las máquinas que tiene. Claude arma las rutinas sólo con eso. Si te cambiás de gimnasio, creás otro y lo elegís como activo.</p>
      <label>Nombre</label><input id="gymName" placeholder="Ej: Gym del barrio"><button class="primary block mt" data-action="create-gym">Crear</button></section>`;
  } else {
    const byKind = {};
    g?.equipment.forEach(e => (byKind[e.kind] ||= []).push(e));
    html += `<section class="card"><h2>Gimnasio activo</h2>
      <select data-field="gym.active">${state.gyms.map(x => `<option value="${x.id}" ${x.id === state.activeGymId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <div class="row mt"><button class="sm" data-action="new-gym">+ Otro gimnasio</button><button class="sm" data-action="rename-gym">Renombrar</button><button class="sm danger" data-action="delete-gym">Borrar</button></div></section>
      <section class="card"><div class="row between"><h2>Equipamiento (${g?.equipment.length || 0})</h2></div>
      ${Object.keys(byKind).length ? Object.entries(byKind).map(([k, items]) => `<h4>${esc(k)}</h4><ul class="list">${items.map(e => `<li>
          <div>${esc(e.name)}<br><small class="muted">${e.increment ? `escalón ${e.increment} kg` : 'sin escalón'}${e.notes ? ` · ${esc(e.notes)}` : ''}</small></div>
          <button class="sm ghost" data-action="edit-equip" data-id="${e.id}">Editar</button></li>`).join('')}</ul>`).join('')
        : '<p class="muted small">Sin equipamiento cargado.</p>'}
      <div class="row mt"><button class="primary" data-action="add-equip">+ Agregar</button><button data-action="bulk-equip">Carga rápida</button></div></section>`;
  }

  const races = [...state.races].sort((a, b) => a.date.localeCompare(b.date));
  html += `<section class="card"><h2>Carreras objetivo</h2>
    ${races.length ? `<ul class="list">${races.map(r => {
      const d = daysUntil(r.date);
      return `<li class="${d < 0 ? 'past' : ''}"><div><b>[${r.priority}] ${esc(r.name)}</b><br>
        <small class="muted">${r.distanceKm} km · ${fmtDate(r.date)} · ${d < 0 ? 'ya pasó' : `faltan ${d} días`}${r.goalTime ? ` · objetivo ${esc(r.goalTime)}` : ''}</small></div>
        <button class="sm ghost" data-action="edit-race" data-id="${r.id}">Editar</button></li>`;
    }).join('')}</ul>` : '<p class="muted small">Cargá las carreras que querés correr; Claude organiza el running hacia ellas.</p>'}
    <button class="block mt" data-action="add-race">+ Carrera</button></section>`;

  const sel = (field, opts) => `<select data-field="profile.${field}">${opts.map(o => `<option ${p[field] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  html += `<section class="card"><h2>Perfil</h2>
    <label>Objetivo de fuerza</label>${sel('goal', ['hipertrofia', 'fuerza', 'salud general', 'complemento del running'])}
    <label>Experiencia en gimnasio</label>${sel('experience', ['principiante', 'intermedio', 'avanzado'])}
    <div class="grid2">
      <div><label>Días de gimnasio / semana</label><input inputmode="numeric" data-field="profile.daysPerWeek" value="${p.daysPerWeek}"></div>
      <div><label>Días de running / semana</label><input inputmode="numeric" data-field="profile.runDaysPerWeek" value="${p.runDaysPerWeek}"></div>
    </div>
    <label>Minutos disponibles por día</label><input inputmode="numeric" data-field="profile.sessionMinutes" value="${p.sessionMinutes}">
    <label>Running: volumen actual y marcas</label><textarea data-field="profile.runNotes" placeholder="Ej: corro ~20 km/semana; 10K en 52 min (marzo 2026)">${esc(p.runNotes)}</textarea>
    <label>Lesiones, preferencias, horarios</label><textarea data-field="profile.notes" placeholder="Ej: molestia en hombro izquierdo; prefiero no hacer sentadilla libre">${esc(p.notes)}</textarea>
  </section>
  <section class="card"><h2>Respaldo</h2><p class="muted small">Los datos viven sólo en este teléfono. Exportá un respaldo cada tanto (a Archivos o iCloud Drive).
    ${state.lastExport ? `Último: ${fmtDate(localDate(state.lastExport))}.` : 'Todavía no exportaste ninguno.'}</p>
    <div class="row"><button data-action="export">Exportar</button><button data-action="import">Importar</button></div>
    <input type="file" id="importFile" accept="application/json,.json" hidden></section>`;
  return html;
}

const MODE_HELP = {
  nuevo: 'Plan de los próximos 7 días con tus máquinas, tus carreras y tu historial.',
  reorganizar: 'Para cuando salteaste sesiones: conserva lo hecho y redistribuye lo que queda.',
  revisar: 'Claude analiza tu progresión y ajusta pesos, reps y kilómetros del próximo plan.',
};

function viewClaude() {
  const modes = [['nuevo', 'Plan nuevo'], ['reorganizar', 'Reorganizar'], ['revisar', 'Revisar']];
  const p = state.plan;
  return `<section class="card"><h2>1 · Armá el pedido</h2>
      <div class="seg">${modes.map(([k, l]) => `<button data-action="claude-mode" data-mode="${k}" class="${ui.claudeMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="muted small">${MODE_HELP[ui.claudeMode]}</p>
      <label>Algo que Claude deba saber (opcional)</label>
      <textarea data-field="ui.note" placeholder="Ej: esta semana sólo puedo martes, jueves y sábado">${esc(ui.note)}</textarea>
      <button class="primary block mt" data-action="copy-prompt">Copiar pedido</button>
      <button class="sm ghost" data-action="show-prompt">Ver el pedido</button>
      <p class="muted small">Pegalo en una conversación nueva de Claude (app o claude.ai).</p></section>
    <section class="card"><h2>2 · Pegá la respuesta</h2>
      <textarea data-field="ui.resp" id="claudeResp" placeholder="Pegá acá la respuesta completa de Claude">${esc(ui.resp)}</textarea>
      <div class="row mt"><button data-action="paste-clip">Pegar del portapapeles</button><button class="primary" data-action="parse-resp">Revisar y aplicar</button></div></section>
    ${p ? `<section class="card"><h2>Plan actual</h2>
      ${p.summary ? `<p class="small">${esc(p.summary)}</p>` : ''}${p.notes ? `<p class="muted small">${esc(p.notes)}</p>` : ''}
      ${p.progression.length ? `<h4>Progresión sugerida</h4><ul class="plain">${p.progression.map(x => `<li><b>${esc(x.exercise)}:</b> ${esc(x.advice)}</li>`).join('')}</ul>` : ''}
    </section>` : ''}`;
}

// ---------- hoja inferior (modal) y avisos ----------

function openSheet(html) {
  $('#sheet .panel').innerHTML = html;
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; }

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2500);
}

// ---------- entrenamiento en curso ----------

function newExercise(name, target = null) {
  const ex = { name, target: target && target.sets ? { ...target } : null, sets: [] };
  const sug = suggestionFor(ex);
  const n = ex.target?.sets || 1;
  for (let i = 0; i < n; i++) ex.sets.push({ weight: sug.weight ?? '', reps: '', rir: '', done: false });
  return ex;
}
const newRun = (target = null) => ({ type: target?.type || 'rodaje', distance: '', time: '', rpe: '', notes: '', target });

function startSession(name, source, exercises = [], runTarget = null, withRun = false) {
  if (state.active && !confirm('Ya hay un entrenamiento en curso. ¿Descartarlo y empezar otro?')) return;
  state.active = {
    id: uid(), name, source, startedAt: new Date().toISOString(),
    exercises: exercises.map(t => newExercise(t.name, t)),
    run: runTarget || withRun ? newRun(runTarget) : null,
  };
  save();
  ui.tab = 'entrenar';
  render();
  scrollTo(0, 0);
}

function finishSession() {
  const a = state.active;
  // Una serie cuenta si la marcaste como hecha o si le cargaste reps.
  const exercises = a.exercises.map(ex => ({
    name: ex.name,
    sets: ex.sets
      .filter(s => s.done || s.reps !== '')
      .map(s => ({ weight: num(s.weight), reps: parseInt(s.reps, 10) || 0, rir: s.rir === '' ? null : +s.rir }))
      .filter(s => s.reps > 0),
  })).filter(ex => ex.sets.length);

  let run = null;
  if (a.run && (a.run.distance !== '' || a.run.time !== '')) {
    run = { type: a.run.type, distanceKm: num(a.run.distance), durationSec: parseDuration(a.run.time), rpe: a.run.rpe === '' ? null : +a.run.rpe, notes: a.run.notes };
  }

  if (!exercises.length && !run) {
    if (!confirm('No hay nada cargado. ¿Cerrar sin guardar?')) return;
    state.active = null;
    save(); render();
    return;
  }

  const session = { id: a.id, date: localDate(a.startedAt), startedAt: a.startedAt, endedAt: new Date().toISOString(), name: a.name, source: a.source, exercises, run };
  state.sessions.push(session);
  if (a.source.kind === 'plan' && state.plan) {
    const d = state.plan.days.find(d => d.id === a.source.id);
    if (d) Object.assign(d, { status: 'hecha', sessionId: session.id, doneDate: session.date });
  }
  state.active = null;
  save();
  render();
  scrollTo(0, 0);
  toast('Entrenamiento guardado 💪');
}

// ---------- planillas ----------

const blankTarget = () => ({ name: '', equipment: '', sets: 3, repMin: 8, repMax: 12, rir: 2, weight: null, notes: '' });

function openTemplateEditor(tpl) {
  ui.draft = tpl ? structuredClone(tpl) : { id: null, name: '', source: 'manual', exercises: [blankTarget()] };
  renderTemplateEditor();
}

function renderTemplateEditor() {
  const d = ui.draft;
  const mini = (i, k, label, v) => `<label class="mini">${label}<input data-k="${k}" inputmode="numeric" value="${v ?? ''}"></label>`;
  openSheet(`<h2>${d.id ? 'Editar' : 'Nueva'} planilla</h2>
    <label>Nombre</label><input id="tplName" value="${esc(d.name)}" placeholder="Ej: Piernas">
    <div class="mt">${d.exercises.map((e, i) => `<div class="edrow" data-row="${i}">
      <input class="name" data-k="name" list="exnames" value="${esc(e.name)}" placeholder="Ejercicio">
      ${mini(i, 'sets', 'Series', e.sets)}${mini(i, 'repMin', 'Reps mín', e.repMin)}${mini(i, 'repMax', 'Reps máx', e.repMax)}${mini(i, 'rir', 'RIR', e.rir)}
      <button class="icon" data-action="tpl-remove-row" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}</div>
    <button class="block ghost" data-action="tpl-add-row">+ Ejercicio</button>
    ${datalist()}
    <div class="row between">${d.id ? '<button class="danger" data-action="delete-template">Borrar</button>' : '<span></span>'}
      <div class="btns"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="tpl-save">Guardar</button></div></div>`);
}

// Pasa lo escrito en el editor al borrador antes de redibujarlo o guardarlo.
function readDraft() {
  ui.draft.name = $('#tplName').value.trim();
  document.querySelectorAll('.edrow').forEach(row => {
    const e = ui.draft.exercises[+row.dataset.row];
    row.querySelectorAll('[data-k]').forEach(inp => {
      e[inp.dataset.k] = inp.dataset.k === 'name' ? inp.value.trim() : num(inp.value);
    });
  });
}

// ---------- formularios en la hoja ----------

function equipForm(e = null) {
  const kind = e?.kind || 'máquina';
  openSheet(`<h2>${e ? 'Editar' : 'Agregar'} equipo</h2>
    <label>Nombre</label><input id="eqName" value="${esc(e?.name)}" placeholder="Ej: Prensa 45°">
    <label>Tipo</label><select id="eqKind">${Object.keys(KINDS).map(k => `<option ${k === kind ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <label>Escalón mínimo de peso (kg)</label><input id="eqInc" inputmode="decimal" value="${e?.increment ?? KINDS[kind]}">
    <label>Notas</label><input id="eqNotes" value="${esc(e?.notes)}" placeholder="Ej: máx 100 kg, polea doble">
    <div class="row between mt">${e ? `<button class="danger" data-action="delete-equip" data-id="${e.id}">Borrar</button>` : '<span></span>'}
      <div class="btns"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="save-equip" data-id="${e?.id || ''}">Guardar</button></div></div>`);
}

function raceForm(r = null) {
  openSheet(`<h2>${r ? 'Editar' : 'Nueva'} carrera</h2>
    <label>Nombre</label><input id="rcName" value="${esc(r?.name)}" placeholder="Ej: 10K de San Felipe y Santiago">
    <div class="grid2"><div><label>Fecha</label><input id="rcDate" type="date" value="${r?.date || ''}"></div>
      <div><label>Distancia (km)</label><input id="rcDist" inputmode="decimal" value="${r?.distanceKm ?? ''}" placeholder="10"></div></div>
    <div class="grid2"><div><label>Tiempo objetivo</label><input id="rcGoal" value="${esc(r?.goalTime)}" placeholder="50:00"></div>
      <div><label>Prioridad</label><select id="rcPrio">${['A', 'B', 'C'].map(x => `<option ${(r?.priority || 'B') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
    <p class="muted small">A = la importante · B = intermedia · C = preparación o diversión.</p>
    <label>Notas</label><input id="rcNotes" value="${esc(r?.notes)}" placeholder="Ej: circuito con subidas">
    <div class="row between mt">${r ? `<button class="danger" data-action="delete-race" data-id="${r.id}">Borrar</button>` : '<span></span>'}
      <div class="btns"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="save-race" data-id="${r?.id || ''}">Guardar</button></div></div>`);
}

function sessionDetail(s) {
  openSheet(`<h2>${esc(s.name)}</h2><p class="muted small">${fmtDate(s.date)} · ${fmtTime(s.startedAt)}–${fmtTime(s.endedAt)}</p>
    ${s.run ? `<div class="card inner">🏃 ${esc(fmtRun(s.run))}</div>` : ''}
    ${s.exercises.map(e => `<div class="card inner"><b>${esc(e.name)}</b><br><small>${fmtSets(e.sets)}</small></div>`).join('')}
    <div class="row between mt"><button class="danger" data-action="delete-session" data-id="${s.id}">Borrar</button>
      <div class="btns">${s.exercises.length ? `<button data-action="session-to-template" data-id="${s.id}">Guardar como planilla</button>` : ''}<button data-action="close-sheet">Cerrar</button></div></div>`);
}

function previewPlan(parsed) {
  openSheet(`<h2>${parsed.mode === 'reorganizar' ? 'Reorganización' : 'Plan nuevo'}</h2>
    ${parsed.summary ? `<p class="small">${esc(parsed.summary)}</p>` : ''}
    ${parsed.mode === 'reorganizar' ? '<p class="muted small">Se conservan las sesiones ya hechas y se reemplaza el resto.</p>' : '<p class="muted small">Reemplaza el plan actual.</p>'}
    ${parsed.days.map(d => `<div class="card inner"><b>${esc(d.label)} · ${esc(d.name)}</b>
      ${d.run ? `<br><small>🏃 ${esc(runTargetText(d.run))}</small>` : ''}
      ${d.exercises.length ? `<br><small class="muted">${d.exercises.map(e => `${esc(e.name)} ${e.sets}×${e.repMin}${e.repMax !== e.repMin ? '–' + e.repMax : ''}${e.weight != null ? ` (${e.weight} kg)` : ''}`).join(' · ')}</small>` : ''}</div>`).join('')}
    <label class="check-row"><input type="checkbox" id="alsoTpl"> Guardar también los días de gimnasio como planillas</label>
    <div class="row mt"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="apply-plan">Aplicar</button></div>`);
}

// ---------- respaldo ----------

async function exportData() {
  const name = `gym-respaldo-${localDate()}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  let done = false;
  // En iPhone, "compartir" abre el menú del sistema para guardarlo en Archivos/iCloud.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done = true; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  if (!done) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  state.lastExport = new Date().toISOString();
  save();
  render();
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.sessions)) throw new Error('no parece un respaldo de esta app');
    if (!confirm(`Esto reemplaza TODOS los datos actuales por el respaldo (${data.sessions.length} entrenamientos). ¿Seguir?`)) return;
    replaceState(data);
    render();
    toast('Respaldo importado');
  } catch (e) {
    alert(`No se pudo importar: ${e.message}. Elegí un archivo .json exportado desde esta app.`);
  }
}

// ---------- acciones ----------

const findPlanDay = id => state.plan?.days.find(d => d.id === id);
const findTpl = id => state.templates.find(t => t.id === id);

const ACTIONS = {
  goto: d => { ui.tab = d.tab; render(); scrollTo(0, 0); },
  'goto-reorg': () => { ui.tab = 'claude'; ui.claudeMode = 'reorganizar'; render(); scrollTo(0, 0); },

  'start-plan': d => { const day = findPlanDay(d.id); startSession(day.name, { kind: 'plan', id: day.id }, day.exercises, day.run); },
  'skip-day': d => { findPlanDay(d.id).status = 'salteada'; save(); render(); },
  'unskip-day': d => { findPlanDay(d.id).status = 'pendiente'; save(); render(); },
  'start-template': d => { const t = findTpl(d.id); startSession(t.name, { kind: 'template', id: t.id }, t.exercises); },
  'start-free': () => startSession('Gimnasio libre', { kind: 'libre' }),
  'start-run': () => startSession('Carrera', { kind: 'libre' }, [], null, true),

  discard: () => { if (confirm('¿Descartar este entrenamiento? No se guarda nada.')) { state.active = null; save(); render(); } },
  finish: finishSession,

  'add-exercise': () => openSheet(`<h2>Agregar ejercicio</h2>
    <input id="newEx" list="exnames" placeholder="Nombre del ejercicio o máquina" autocomplete="off">${datalist()}
    <div class="row mt"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="add-exercise-ok">Agregar</button></div>`),
  'add-exercise-ok': () => {
    const name = $('#newEx').value.trim();
    if (!name) return;
    state.active.exercises.push(newExercise(name));
    save(); closeSheet(); render();
  },
  'remove-exercise': d => {
    const ex = state.active.exercises[d.i];
    if (ex.sets.some(s => s.reps !== '') && !confirm(`¿Quitar ${ex.name} con sus series?`)) return;
    state.active.exercises.splice(d.i, 1); save(); render();
  },
  'add-set': d => {
    const sets = state.active.exercises[d.i].sets;
    const prev = sets[sets.length - 1];
    sets.push({ weight: prev?.weight ?? '', reps: '', rir: '', done: false });
    save(); render();
  },
  'remove-set': d => { state.active.exercises[d.i].sets.pop(); save(); render(); },
  // Tocar ✓ con los campos vacíos acepta lo sugerido (el texto gris), para cargar rápido.
  'toggle-set': d => {
    const ex = state.active.exercises[d.i];
    const s = ex.sets[d.j];
    s.done = !s.done;
    if (s.done) {
      const sug = suggestionFor(ex);
      if (s.weight === '' && sug.weight != null) s.weight = sug.weight;
      if (s.reps === '' && sug.reps != null) s.reps = sug.reps;
    }
    save(); render();
  },
  'add-run': () => { state.active.run = newRun(); save(); render(); },
  'remove-run': () => { if (confirm('¿Quitar la carrera de este entrenamiento?')) { state.active.run = null; save(); render(); } },

  'close-sheet': closeSheet,

  'open-session': d => sessionDetail(state.sessions.find(s => s.id === d.id)),
  'delete-session': d => {
    if (!confirm('¿Borrar este entrenamiento del historial?')) return;
    state.sessions = state.sessions.filter(s => s.id !== d.id);
    const day = state.plan?.days.find(x => x.sessionId === d.id);
    if (day) Object.assign(day, { status: 'pendiente', sessionId: null, doneDate: null });
    save(); closeSheet(); render();
  },
  'session-to-template': d => {
    const s = state.sessions.find(x => x.id === d.id);
    const name = prompt('Nombre de la planilla', s.name);
    if (!name) return;
    state.templates.push({
      id: uid(), name, source: 'manual',
      exercises: s.exercises.map(e => {
        const reps = e.sets.map(x => x.reps);
        const rirs = e.sets.map(x => x.rir).filter(r => r != null);
        return { ...blankTarget(), name: e.name, sets: e.sets.length, repMin: Math.min(...reps), repMax: Math.max(...reps), rir: rirs.length ? Math.round(rirs.reduce((a, b) => a + b) / rirs.length) : 2 };
      }),
    });
    save(); closeSheet(); toast('Planilla guardada');
  },

  'new-template': () => openTemplateEditor(null),
  'edit-template': d => openTemplateEditor(findTpl(d.id)),
  'tpl-add-row': () => { readDraft(); ui.draft.exercises.push(blankTarget()); renderTemplateEditor(); },
  'tpl-remove-row': d => { readDraft(); ui.draft.exercises.splice(d.i, 1); renderTemplateEditor(); },
  'tpl-save': () => {
    readDraft();
    const t = ui.draft;
    t.exercises = t.exercises.filter(e => e.name).map(e => ({ ...e, sets: e.sets || 3, repMin: e.repMin || 8, repMax: e.repMax || e.repMin || 8 }));
    if (!t.name) return alert('Ponele un nombre a la planilla.');
    if (!t.exercises.length) return alert('Agregá al menos un ejercicio con nombre.');
    if (t.id) state.templates[state.templates.findIndex(x => x.id === t.id)] = t;
    else state.templates.push({ ...t, id: uid() });
    save(); closeSheet(); render();
  },
  'delete-template': () => {
    if (!confirm(`¿Borrar la planilla "${ui.draft.name}"?`)) return;
    state.templates = state.templates.filter(t => t.id !== ui.draft.id);
    save(); closeSheet(); render();
  },

  'create-gym': () => {
    const name = $('#gymName').value.trim();
    if (!name) return;
    const g = { id: uid(), name, equipment: [] };
    state.gyms.push(g); state.activeGymId = g.id; save(); render();
  },
  'new-gym': () => {
    const name = prompt('Nombre del nuevo gimnasio');
    if (!name) return;
    const g = { id: uid(), name, equipment: [] };
    state.gyms.push(g); state.activeGymId = g.id; save(); render();
  },
  'rename-gym': () => { const g = activeGym(); const name = prompt('Nuevo nombre', g.name); if (name) { g.name = name; save(); render(); } },
  'delete-gym': () => {
    const g = activeGym();
    if (!confirm(`¿Borrar "${g.name}" y todo su equipamiento? Tu historial no se borra.`)) return;
    state.gyms = state.gyms.filter(x => x.id !== g.id);
    state.activeGymId = state.gyms[0]?.id || null;
    save(); render();
  },
  'add-equip': () => equipForm(),
  'edit-equip': d => equipForm(activeGym().equipment.find(e => e.id === d.id)),
  'save-equip': d => {
    const name = $('#eqName').value.trim();
    if (!name) return alert('Ponele un nombre al equipo.');
    const data = { name, kind: $('#eqKind').value, increment: num($('#eqInc').value) ?? 0, notes: $('#eqNotes').value.trim() };
    const list = activeGym().equipment;
    const ex = list.find(e => e.id === d.id);
    if (ex) Object.assign(ex, data); else list.push({ id: uid(), ...data });
    save(); closeSheet(); render();
  },
  'delete-equip': d => { const g = activeGym(); g.equipment = g.equipment.filter(e => e.id !== d.id); save(); closeSheet(); render(); },
  'bulk-equip': () => openSheet(`<h2>Carga rápida</h2>
    <p class="muted small">Uno por línea. Opcional, separado por ";": tipo y escalón en kg.<br>Tipos: ${Object.keys(KINDS).join(', ')}.</p>
    <textarea id="bulkEq" placeholder="Prensa 45°; máquina; 5&#10;Polea alta; polea&#10;Mancuernas; peso libre; 2&#10;Banco plano"></textarea>
    <div class="row mt"><button data-action="close-sheet">Cancelar</button><button class="primary" data-action="bulk-equip-ok">Agregar</button></div>`),
  'bulk-equip-ok': () => {
    const lines = $('#bulkEq').value.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      const [name, kindRaw, inc] = l.split(';').map(x => x.trim());
      const kind = KINDS[norm(kindRaw)] !== undefined ? norm(kindRaw) : 'máquina';
      activeGym().equipment.push({ id: uid(), name, kind, increment: num(inc) ?? KINDS[kind], notes: '' });
    }
    save(); closeSheet(); render(); toast(`${lines.length} equipos agregados`);
  },

  'add-race': () => raceForm(),
  'edit-race': d => raceForm(state.races.find(r => r.id === d.id)),
  'save-race': d => {
    const data = { name: $('#rcName').value.trim(), date: $('#rcDate').value, distanceKm: num($('#rcDist').value), goalTime: $('#rcGoal').value.trim(), priority: $('#rcPrio').value, notes: $('#rcNotes').value.trim() };
    if (!data.name || !data.date || !data.distanceKm) return alert('Completá nombre, fecha y distancia.');
    const ex = state.races.find(r => r.id === d.id);
    if (ex) Object.assign(ex, data); else state.races.push({ id: uid(), ...data });
    save(); closeSheet(); render();
  },
  'delete-race': d => { state.races = state.races.filter(r => r.id !== d.id); save(); closeSheet(); render(); },

  export: exportData,
  import: () => $('#importFile').click(),

  'claude-mode': d => { ui.claudeMode = d.mode; render(); },
  'copy-prompt': async () => {
    const text = buildPrompt(ui.claudeMode, ui.note);
    try {
      await navigator.clipboard.writeText(text);
      toast('Pedido copiado: pegalo en Claude');
    } catch {
      ACTIONS['show-prompt']();
    }
  },
  'show-prompt': () => openSheet(`<h2>Pedido para Claude</h2><p class="muted small">Seleccioná todo y copialo.</p>
    <textarea class="tall" readonly>${esc(buildPrompt(ui.claudeMode, ui.note))}</textarea>
    <button class="block mt" data-action="close-sheet">Cerrar</button>`),
  'paste-clip': async () => {
    try {
      ui.resp = await navigator.clipboard.readText();
      render();
    } catch {
      toast('No pude leer el portapapeles: pegá a mano en el cuadro');
    }
  },
  'parse-resp': () => {
    try {
      ui.parsed = parseResponse(ui.resp);
      previewPlan(ui.parsed);
    } catch (e) {
      alert(e.message);
    }
  },
  'apply-plan': () => {
    applyPlan(ui.parsed, $('#alsoTpl').checked);
    ui.parsed = null; ui.resp = ''; ui.note = '';
    save(); closeSheet();
    ui.tab = 'entrenar'; render(); scrollTo(0, 0);
    toast('Plan aplicado');
  },
};

// ---------- listeners ----------

document.addEventListener('click', e => {
  const tabBtn = e.target.closest('#tabs button');
  if (tabBtn) {
    ui.tab = tabBtn.dataset.tab;
    try { localStorage.setItem('gym.tab', ui.tab); } catch {}
    render(); scrollTo(0, 0);
    return;
  }
  if (e.target.id === 'sheet') return closeSheet(); // tocar fuera del panel cierra
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = { ...el.dataset };
  if (d.i != null) d.i = +d.i;
  if (d.j != null) d.j = +d.j;
  ACTIONS[d.action]?.(d, el);
});

// Guarda cada campo mientras escribís, sin redibujar.
function onField(e) {
  const el = e.target;
  const f = el.dataset.field;
  if (!f) return;
  const [scope, key] = f.split('.');
  const v = el.value;
  if (scope === 'set') state.active.exercises[+el.dataset.i].sets[+el.dataset.j][key] = v;
  else if (scope === 'run') {
    state.active.run[key] = v;
    if (key === 'distance' || key === 'time') $('#pace').innerHTML = paceText(state.active.run);
  } else if (scope === 'profile') {
    state.profile[key] = ['daysPerWeek', 'runDaysPerWeek', 'sessionMinutes'].includes(key) ? (parseInt(v, 10) || 0) : v;
  } else if (scope === 'gym') {
    state.activeGymId = v; save(); render(); return;
  } else if (scope === 'ui') {
    ui[key] = v; return;
  }
  save();
}
document.addEventListener('input', onField);
document.addEventListener('change', e => { if (e.target.tagName === 'SELECT') onField(e); });
document.addEventListener('change', e => { if (e.target.id === 'importFile' && e.target.files[0]) importData(e.target.files[0]); });

// Service worker (modo sin internet). No se registra en localhost para que, mientras
// desarrollás, cada recarga muestre los cambios sin pelearse con la caché.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js');
}
navigator.storage?.persist?.();

render();
