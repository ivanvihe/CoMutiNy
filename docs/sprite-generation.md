# Sprite generation pipeline

La plataforma incluye un pipeline automático para producir sprites compatibles con el motor interactivo a partir de descripciones en texto. El flujo se apoya en el servicio `SpriteGenerationService` del backend (`server/src/sprites/spriteGenerationService.js`) y se consume mediante scripts internos o procesos automatizados.

## Flujo general

1. **Selección del generador**. El backend soporta múltiples estrategias:
   - `procedural`: generador interno de pixel-art simétrico. No requiere dependencias externas.
   - `dall-e`: integración con la API de OpenAI. Requiere configurar `OPENAI_API_KEY`.
   - `stable-diffusion`: integración con Stability AI. Requiere `STABILITY_API_KEY`.

  La lista de generadores disponibles puede consultarse con `spriteGenerationService.listAvailableGenerators()`. Cada entrada indica si el proveedor está disponible en función de las variables de entorno.

2. **Generación**. El método `spriteGenerationService.generateSprite()` acepta una carga como:

   ```json
   {
     "description": "robot explorador con linterna",
     "generator": "procedural",
     "width": 32,
     "height": 32,
     "palette": ["#222222", "#ffcc00", "#5dade2"],
     "name": "Explorador",
     "category": "npc"
   }
   ```

   El servicio contacta con el generador solicitado (o recurre al generador procedimental si el proveedor externo falla), normaliza la imagen y crea los assets de salida.

3. **Normalización**. Todas las imágenes se convierten a PNG con:
   - Dimensiones objetivo (32×32 por defecto o las indicadas en la petición).
   - Paleta cuantizada al conjunto proporcionado o derivada automáticamente.
   - Spritesheets horizontales cuando se especifican múltiples `frames`.

   La lógica reside en `server/src/sprites/normalizer.js`. El pipeline genera metadatos con información de tamaño, paleta y advertencias en caso de fallback.

4. **Persistencia**. Los recursos se guardan en `server/assets/sprites/<slug>/` como `sprite.png` y `metadata.json`. El asset se registra en la base de datos (`sprite_assets`) y se actualiza `server/assets/sprites/manifest.json`.

5. **Atlas y runtime**. Cada nueva generación emite un evento `sprites:atlasUpdated` mediante Socket.IO. El `WorldState` incorpora el atlas y lo expone en el snapshot inicial (`world:state`). El frontend escucha estos eventos (ver `client/src/context/WorldContext.jsx`) y actualiza el atlas compartido, de modo que los sprites recién generados están disponibles sin recargar la aplicación.

## Ejecución desde scripts

Para invocar el generador de manera local puede usarse un script de Node similar a:

```js
import spriteGenerationService from '../server/src/sprites/spriteGenerationService.js'

const main = async () => {
  const result = await spriteGenerationService.generateSprite({
    description: 'robot explorador con linterna',
    generator: 'procedural',
    width: 32,
    height: 32,
    name: 'Explorador',
    category: 'npc'
  })

  console.log('Sprite disponible en:', result.resources)
}

main().catch((error) => {
  console.error('No se pudo generar el sprite:', error)
  process.exitCode = 1
})
```

El script puede ejecutarse con `node --env-file .env.local scripts/generate-sprite.js`, reutilizando las mismas variables que el servidor.

## Consumo del atlas desde herramientas internas

El endpoint público `GET /assets/sprites/atlas` devuelve la instantánea del atlas con la estructura:

```json
{
  "atlas": {
    "version": 3,
    "updatedAt": "2024-06-01T12:34:56.000Z",
    "sprites": [
      {
        "id": "<uuid>",
        "name": "Explorador",
        "category": "npc",
        "imageUrl": "/static/sprites/explorador-1234abcd/sprite.png",
        "metadata": { ... },
        "resources": {
          "image": "/static/sprites/explorador-1234abcd/sprite.png",
          "metadata": "/static/sprites/explorador-1234abcd/metadata.json"
        }
      }
    ],
    "lookup": {
      "<uuid>": { "name": "Explorador", ... }
    }
  }
}
```

Esto permite a herramientas internas o scripts externos sincronizarse con el atlas vigente y descargar los recursos necesarios.

## Sprites animados

El mismo pipeline genera sprites animados siempre que el generador devuelva múltiples frames o que se indique `frames > 1` en la carga útil. El servicio construye un spritesheet horizontal con ayuda de `spriteSheetBuilder` (`server/src/sprites/spriteSheetBuilder.js`), asegurando que todos los frames tienen el mismo tamaño antes de unirlos.

Para producir sprites animados:

1. Establece el número de frames deseado en la petición (`frames`, por ejemplo `8`).
2. Si el proveedor devuelve menos frames de los solicitados, el builder rellenará las columnas restantes reutilizando el último frame válido para mantener la longitud del ciclo.
3. Define `frameWidth` y `frameHeight` en la carga cuando quieras forzar un tamaño específico; de lo contrario se utilizan las dimensiones del primer frame.
4. Opcionalmente añade `metadata.animationSpeed` para controlar la velocidad sugerida por frame (en milisegundos). El cliente se sincroniza con estos valores al hidratar el atlas en `WorldContext`.

Tras la generación, el manifest almacena `frames`, `frameWidth`, `frameHeight` y `animationSpeed`. El frontend detecta estos campos al renderizar sprites y hace avanzar la animación cuando el jugador está en estado `walk`. Para nuevos estados (por ejemplo `emote` o `attack`) debes añadir lógica a `SpriteAnimator` para recorrer los frames y enviar el nombre de animación correspondiente desde el cliente/servidor (consulta [docs/testing/multiplayer.md](testing/multiplayer.md)).

## Variables de entorno

- `OPENAI_API_KEY`: habilita el generador `dall-e`.
- `STABILITY_API_KEY`: habilita el generador `stable-diffusion`.

Sin estas variables, el sistema seguirá funcionando mediante el generador procedimental incorporado.

## Generadores procedimentales en el cliente

El cliente dispone de una librería modular en `client/src/game/graphics/generators/` con los siguientes componentes:

- `ProceduralGenerator`: clase base que provee utilidades para crear y limpiar canvas, gestionar degradados y cachear texturas.
- `WallGenerator`, `FurnitureGenerator`, `PlantGenerator`, `FloorGenerator`, `AvatarGenerator`: implementaciones específicas que generan sprites parametrizables a partir de figuras básicas.

### Dependencias

Estos generadores requieren un entorno con soporte para `document.createElement('canvas')` y el contexto 2D del API de Canvas. En navegadores modernos no es necesario configurar nada adicional. Para renderizados fuera del navegador (por ejemplo, pruebas en Node.js) debe inyectarse una implementación compatible, como el paquete [`canvas`](https://www.npmjs.com/package/canvas).

### Cache de texturas

Cada generador utiliza `ProceduralGenerator` para crear claves únicas basadas en los parámetros y evitar regenerar texturas ya existentes. Si se invoca un método con los mismos argumentos, la librería reutiliza el canvas cacheado en memoria.
