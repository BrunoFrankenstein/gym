# Gym — app personal de gimnasio y running

App web instalable (PWA) para el iPhone, sin Mac ni App Store. HTML + JavaScript puro,
sin paso de compilación: lo que está en esta carpeta es lo que se publica.

## Qué hace (MVP)

- **Gimnasio y equipamiento:** cargás las máquinas de tu gimnasio. Si te cambiás de gimnasio,
  creás otro y lo marcás como activo.
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
| `sw.js` | Caché para modo sin internet |
