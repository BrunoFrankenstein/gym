# Genera js/catalog.js a partir del dataset de RepDB (selección curada de máquinas y ejercicios).
# Uso: bajar https://exercise-dataset.com/exercises.json y correr
#   python tools/gencat.py exercises.json js/catalog.js
# Para sumar una máquina o un ejercicio, agregalo a M o BODYWEIGHT y regenerá.
import json, sys

src, out = sys.argv[1], sys.argv[2]
D = {x['id']: x for x in json.load(open(src, encoding='utf-8'))['exercises']}

# (clave, nombre, grupo, tipo, [ejercicios])  — el primero da la imagen de la tarjeta.
M = [
  ('leg_press', 'Prensa de piernas', 'Piernas', 'máquina', ['leg-press', 'wide-stance-leg-press', 'close-stance-leg-press', 'high-foot-leg-press', 'single-leg-press']),
  ('hack_squat', 'Hack squat', 'Piernas', 'máquina', ['hack-squat', 'hack-squat-calf-raise']),
  ('leg_extension', 'Extensión de cuádriceps', 'Piernas', 'máquina', ['leg-extension', 'single-leg-extension']),
  ('leg_curl', 'Curl femoral', 'Piernas', 'máquina', ['seated-leg-curl', 'leg-curl', 'single-leg-lying-leg-curl']),
  ('hip_adduction_machine', 'Aductores', 'Piernas', 'máquina', ['hip-adduction']),
  ('hip_abduction_machine', 'Abductores', 'Piernas', 'máquina', ['hip-abduction']),
  ('hip_thrust_machine', 'Hip thrust en máquina', 'Piernas', 'máquina', ['plate-loaded-glute-drive']),
  ('standing_calf_raise_machine', 'Gemelos de pie', 'Piernas', 'máquina', ['machine-calf-raise', 'standing-calf-raise']),
  ('seated_calf_raise_machine', 'Gemelos sentado', 'Piernas', 'máquina', ['seated-calf-raise']),
  ('glute_ham_developer', 'GHD (nórdicos)', 'Piernas', 'peso corporal', ['nordic-hamstring-curl']),
  ('lat_pulldown_machine', 'Jalón al pecho', 'Espalda', 'polea', ['lat-pulldown', 'close-grip-lat-pulldown', 'reverse-grip-lat-pulldown', 'v-bar-lat-pulldown', 'one-arm-lat-pulldown', 'straight-arm-pulldown']),
  ('cable_row', 'Remo en polea baja', 'Espalda', 'polea', ['seated-cable-row', 'wide-grip-seated-cable-row', 'one-arm-seated-cable-row']),
  ('seated_row_machine', 'Remo en máquina', 'Espalda', 'máquina', ['chest-supported-machine-row']),
  ('assisted_pullup_machine', 'Dominadas asistidas', 'Espalda', 'máquina', ['assisted-pull-ups', 'assisted-dips']),
  ('pull_up_bar', 'Barra de dominadas', 'Espalda', 'peso corporal', ['pull-up', 'chin-ups', 'neutral-grip-pull-ups', 'negative-pull-ups', 'hanging-knee-raise', 'hanging-leg-raise']),
  ('back_extension_machine', 'Extensión lumbar', 'Espalda', 'máquina', ['machine-back-extension', 'back-extension']),
  ('chest_press_machine', 'Press de pecho en máquina', 'Pecho', 'máquina', ['chest-press-machine']),
  ('pec_deck', 'Pec deck', 'Pecho', 'máquina', ['pec-deck', 'machine-chest-fly']),
  ('dip_machine', 'Fondos en máquina', 'Pecho', 'máquina', ['seated-dip-machine']),
  ('dip_station', 'Paralelas', 'Pecho', 'peso corporal', ['dips', 'weighted-dips']),
  ('shoulder_press_machine', 'Press de hombros en máquina', 'Hombros', 'máquina', ['machine-shoulder-press', 'single-arm-machine-shoulder-press']),
  ('plate_loaded_lateral_raise_machine', 'Vuelos laterales en máquina', 'Hombros', 'máquina', ['plate-loaded-lateral-raise', 'single-arm-plate-loaded-lateral-raise']),
  ('reverse_fly_machine', 'Deltoides posterior en máquina', 'Hombros', 'máquina', ['machine-reverse-fly']),
  ('bicep_curl_machine', 'Curl de bíceps en máquina', 'Brazos', 'máquina', ['machine-bicep-curl']),
  ('preacher_curl_machine', 'Banco Scott en máquina', 'Brazos', 'máquina', ['machine-preacher-curl']),
  ('tricep_extension_machine', 'Tríceps en máquina', 'Brazos', 'máquina', ['machine-triceps-extension']),
  ('ab_crunch_machine', 'Abdominales en máquina', 'Core', 'máquina', ['machine-seated-crunch']),
  ('cable', 'Poleas / crossover', 'Multiuso', 'polea', ['tricep-pushdown', 'v-bar-tricep-pushdown', 'cable-overhead-tricep-extension', 'cable-curl', 'cable-hammer-curl', 'face-pull', 'cable-lateral-raise', 'cable-reverse-fly', 'cable-fly', 'cable-crunch', 'cable-pallof-press', 'cable-kickback', 'cable-pull-through']),
  ('smith_machine', 'Máquina Smith', 'Multiuso', 'máquina', ['smith-machine-squat', 'smith-machine-bench-press', 'smith-machine-incline-bench-press', 'smith-machine-shoulder-press', 'smith-machine-rdl', 'smith-machine-hip-thrust', 'smith-machine-bent-over-row', 'smith-machine-split-squat', 'smith-machine-calf-raise']),
  ('dumbbell', 'Mancuernas', 'Multiuso', 'peso libre', ['db-bench-press', 'incline-db-press', 'dumbbell-shoulder-press', 'lateral-raise', 'rear-delt-fly', 'single-arm-db-row', 'chest-supported-db-row', 'bicep-curl', 'hammer-curl', 'incline-db-curl', 'overhead-tricep-extension', 'db-skull-crusher', 'db-fly', 'dumbbell-romanian-deadlift', 'db-goblet-squat', 'bulgarian-split-squat', 'db-lunge', 'dumbbell-hip-thrust', 'db-shrug', 'dumbbell-calf-raise']),
  ('barbell', 'Barra y discos', 'Multiuso', 'peso libre', ['squat', 'bench-press', 'deadlift', 'romanian-deadlift', 'ohp', 'barbell-row', 'incline-bench-press', 'hip-thrust', 'front-squat', 'close-grip-bench-press', 'barbell-curl', 'good-morning', 't-bar-row']),
  ('ez_bar', 'Barra Z', 'Multiuso', 'peso libre', ['ez-bar-curl', 'ez-bar-lying-tricep-extension', 'preacher-curl', 'ez-bar-overhead-extension', 'ez-bar-upright-row']),
  ('kettlebell', 'Kettlebells', 'Multiuso', 'peso libre', ['kettlebell-swing', 'kettlebell-squat', 'one-arm-kettlebell-row', 'kettlebell-single-leg-deadlift', 'suitcase-carry']),
  ('flat_bench', 'Banco plano / inclinado', 'Multiuso', 'otro', ['single-leg-hip-thrust', 'bench-dips']),
  ('treadmill', 'Cinta', 'Cardio', 'cardio', ['treadmill-running', 'incline-treadmill-walk']),
  ('stationary_bike', 'Bicicleta fija', 'Cardio', 'cardio', ['stationary-bike']),
  ('elliptical', 'Elíptica', 'Cardio', 'cardio', ['elliptical-trainer']),
  ('rower', 'Remo ergómetro', 'Cardio', 'cardio', ['rowing-machine']),
  ('stair_climber', 'Escaladora', 'Cardio', 'cardio', ['stair-climber']),
  ('air_bike', 'Air bike', 'Cardio', 'cardio', ['air-bike']),
  ('ski_erg', 'SkiErg', 'Cardio', 'cardio', ['ski-erg']),
]
# Ejercicios sin equipo: siempre disponibles.
BODYWEIGHT = ['push-up', 'incline-push-ups', 'plank', 'side-plank', 'dead-bug', 'crunches', 'lying-leg-raise', 'bodyweight-squat', 'walking-lunge', 'split-squat', 'step-ups', 'glute-bridge', 'single-leg-glute-bridge', 'single-leg-calf-raise', 'bird-dog', 'superman', 'wall-sit', 'inverted-row']

missing = [i for _, _, _, _, xs in M for i in xs if i not in D] + [i for i in BODYWEIGHT if i not in D]
if missing:
  sys.exit('faltan: ' + ', '.join(missing))

def ex(i):
  x = D[i]
  name = x['name_es'].strip()
  r = {'n': name[0].upper() + name[1:], 'p': x['primary_muscles'], 's': x.get('secondary_muscles', []),
       'steps': x.get('instructions_es', []), 'tips': x.get('tips_es', [])[:2]}
  # La mayoría trae dos poses (inicio y final); las posturas sostenidas y el cardio, una sola.
  if 'start' not in x['images']['flat']:
    assert x['images']['flat']['main'], i
    r['one'] = 1
  return r

EX = {}
for _, _, _, _, xs in M:
  for i in xs: EX[i] = ex(i)
for i in BODYWEIGHT: EX[i] = ex(i)

machines = [{'id': k, 'name': n, 'group': g, 'kind': t, 'ex': xs} for k, n, g, t, xs in M]
js = open(out, 'w', encoding='utf-8', newline='\n')
js.write('''// Catálogo de máquinas y ejercicios. GENERADO por un script a partir del dataset gratuito de
// RepDB (selección curada) con tools/gencat.py; no editar a mano, regenerar.
//
// Datos e ilustraciones: "Exercise data by RepDB (repdb.co)" — https://repdb.co
// Licencia RepDB Free Tier v1.0: uso dentro de apps con atribución; NO se puede republicar
// como dataset ni usar las imágenes para alimentar IA generativa. Por eso las imágenes no
// están en este repositorio: se cargan de exercise-dataset.com y el service worker las guarda.
//
// Máquina: { id, name, group, kind, ex: [ids de ejercicio] } (el primer ejercicio da la foto).
// Ejercicio: { n: nombre, p: músculos principales, s: secundarios, steps, tips } (claves cortas
// para que el archivo pese menos).

''')
js.write('export const MACHINES = ' + json.dumps(machines, ensure_ascii=False, indent=0).replace('\n', '') + ';\n\n')
js.write('export const BODYWEIGHT = ' + json.dumps(BODYWEIGHT) + ';\n\n')
js.write('export const EXERCISES = {\n' + ',\n'.join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in EX.items()) + '\n};\n')
js.close()
print(len(machines), 'máquinas,', len(EX), 'ejercicios')
