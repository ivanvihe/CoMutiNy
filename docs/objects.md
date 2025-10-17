# Formato de definiciones `.obj`

Las definiciones de objetos describen cómo se renderizan y comportan los elementos decorativos que aparecen en el mundo. Los archivos se cargan automáticamente desde el directorio `/app/objects` (o sus rutas alternativas configuradas) y deben tener la extensión `.obj`.

Cada archivo puede contener:

- **JSON plano** con la estructura del objeto.
- **Módulos JavaScript** que exporten un objeto serializable (`export default {...}`) o una función que devuelva dicho objeto.

Durante la carga, el servidor valida la definición, normaliza sus valores y ejecuta cualquier función de `generator` que se incluya para comprobar que puede operar con un contexto de Canvas 2D. La respuesta enviada al cliente es completamente serializable e incluye metadatos de apariencia como el identificador del generador, el tamaño del sprite y las opciones disponibles.

## Campos principales

| Campo               | Descripción |
|---------------------|-------------|
| `id`                | Identificador único del objeto. |
| `name`              | Nombre legible que se mostrará en la interfaz. |
| `description`       | Texto opcional para describir el objeto. |
| `appearance`        | Configuración visual. Debe incluir un `generator` (cadena o función), además de `width`, `height`, `tileSize`, `anchor`, `offset`, `scale` y `options`. |
| `metadata`          | Información adicional opcional (tags, categoría, etc.). |
| `interaction`/`behavior` | Opcionales. El cargador las mantiene sin modificar si están presentes. |

### Apariencia

La sección `appearance` controla cómo debe dibujarse el objeto:

- `generator`: nombre del generador Canvas en el cliente o una función de dibujo. Si se exporta una función, el servidor la ejecuta con un contexto simulado para asegurarse de que no produce errores, y envía al cliente su nombre y código fuente (`generatorSource`).
- `width` y `height`: tamaño del objeto en tiles.
- `tileSize`: tamaño del tile en píxeles utilizado por el generador.
- `anchor`, `offset` y `scale`: valores opcionales para ajustar el renderizado.
- `options`: objeto serializable con parámetros específicos para el generador.

## Ejemplos

### Pared de ladrillo (`brickWall`)

```json
{
  "id": "wall_bricks",
  "name": "Pared de ladrillos",
  "description": "Un tramo de pared de ladrillos cálidos.",
  "appearance": {
    "generator": "brickWall",
    "width": 1,
    "height": 1,
    "tileSize": 16,
    "anchor": { "x": 0.5, "y": 1 },
    "offset": { "x": 0, "y": 0 },
    "scale": { "x": 1, "y": 1 },
    "options": {
      "colors": ["#8B4513", "#A0522D", "#9B5523", "#8A4513"],
      "strokeColor": "#5D3A1A"
    }
  },
  "metadata": {
    "tags": ["decorative", "wall"]
  }
}
```

### Planta monstera (`monstera`)

```json
{
  "id": "plant_monstera",
  "name": "Planta monstera",
  "description": "Una monstera exuberante que aporta frescura al espacio.",
  "appearance": {
    "generator": "monstera",
    "width": 1,
    "height": 2,
    "tileSize": 32,
    "anchor": { "x": 0.5, "y": 1 },
    "options": {
      "stemColor": "#2d5016",
      "leafColor": "#3a7d2c",
      "darkLeaf": "#2d6022"
    }
  },
  "metadata": {
    "tags": ["decorative", "plant"]
  }
}
```

### Puerta comunitaria (`communityDoor`)

```json
{
  "id": "community_door",
  "name": "Acceso comunitario",
  "description": "Una puerta simbólica que invita a explorar nuevos espacios.",
  "appearance": {
    "generator": "communityDoor",
    "width": 1,
    "height": 2,
    "tileSize": 32,
    "anchor": { "x": 0.5, "y": 1 },
    "offset": { "x": 0, "y": -0.15 },
    "scale": { "x": 1, "y": 1.2 },
    "options": {
      "frameColor": "#263238",
      "panelColor": "#455a64",
      "accentColor": "#ffca28"
    }
  },
  "interaction": {
    "type": "message",
    "title": "Puerta comunitaria",
    "description": "Por ahora la puerta está cerrada, pero pronto conectará con nuevas aventuras."
  },
  "metadata": {
    "tags": ["decorative", "door"]
  }
}
```

## Consejos adicionales

- Mantén las opciones (`options`) libres de funciones u objetos no serializables; el cargador eliminará los valores que no puedan convertirse a JSON.
- Si necesitas definir la apariencia mediante código, exporta una función desde el archivo `.obj`. El servidor ejecutará la función con un contexto Canvas simulado y enviará el nombre y el código fuente para que los clientes puedan inspeccionarlo.
- Cuando existan archivos con el mismo `id`, las definiciones ubicadas en `/app/objects` prevalecen sobre las incluidas en el repositorio base.
- Puedes revisar ejemplos de objetos con generadores Canvas en `app/objects/*.obj`. Las nuevas incorporaciones `wall_modern_partition`, `table_collaborative_island`, `plant_atrium_totem` y `door_glass_arc` muestran cómo emplear gradientes, transparencias y geometrías complejas sin depender de sprites pre-renderizados.

## Relación con mapas estáticos

Los mapas estáticos definidos en archivos `.map` referencian los objetos mediante su `id`. Al colocar una entrada como `!wall_modern_partition@6x6`, el motor buscará primero en `/app/objects` y, si no lo encuentra allí, continuará con los catálogos empacados en el servidor. Esto permite iterar sobre prototipos locales sin tocar el código fuente.

1. Crea o actualiza la definición del objeto en `/app/objects`. Si necesitas lógica de dibujo personalizada, exporta una función que reciba `(ctx, { width, height, tileSize, pixelWidth, pixelHeight })`.
2. Añade el objeto al mapa deseado en `/app/maps`, indicando su posición `x`/`y` y, opcionalmente, el prefijo `!` si debe considerarse sólido.
3. Reinicia el servidor o ejecuta `npm run refresh:static-content` (si está disponible en tu entorno) para que el cargador reindexe tanto mapas como objetos.

Los nuevos mapas `oficina-vanguardista`, `parque-urbano` y `calle-creativa` demuestran este flujo completo: cada uno reutiliza las definiciones anteriores para crear escenas coherentes en interiores, exteriores y calles urbanas.

## Funciones Canvas dinámicas

El backend puede adjuntar funciones Canvas adicionales junto con cada definición de objeto. Estas funciones se envían como texto (`generatorSource`) o como literales serializados en colecciones como `canvasDefinitions`, `canvasGenerators` o `spriteGenerators`. El cliente registra automáticamente cada función y las expone bajo el nombre proporcionado (`createBrickWall`, `createGardenPlant`, etc.), de modo que los mapas y objetos pueden utilizarlas sin requerir una actualización del código fuente. Esta sincronización también es compatible con los generadores empacados en la respuesta de `/maps/static`.
