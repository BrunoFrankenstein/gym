// Todo lo que une el catálogo de ejercicios con la interfaz: bajarlo, buscar un ejercicio
// por nombre, armar la URL de su dibujo y pintar el mapa de músculos.

import { MACHINES } from './catalog.js';
import { BODY } from './body.js';

export { MACHINES };

// Datos e ilustraciones de RepDB ("Exercise data by RepDB (repdb.co)", licencia Free Tier
// v1.0). No se pueden republicar como dataset, así que no viven en este repositorio: se
// bajan de su sitio la primera vez (~600 KB comprimido) y el service worker los guarda.
const SRC = 'https://exercise-dataset.com/';
export const imgUrl = (id, pose = 'peak') => `${SRC}images/flat/${id}-${EXERCISES[id]?.one ? 'main' : pose}.webp`;

// id → { n: nombre, p: músculos principales, s: secundarios, steps, tips, one: sólo una
// pose, part: grupo para la lista, eq: clave de equipo de RepDB }. Vacío hasta que carga.
export const EXERCISES = {};
const BY_NAME = new Map();

// Comparar nombres sin mayúsculas, tildes ni espacios de más: Claude a veces escribe
// "Prensa de piernas" y el catálogo dice "Prensa de Piernas".
const key = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
export const exerciseIdByName = name => BY_NAME.get(key(name)) || null;

// Grupos de la lista "Agregar ejercicio", a partir de body_part y category de RepDB.
export const PARTS = ['Piernas', 'Espalda', 'Pecho', 'Hombros', 'Brazos', 'Core', 'Cuerpo completo', 'Cardio', 'Movilidad'];
const PART = { upper_legs: 'Piernas', lower_legs: 'Piernas', back: 'Espalda', chest: 'Pecho', shoulders: 'Hombros',
  upper_arms: 'Brazos', lower_arms: 'Brazos', core: 'Core', full_body: 'Cuerpo completo' };
const partOf = x => x.category === 'stretching' ? 'Movilidad' : x.category === 'cardio' ? 'Cardio' : PART[x.body_part] || 'Cuerpo completo';

let loading = null;
export const catalogReady = () => Object.keys(EXERCISES).length > 0;

// Baja el dataset (o lo toma de la caché del service worker) y arma los índices. Cada
// máquina recibe su lista `ex`: los ejercicios cuyo equipo está en su `eq`, más sus `extra`.
export function loadCatalog() {
  loading ||= fetch(`${SRC}exercises.json`, { mode: 'cors' })
    .then(r => { if (!r.ok) throw new Error(`respuesta ${r.status}`); return r.json(); })
    .then(data => {
      for (const x of data.exercises) {
        const name = x.name_es.trim();
        EXERCISES[x.id] = {
          n: name[0].toUpperCase() + name.slice(1),
          p: x.primary_muscles || [], s: x.secondary_muscles || [],
          steps: x.instructions_es || [], tips: (x.tips_es || []).slice(0, 2),
          one: !x.images?.flat?.start, part: partOf(x), eq: x.equipment || null,
          // Lo básico primero en las listas: fuerza antes que estiramientos, fácil antes que avanzado.
          rank: (x.category === 'strength' ? 0 : 2) + (x.difficulty === 'advanced' ? 1 : 0),
        };
        BY_NAME.set(key(name), x.id);
      }
      const owner = {};
      for (const m of MACHINES) {
        m.ex = [...new Set([...(m.extra || []).filter(id => EXERCISES[id]),
          ...Object.keys(EXERCISES).filter(id => m.eq.includes(EXERCISES[id].eq))])]
          .sort((a, b) => EXERCISES[a].rank - EXERCISES[b].rank);
        m.ex.forEach(id => (owner[id] ||= m));
        m.cover ||= m.ex[0];
      }
      OWNER = owner;
    })
    .catch(e => { loading = null; throw e; });
  return loading;
}

let OWNER = {};
export const machineById = id => MACHINES.find(m => m.id === id) || null;
// Primera máquina (en el orden de catalog.js) que tiene el ejercicio.
export const machineOfExercise = id => OWNER[id] || null;

// Ejercicios que se pueden hacer en un gimnasio: los de sus máquinas más los que no
// necesitan equipo (peso corporal y estiramientos).
export function exercisesForGym(gym) {
  const ids = new Set();
  gym?.equipment.forEach(e => machineById(e.cat)?.ex?.forEach(i => ids.add(i)));
  for (const [id, x] of Object.entries(EXERCISES)) if (!x.eq) ids.add(id);
  return [...ids];
}

// Nombres de músculos de RepDB en castellano, para las etiquetas.
export const MUSCLE_ES = {
  gluteus_maximus: 'Glúteo mayor', gluteus_medius: 'Glúteo medio', hamstrings: 'Isquiotibiales',
  quadriceps: 'Cuádriceps', adductors: 'Aductores', abductors: 'Abductores', hip_flexors: 'Flexores de cadera',
  gastrocnemius: 'Gemelos', soleus: 'Sóleo', tibialis_anterior: 'Tibial anterior',
  pectoralis_major: 'Pectoral', serratus_anterior: 'Serrato',
  anterior_deltoid: 'Deltoides anterior', lateral_deltoid: 'Deltoides lateral', posterior_deltoid: 'Deltoides posterior', supraspinatus: 'Supraespinoso',
  latissimus_dorsi: 'Dorsal ancho', rhomboids: 'Romboides', trapezius: 'Trapecio', erector_spinae: 'Erectores espinales', quadratus_lumborum: 'Cuadrado lumbar',
  biceps_brachii: 'Bíceps', brachialis: 'Braquial', brachioradialis: 'Braquiorradial', triceps_brachii: 'Tríceps',
  forearm_flexors: 'Antebrazo', forearm_extensors: 'Antebrazo', forearms: 'Antebrazo',
  rectus_abdominis: 'Recto abdominal', transverse_abdominis: 'Transverso abdominal', obliques: 'Oblicuos',
};

// Músculo de RepDB → zona del dibujo del cuerpo. El dibujo tiene menos zonas que RepDB
// músculos (p. ej. un solo "deltoids" para las tres cabezas), así que varios caen en la misma.
// Los flexores de cadera y el serrato no tienen zona propia y no se pintan.
const SLUG = {
  gluteus_maximus: 'gluteal', gluteus_medius: 'gluteal', abductors: 'gluteal', hamstrings: 'hamstring',
  quadriceps: 'quadriceps', adductors: 'adductors', gastrocnemius: 'calves', soleus: 'calves', tibialis_anterior: 'tibialis',
  pectoralis_major: 'chest', anterior_deltoid: 'deltoids', lateral_deltoid: 'deltoids', posterior_deltoid: 'deltoids', supraspinatus: 'deltoids',
  latissimus_dorsi: 'upper-back', rhomboids: 'upper-back', trapezius: 'trapezius', erector_spinae: 'lower-back', quadratus_lumborum: 'lower-back',
  biceps_brachii: 'biceps', brachialis: 'biceps', brachioradialis: 'forearm', triceps_brachii: 'triceps',
  forearm_flexors: 'forearm', forearm_extensors: 'forearm', forearms: 'forearm',
  rectus_abdominis: 'abs', transverse_abdominis: 'abs', obliques: 'obliques',
};

// Cuerpo de frente y de espalda con los principales en lima y los secundarios en verde
// oscuro (colores en styles.css: .body .p / .body .s).
export function bodySvg(primary = [], secondary = []) {
  const P = new Set(primary.map(m => SLUG[m]).filter(Boolean));
  const S = new Set(secondary.map(m => SLUG[m]).filter(s => s && !P.has(s)));
  const side = (parts, box) => `<svg viewBox="${box}" aria-hidden="true">${parts.map(p => {
    const cls = P.has(p.slug) ? 'p' : S.has(p.slug) ? 's' : '';
    return [...(p.common || []), ...(p.left || []), ...(p.right || [])].map(d => `<path${cls ? ` class="${cls}"` : ''} d="${d}"/>`).join('');
  }).join('')}</svg>`;
  return `<div class="body">${side(BODY.front, '0 0 724 1448')}${side(BODY.back, '724 0 724 1448')}</div>`;
}
