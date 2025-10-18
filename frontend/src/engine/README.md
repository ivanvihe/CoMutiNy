# Motor Babylon.js

Este módulo expone la función `initializeEngine` que crea una escena básica de Babylon.js lista para extenderse.

## Opciones de inicialización

```ts
initializeEngine('#canvas-container', {
  antialias: true,
  adaptToDeviceRatio: true,
  backgroundColor: '#101014',
  texture: { type: 'url', url: 'https://textures.example.com/wood.jpg' },
  performance: {
    useHighPrecisionFloats: true,
    hardwareScalingLevel: 1,
  },
  effects: {
    bloom: { enabled: true, threshold: 0.85, weight: 0.2, kernel: 96 },
    ssao2: { enabled: true, ratio: 0.6, totalStrength: 1.2, maxZ: 120 },
    volumetricLightScattering: {
      enabled: true,
      exposure: 0.5,
      decay: 0.95,
      weight: 0.99,
      samples: 120,
    },
  },
});
```

### `texture`

- **URL remota**: `type: 'url'` permite enlazar imágenes alojadas externamente. Los parámetros `invertY`, `hasAlpha` y `samplingMode` ajustan cómo se interpreta la textura.
- **Procedimental**: `type: 'procedural'` genera un ruido fractal animado controlando `size`, `animationSpeedFactor`, `persistence`, `brightness` y `octaves`.

### `effects`

- **Bloom**: parámetros para el umbral de activación (`threshold`), intensidad (`weight`) y tamaño del kernel (`kernel`).
- **SSAO2**: activa o ajusta la oclusión ambiental (`ratio` controla el tamaño del buffer, `totalStrength` la intensidad y `maxZ` el alcance en profundidad).
- **Volumetric light scattering**: controla la exposición de los "god rays" (`exposure`), la atenuación (`decay`), el peso acumulado (`weight`) y el número de muestras (`samples`).

### `performance`

- `useHighPrecisionFloats`: desactívalo en hardware con recursos limitados para ahorrar memoria y ancho de banda.
- `hardwareScalingLevel`: valores mayores a `1` reducen la resolución de renderizado interna, útil en dispositivos móviles.

### Otros ajustes

- `antialias` habilita el suavizado multi-sample del motor.
- `adaptToDeviceRatio` sincroniza el tamaño del canvas con el `devicePixelRatio` actual.
- `backgroundColor` acepta colores CSS o instancias de `Color4`.

La función devuelve un objeto `{ engine, scene, camera, dispose }` para extender la escena o liberarla manualmente.
