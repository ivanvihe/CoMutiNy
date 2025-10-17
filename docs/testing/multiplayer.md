# Guía de pruebas multijugador y extensión de animaciones

## Pruebas locales del multijugador

1. **Levanta backend y frontend**
   ```bash
   # En una terminal
   npm install --prefix server
   npm run dev --prefix server
   
   # En otra terminal
   npm install --prefix client
   npm run dev --prefix client
   ```
   Por defecto el backend escucha en `http://localhost:4000` y el cliente en `http://localhost:5173`. Comprueba que la variable `VITE_SOCKET_URL` del cliente apunta al gateway del servidor.

2. **Abre múltiples sesiones**
   - Abre dos ventanas o pestañas en navegadores distintos (por ejemplo Chrome y una ventana de incógnito) para evitar que compartan almacenamiento.
   - En cada una selecciona un alias distinto mediante el formulario inicial. El alias es obligatorio y el servidor emitirá `session:terminated` si detecta duplicados.

3. **Sincroniza movimiento y chat**
   - Usa las teclas `WASD`/flechas para mover cada jugador; `MapContext` actualizará la animación (`idle`/`walk`) y enviará `player:update` con la posición y dirección.
   - Verifica que los jugadores remotos aparecen en el HUD y sobre el mapa (`MapViewport.jsx`).
   - Envía mensajes de chat para validar la propagación `chat:message` y la autoría basada en alias.

4. **Comprueba reconexiones**
   - Cierra una pestaña; el servidor debería emitir `player:left` y desaparecer el avatar remoto.
   - Vuelve a abrir la sesión y confirma que el alias anterior se reutiliza y que el listado de tripulantes se actualiza.

## Extender el set de animaciones

El motor reconoce por defecto las animaciones `idle` y `walk`. Para añadir nuevas animaciones:

1. **Actualiza el atlas**
   - Genera sprites con los frames adicionales usando el pipeline descrito en [docs/sprite-generation.md](../sprite-generation.md). Incluye en los metadatos `frames`, `frameWidth`, `frameHeight`, `directions` y, si aplica, `animationSpeed` específico para la nueva animación.

2. **Define la lógica de reproducción**
   - Amplía `SpriteAnimator` (`client/src/game/isometricEngine.js`) para que trate la nueva animación (por ejemplo `emote`) como bucle o frame único. Puedes añadir un `switch` en `getFrame()` para manejar distintas velocidades o ciclos.

3. **Emitir el nuevo estado**
   - Desde el cliente, establece el nombre de la animación al actualizar al jugador. `WorldContext.updateLocalPlayerState()` acepta `partial.animation`; basta con llamar al método con `{ animation: 'emote' }`.
   - Si la animación depende de una interacción, invócala desde el componente correspondiente (por ejemplo una acción del HUD) y regrésala a `idle` cuando termine.

4. **Sincroniza con el servidor**
   - El backend (`server/src/services/worldState.js`) sanitiza el nombre pero no impone un catálogo cerrado, por lo que propagará cualquier cadena. Aun así, asegúrate de que los clientes remotos hayan recibido el atlas que contiene los frames.

5. **Pruebas**
   - Repite las pruebas multijugador con dos ventanas para confirmar que ambos clientes reproducen la animación extra.
   - Observa la consola del navegador y del servidor para detectar avisos de sprites o animaciones no encontradas.

Con estos pasos podrás validar el comportamiento multijugador en local y ampliar el repertorio de animaciones de forma segura.
