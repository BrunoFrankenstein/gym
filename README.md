# Gym — app personal de gimnasio y running

App web instalable (PWA) para el iPhone, sin Mac ni App Store. HTML + JavaScript puro,
sin paso de compilación: lo que está en esta carpeta es lo que se publica.

## Qué hace (MVP)

- **Gimnasio y máquinas:** elegís de un catálogo con dibujos las máquinas que hay en tu
  gimnasio. El peso mínimo de cada una (de a cuánto sube) se pregunta la primera vez que la
  usás. Si te cambiás de gimnasio, creás otro y lo marcás como activo.
- **Ficha de cada ejercicio:** dibujo de inicio y final, mapa del cuerpo con los músculos
  principales y secundarios, pasos y consejos.
- **Tres formas de entrenar:** libre (armás el registro sobre la marcha), desde una planilla
  propia, o siguiendo el plan semanal de Claude.
- **Registro por serie:** peso, reps y RIR (reps en reserva). Al tocar ✓ con los campos vacíos
  se acepta lo sugerido.
- **Running:** distancia, tiempo, ritmo calculado, tipo y RPE. Carreras objetivo con prioridad
  A/B/C y cuenta regresiva.
- **Sugerencia inmediata:** doble progresión guiada por RIR (`js/progression.js`).
- **Claude por copiar y pegar** (`js/claude.js`): la app arma el pedido con todo tu contexto;
  vos lo pegás en Claude y pegás la respuesta de vuelta. Hay tres modos: plan nuevo,
  reorganizar (si salteaste sesiones) y revisar la progresión.
- **Respaldo:** exportar/importar un JSON. Los datos viven sólo en el teléfono.

## Probar en la PC

```bash
python -m http.server 8765
```

Abrí http://localhost:8765. En localhost no se registra el service worker, así que cada recarga
muestra los cambios.

## Instalar en el iPhone

1. Publicar la carpeta en GitHub Pages (repo → Settings → Pages → rama `main`, carpeta raíz).
2. En el iPhone, abrir la URL en **Safari** → Compartir → **Agregar a inicio**.
3. Abrirla siempre desde el ícono: así funciona sin internet y iOS no borra los datos.

Cuando publicás un cambio, aparece la **segunda** vez que abrís la app (la primera baja la
versión nueva en segundo plano). Si cambiás la lista de archivos, subí `CACHE` en `sw.js`.

## Estructura

| Archivo | Qué tiene |
|---|---|
| `js/store.js` | Estado y guardado en localStorage |
| `js/app.js` | Pantallas y acciones |
| `js/progression.js` | Regla local de sobrecarga progresiva |
| `js/claude.js` | Armado del pedido y lectura de la respuesta JSON |
| `js/running.js` | Tiempos, ritmos, cuenta regresiva |
| `js/catalog.js` | Máquinas y ejercicios (generado desde RepDB, no editar a mano) |
| `js/exercises.js` | Búsqueda en el catálogo, URL de los dibujos y mapa de músculos |
| `js/body.js` | Siluetas SVG del cuerpo |
| `sw.js` | Caché para modo sin internet |

## Créditos

- **Exercise data by [RepDB (repdb.co)](https://repdb.co)** — nombres, músculos, pasos y dibujos
  de los ejercicios (licencia RepDB Free Tier v1.0). Las imágenes no están en este repositorio:
  la app las carga de exercise-dataset.com y el service worker las guarda en el teléfono.
- **[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)**
  — siluetas del cuerpo para el mapa de músculos (MIT, © 2022 ELABBASSI Hicham).
- La estética está inspirada en [skulpt](https://github.com/skulptapp/skulpt); no se usó su código.
