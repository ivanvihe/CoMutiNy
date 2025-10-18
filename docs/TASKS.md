# Hoja de ruta ejecutable

Este documento lista tareas accionables para completar el MVP descrito.

## 1. Motor y rendering
- [ ] Implementar controles de cámara en primera persona con bloqueo de cursor y físicas básicas.
- [ ] Añadir ciclo día/noche y animación de iluminación ambiental.
- [ ] Integrar agua con shader dinámico (reflejos, refracciones y caustics simples).
- [ ] Implementar ambient occlusion en tiempo real o precalculada por voxel.

## 2. Sistema de voxels
- [ ] Optimizar chunks usando geometría combinada o instancing para mejorar FPS.
- [ ] Streaming de chunks alrededor del jugador con carga/descarga incremental.
- [ ] Sincronizar colocación/rotura de bloques entre clientes y backend.
- [ ] Añadir más tipos de bloques (metal, cristal tintado, neón) con configuraciones PBR.

## 3. Multiplayer y chat
- [ ] Persistir cuentas con hash de contraseñas y tokens de sesión.
- [ ] Implementar chat global y de proximidad diferenciados.
- [ ] Mostrar avatares personalizados y posiciones de jugadores en tiempo real.
- [ ] Agregar historial de chat almacenado temporalmente en Redis.

## 4. Backend y persistencia
- [ ] Implementar API de autenticación (registro/login) y guardado de inventario.
- [ ] Añadir colas de escritura para persistencia eficiente de modificaciones en chunks.
- [ ] Implementar versionado de mundos y backups incrementales.
- [ ] Crear herramientas de administración (dashboard en `/colyseus`).

## 5. UX/UI
- [ ] Diseñar HUD definitivo con minimapa y panel de eventos.
- [ ] Incorporar tutorial interactivo inicial.
- [ ] Añadir selector visual de bloques con previsualización 3D.
- [ ] Localizar la interfaz al inglés.
