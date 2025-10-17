# Motor gráfico isométrico y formato de mapas

Este documento resume la arquitectura del motor gráfico del cliente, cómo se estructuran los mapas y los requisitos de arte para integrarlos en CoMutiNy.

## Componentes principales

- **IsometricEngine** (`client/src/game/isometricEngine.js`): encapsula el canvas 2D, el pipeline de renderizado por tiles y la cámara. Gestiona la interpolación entre frames, dibuja tiles, portales y sprites, y expone `setScene()` para actualizar mapa y entidades.
- **SpriteAnimator** (definido en el mismo archivo): lleva la cuenta de frames por entidad, respetando la velocidad configurada y restableciendo el estado cuando cambia la animación o la dirección.
- **MapViewport** (`client/src/components/MapViewport.jsx`): crea una instancia del motor, alimenta la escena con el mapa activo y sincroniza la posición/animación del jugador local y de los remotos.
- **MapContext** (`client/src/context/MapContext.jsx`): normaliza los mapas desde `MAPS`, calcula tiles bloqueados e interpola movimientos del jugador.
- **WorldContext** (`client/src/context/WorldContext.jsx`): gestiona la conexión Socket.IO, replica el estado del mundo y emite actualizaciones de posición, dirección y animación hacia el servidor (`player:update`).

## Configuración del motor

Al inicializar el motor se puede sobrescribir la configuración por defecto:

```js
const engine = new IsometricEngine(canvas, {
  tileset: { tileWidth: 64, tileHeight: 32 },
  sprites: {
    frameWidth: 48,
    frameHeight: 64,
    framesPerDirection: 4,
    directions: { down: 0, left: 1, right: 2, up: 3 },
    animationSpeed: 120
  },
  camera: { lerpSpeed: 8 }
});
```

- **Tileset**: define el rombo base utilizado para pavimento y resaltado de portales. El motor asume tiles con ratio 2:1 (64×32 por defecto).
- **Sprites**: cada fila del atlas corresponde a una dirección y se recorren `framesPerDirection` columnas para animaciones en bucle. La velocidad se expresa en milisegundos por frame.
- **Cámara**: ajusta la suavidad del seguimiento del jugador.

El motor desactiva el suavizado de imagen para conservar el aspecto pixel-art y reescala automáticamente el canvas en función del `devicePixelRatio`.

## Formato de mapas

Los mapas residen en `client/src/game/maps.js` (y se exportan a `config/maps.json` para herramientas externas). Cada mapa incluye:

| Campo | Descripción |
| --- | --- |
| `id` | Identificador interno único. |
| `name` | Nombre mostrado en la interfaz. |
| `biome` | Bioma o temática, usado en paneles informativos. |
| `description` | Texto descriptivo para el HUD. |
| `size` | Dimensiones en tiles `{ width, height }`. |
| `spawn` | Coordenada `{ x, y }` inicial para el jugador al entrar al mapa. |
| `blockedAreas` | Array de áreas `{ x, y, width, height }` que generan tiles sólidos. |
| `objects` | Elementos interactivos con `position`, `size`, `solid` y un bloque `interaction` (`type`, `title`, `description`). |
| `portals` | Zonas de transición a otros mapas con `from` (área), `targetMap`, `targetPosition` y `description`. |

`MapContext` expande las áreas en listas de tiles para colisiones y `MapViewport` aplica resaltado a portales y objetos. Los mapas se pueden ampliar siguiendo el mismo esquema y el resumen en `docs/maps/world-expansion.md` documenta las zonas disponibles.

## Renderizado de sprites y atlas

- Los sprites del jugador local y remotos pueden provenir del atlas compartido (`spriteAtlas`) o de avatares base dibujados en tiempo real.
- El motor admite cualquier sprite ID registrado en el atlas que emite el backend mediante `sprites:atlasUpdated`. Cada entrada incluye metadatos (`frameWidth`, `frameHeight`, `frames`), que el cliente usa para posicionar los frames dentro del canvas.
- Las animaciones reconocidas por defecto son `idle` y `walk`. Cualquier valor distinto se renderiza como frame estático (`frame = 0`) salvo que se extienda `SpriteAnimator` para definir reglas personalizadas.

Para añadir nuevas animaciones consulta la guía en `docs/testing/multiplayer.md`. Si cambias las dimensiones de los sprites, ajusta también la configuración `sprites` al crear el motor.

## Requisitos de tilesets y sprites

1. **Tileset**
   - Formato PNG sin transparencia premultiplicada.
   - Colores agrupados por caras (superior, lateral iluminada, lateral en sombra) para aprovechar los gradientes aplicados por `drawTile`.
   - Tamaño base 64×32 px. El motor escala proporcionalmente, pero no aplica correcciones de perspectiva si las proporciones cambian.

2. **Sprites**
   - Frames de 48×64 px colocados en horizontal.
   - Hasta cuatro direcciones por defecto (`down`, `left`, `right`, `up`). Se pueden añadir más filas si se amplía la tabla `directions` en la configuración.
   - El atlas debe incluir metadatos con `frameWidth`, `frameHeight`, `frames`, `directions` y `animationSpeed` para sincronizarse con el motor.

3. **Metadatos**
   - Cada sprite registrado en `server/assets/sprites/manifest.json` debe indicar el ID, la ruta del PNG y los datos de animación.
   - El backend normaliza los archivos a PNG y expone el atlas en `GET /assets/sprites/atlas`.

Con estos requisitos los artistas pueden producir tilesets y sprites compatibles sin tocar código, siempre que mantengan el tamaño y las convenciones descritas.
