# Guía de estilo artístico

Esta guía consolida la paleta cromática final de la fase 3 y resume las reglas de escala necesarias para que los sprites e isometrías mantengan consistencia en el motor del cliente. Úsala como referencia rápida al producir nuevos tiles, props o variaciones de color.

## Paleta cromática fase 3

La paleta se divide en cuatro familias: **estructural**, **mobiliario interior**, **vegetación** y **accesorios urbanos**. Los valores hexadecimales provienen de los tiles y generadores de sprites actualmente en producción.

| Familia | Uso principal | Tonos clave |
| --- | --- | --- |
| Estructural | Pisos, muros, puertas y canopias | `#8EB5FF` (piso base), `#A9C8FF` (pasarelas), `#8193B6` (barreras), `#3E7A4D` (canopia), `#9BA6C2` (marcos y puertas) |
| Mobiliario interior | Escritorios, sillas, lámparas | `#D8B394` / `#EFD4B8` (superficies madera), `#4F4032` / `#32261B` (estructura madera), `#5A7DA6` / `#7BA0C8` (tapicería), `#5A4E42` / `#3F3730` (bases metálicas), `#FFE8A3` (brillos cálidos) |
| Vegetación | Plantas de interior y exterior | `#2D6A4F`, `#52B788`, `#95D5B2` (hojas), `#8C6B56` / `#B8926F` (macetas), `#2B5D34`, `#4D8F4C`, `#7CC96F` (follaje exterior) |
| Accesorios urbanos | Fuentes, mobiliario callejero | `#BFC5CE` / `#8D939A` (piedra), `#66BCD3` / `#B5ECFF` (agua), `#7AD7F0` (iluminación) |

**Notas de uso**

1. Mantén los contrastes de valor máximo entre 18 % y 24 % para piezas estructurales; valores superiores rompen la lectura en cámara a 3/4.
2. Los acentos cálidos (`#FFE8A3`) deben limitarse a emisores de luz y reflejos secundarios; evita aplicarlos en superficies mates.
3. Las combinaciones de vegetación interior y exterior comparten verdes base (`#2D6A4F`), pero las variantes exteriores requieren al menos un tono adicional de alta saturación (`#7CC96F`) para destacar en plazas abiertas.

## Reglas de escala

- **Tile base del motor**: el cliente renderiza el mapa a 64 px por tile (`DEFAULT_TILE_SIZE`). Ajusta cualquier asset pensando en ese tamaño final.
- **Generadores y sprites**: los objetos fase 3 están modelados a 32 px por tile para maximizar detalle sin sacrificar nitidez. El motor escala automáticamente `tileSize` a 64 px durante la carga (`scaleFactor = tileSize / baseTileSize`).
- **Sombras y volumen**: al diseñar sprites con generadores Canvas, define sombras y offsets en proporción al `tileSize` base. El motor aplica `setDisplaySize` y `setCullPadding` usando ese factor, por lo que discrepancias de escala rompen la alineación con colisiones.
- **Pruebas visuales**: antes de aprobar un sprite nuevo, comprueba en `npm run dev` que los objetos conservan relaciones de altura coherentes (por ejemplo, sillas a 0.9 tiles y lámparas a 1.6 tiles) y que no existen estiramientos visibles tras el escalado automático.

Con estas pautas la producción de arte mantiene consistencia entre fases, facilitando QA y reduciendo ajustes manuales en mapas existentes.
