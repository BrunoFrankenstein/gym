// Todo lo que une el catálogo (catalog.js) con la interfaz: buscar un ejercicio por nombre,
// armar la URL de su dibujo y pintar el mapa de músculos.

import { MACHINES, BODYWEIGHT, EXERCISES } from './catalog.js';
import { BODY } from './body.js';

export { MACHINES, EXERCISES };

// Los dibujos se piden a RepDB (no se pueden republicar en este repo; ver catalog.js).
// El service worker los guarda después de la primera vez, así andan sin internet.
const IMG = 'https://exercise-dataset.com/images/flat/';
export const imgUrl = (id, pose = 'peak') => `${IMG}${id}-${EXERCISES[id]?.one ? 'main' : pose}.webp`;

// Comparar nombres sin mayúsculas, tildes ni espacios de más: Claude a veces escribe
// "Prensa de piernas" y el catálogo dice "Prensa de Piernas".
const key = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const BY_NAME = new Map(Object.entries(EXERCISES).map(([id, e]) => [key(e.n), id]));
export const exerciseIdByName = name => BY_NAME.get(key(name)) || null;

export const machineById = id => MACHINES.find(m => m.id === id) || null;
export const machineOfExercise = id => MACHINES.find(m => m.ex.includes(id)) || null;

// Ejercicios que se pueden hacer en un gimnasio: los de sus máquinas más los de peso corporal.
export function exercisesForGym(gym) {
  const ids = new Set();
  gym?.equipment.forEach(e => machineById(e.cat)?.ex.forEach(i => ids.add(i)));
  BODYWEIGHT.forEach(i => ids.add(i));
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
