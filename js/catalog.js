// Máquinas y equipos que se pueden elegir para un gimnasio. Los ejercicios NO están acá: la
// app baja el dataset completo de RepDB (701 ejercicios) la primera vez y el service worker
// lo guarda (ver exercises.js). La licencia de RepDB no permite republicarlo como dataset,
// así que en este repositorio sólo queda esta lista propia que lo agrupa.
//
// Cada máquina: { id, name, group, kind, eq, extra?, cover? }
//   eq    = claves "equipment" de RepDB que se hacen con este equipo;
//   extra = ejercicios sueltos que también van acá (p. ej. el jalón, que RepDB anota como
//           "cable" pero en el gimnasio es su propia máquina);
//   cover = ejercicio cuyo dibujo representa a la máquina (si no, el primero que haya).
// kind fija el escalón por defecto (ver KINDS en app.js); 'peso corporal' y 'cardio' no
// preguntan escalón.
//
// El orden importa: un ejercicio que está en dos máquinas se asocia a la primera (por eso
// las específicas van antes que "Poleas").

export const MACHINES = [
  // Piernas
  { id: 'leg_press', name: 'Prensa de piernas', group: 'Piernas', kind: 'máquina', eq: ['leg_press'], cover: 'leg-press' },
  { id: 'hack_squat', name: 'Hack squat', group: 'Piernas', kind: 'máquina', eq: ['hack_squat'], cover: 'hack-squat' },
  { id: 'leg_extension', name: 'Extensión de cuádriceps', group: 'Piernas', kind: 'máquina', eq: ['leg_extension'], cover: 'leg-extension' },
  { id: 'leg_curl', name: 'Curl femoral', group: 'Piernas', kind: 'máquina', eq: ['leg_curl'], cover: 'seated-leg-curl' },
  { id: 'hip_adduction_machine', name: 'Aductores', group: 'Piernas', kind: 'máquina', eq: ['hip_adduction_machine'] },
  { id: 'hip_abduction_machine', name: 'Abductores', group: 'Piernas', kind: 'máquina', eq: ['hip_abduction_machine'] },
  { id: 'hip_thrust_machine', name: 'Hip thrust en máquina', group: 'Piernas', kind: 'máquina', eq: ['hip_thrust_machine'] },
  { id: 'standing_calf_raise_machine', name: 'Gemelos de pie', group: 'Piernas', kind: 'máquina', eq: ['standing_calf_raise_machine'] },
  { id: 'seated_calf_raise_machine', name: 'Gemelos sentado', group: 'Piernas', kind: 'máquina', eq: ['seated_calf_raise_machine'] },
  { id: 'donkey_calf_raise_machine', name: 'Gemelos tipo burro', group: 'Piernas', kind: 'máquina', eq: ['donkey_calf_raise_machine'] },
  { id: 'glute_ham_developer', name: 'GHD (nórdicos)', group: 'Piernas', kind: 'peso corporal', eq: ['glute_ham_developer'] },
  { id: 'sled', name: 'Trineo', group: 'Piernas', kind: 'peso libre', eq: ['sled'] },
  // Espalda
  { id: 'lat_pulldown_machine', name: 'Jalón al pecho', group: 'Espalda', kind: 'polea', eq: ['lat_pulldown_machine'],
    extra: ['lat-pulldown', 'close-grip-lat-pulldown', 'reverse-grip-lat-pulldown', 'one-arm-lat-pulldown', 'straight-arm-pulldown'], cover: 'lat-pulldown' },
  { id: 'cable_row', name: 'Remo en polea baja', group: 'Espalda', kind: 'polea', eq: [],
    extra: ['seated-cable-row', 'wide-grip-seated-cable-row', 'one-arm-seated-cable-row', 'kneeling-cable-row'], cover: 'seated-cable-row' },
  { id: 'seated_row_machine', name: 'Remo en máquina', group: 'Espalda', kind: 'máquina', eq: ['seated_row_machine'] },
  { id: 'assisted_pullup_machine', name: 'Dominadas asistidas', group: 'Espalda', kind: 'máquina', eq: ['assisted_pullup_machine'] },
  { id: 'pull_up_bar', name: 'Barra de dominadas', group: 'Espalda', kind: 'peso corporal', eq: ['pull_up_bar'], cover: 'pull-up' },
  { id: 'back_extension_machine', name: 'Extensión lumbar', group: 'Espalda', kind: 'máquina', eq: ['back_extension_machine'] },
  { id: 'shrug_machine', name: 'Encogimientos en máquina', group: 'Espalda', kind: 'máquina', eq: ['shrug_machine'] },
  { id: 'trap_bar', name: 'Barra hexagonal', group: 'Espalda', kind: 'peso libre', eq: ['trap_bar'] },
  // Pecho
  { id: 'chest_press_machine', name: 'Press de pecho en máquina', group: 'Pecho', kind: 'máquina', eq: ['chest_press_machine'] },
  { id: 'pec_deck', name: 'Pec deck / aperturas', group: 'Pecho', kind: 'máquina', eq: ['pec_deck', 'chest_fly_machine'], cover: 'pec-deck' },
  { id: 'dip_machine', name: 'Fondos en máquina', group: 'Pecho', kind: 'máquina', eq: ['dip_machine', 'plate_loaded_dip_machine'], cover: 'seated-dip-machine' },
  { id: 'dip_station', name: 'Paralelas', group: 'Pecho', kind: 'peso corporal', eq: ['dip_station'], cover: 'dips' },
  // Hombros
  { id: 'shoulder_press_machine', name: 'Press de hombros en máquina', group: 'Hombros', kind: 'máquina', eq: ['shoulder_press_machine'] },
  { id: 'plate_loaded_lateral_raise_machine', name: 'Vuelos laterales en máquina', group: 'Hombros', kind: 'máquina', eq: ['plate_loaded_lateral_raise_machine'] },
  { id: 'reverse_fly_machine', name: 'Deltoides posterior en máquina', group: 'Hombros', kind: 'máquina', eq: ['reverse_fly_machine'] },
  // Brazos
  { id: 'bicep_curl_machine', name: 'Curl de bíceps en máquina', group: 'Brazos', kind: 'máquina', eq: ['bicep_curl_machine'] },
  { id: 'preacher_curl_machine', name: 'Banco Scott en máquina', group: 'Brazos', kind: 'máquina', eq: ['preacher_curl_machine'] },
  { id: 'tricep_extension_machine', name: 'Tríceps en máquina', group: 'Brazos', kind: 'máquina', eq: ['tricep_extension_machine'] },
  { id: 'wrist_roller', name: 'Rodillo de muñeca', group: 'Brazos', kind: 'peso libre', eq: ['wrist_roller'] },
  // Core
  { id: 'ab_crunch_machine', name: 'Abdominales en máquina', group: 'Core', kind: 'máquina', eq: ['ab_crunch_machine'] },
  { id: 'ab_wheel', name: 'Rueda abdominal', group: 'Core', kind: 'peso corporal', eq: ['ab_wheel'] },
  // Multiuso: pesos libres, poleas y accesorios
  { id: 'cable', name: 'Poleas / crossover', group: 'Multiuso', kind: 'polea', eq: ['cable'], cover: 'tricep-pushdown' },
  { id: 'smith_machine', name: 'Máquina Smith', group: 'Multiuso', kind: 'máquina', eq: ['smith_machine'], cover: 'smith-machine-squat' },
  { id: 'dumbbell', name: 'Mancuernas', group: 'Multiuso', kind: 'peso libre', eq: ['dumbbell'], cover: 'db-bench-press' },
  { id: 'barbell', name: 'Barra olímpica y discos', group: 'Multiuso', kind: 'peso libre', eq: ['barbell', 'plates'], cover: 'squat' },
  { id: 'ez_bar', name: 'Barra Z', group: 'Multiuso', kind: 'peso libre', eq: ['ez_bar'], cover: 'ez-bar-curl' },
  { id: 'kettlebell', name: 'Kettlebells', group: 'Multiuso', kind: 'peso libre', eq: ['kettlebell'], cover: 'kettlebell-swing' },
  { id: 'flat_bench', name: 'Banco plano / inclinado', group: 'Multiuso', kind: 'peso corporal', eq: ['flat_bench'], cover: 'single-leg-hip-thrust' },
  { id: 'medicine_ball', name: 'Balón medicinal', group: 'Multiuso', kind: 'peso libre', eq: ['medicine_ball', 'slam_ball', 'wall_ball'] },
  { id: 'bands', name: 'Bandas elásticas', group: 'Multiuso', kind: 'peso corporal', eq: ['loop_band', 'resistance_band'] },
  { id: 'suspension_trainer', name: 'TRX', group: 'Multiuso', kind: 'peso corporal', eq: ['suspension_trainer'] },
  { id: 'rings', name: 'Anillas', group: 'Multiuso', kind: 'peso corporal', eq: ['rings'] },
  { id: 'stability_ball', name: 'Fitball', group: 'Multiuso', kind: 'peso corporal', eq: ['stability_ball'] },
  { id: 'bosu_ball', name: 'Bosu', group: 'Multiuso', kind: 'peso corporal', eq: ['bosu_ball'] },
  { id: 'plyo_box', name: 'Cajón', group: 'Multiuso', kind: 'peso corporal', eq: ['plyo_box'] },
  { id: 'battle_rope', name: 'Cuerdas de batalla', group: 'Multiuso', kind: 'peso corporal', eq: ['battle_rope', 'climbing_rope'] },
  { id: 'sandbag', name: 'Saco de arena', group: 'Multiuso', kind: 'peso libre', eq: ['sandbag'] },
  // Cardio
  { id: 'treadmill', name: 'Cinta', group: 'Cardio', kind: 'cardio', eq: ['treadmill'], cover: 'treadmill-running' },
  { id: 'stationary_bike', name: 'Bicicleta fija', group: 'Cardio', kind: 'cardio', eq: ['stationary_bike', 'bicycle'], cover: 'stationary-bike' },
  { id: 'elliptical', name: 'Elíptica', group: 'Cardio', kind: 'cardio', eq: ['elliptical'] },
  { id: 'rower', name: 'Remo ergómetro', group: 'Cardio', kind: 'cardio', eq: ['rower'] },
  { id: 'stair_climber', name: 'Escaladora', group: 'Cardio', kind: 'cardio', eq: ['stair_climber'] },
  { id: 'air_bike', name: 'Air bike', group: 'Cardio', kind: 'cardio', eq: ['air_bike'] },
  { id: 'ski_erg', name: 'SkiErg', group: 'Cardio', kind: 'cardio', eq: ['ski_erg'] },
  { id: 'jump_rope', name: 'Soga de saltar', group: 'Cardio', kind: 'cardio', eq: ['jump_rope'] },
];
