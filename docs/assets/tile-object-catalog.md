# Catálogo de tiles y objetos interactivos

Este documento resume los recursos disponibles en los mapas cliente (`client/src/game/maps.js`) y sirve como guía rápida para el equipo de arte y diseño de niveles. Incluye el inventario de tiles, objetos y los requisitos de acabado necesarios para mantener coherencia visual.

## Tiles disponibles

| ID | Símbolo | Colisión | Transparencia | Capas recomendadas | Requisitos de detalle |
| --- | --- | --- | --- | --- | --- |
| `floor` | `.` | No | No | Base | Gradientes suaves y rugosidad ligera para diferenciar planos, sombras hacia el sur.<sup>1</sup> |
| `walkway` | `=` | No | Sí | Capas medias | Reflejos sutiles que comuniquen elevación y juntas visibles cada 0,5 m.<sup>1</sup> |
| `barrier` | `#` | Sí | No | Bordes/colisiones | Textura metálica mate, remaches cada 2 tiles y sombra proyectada corta.<sup>1</sup> |
| `canopy` | `^` | No | Sí | `overlay` | Volúmenes vegetales con transparencias suaves, variaciones de hoja en tres tonos y bordes difuminados.<sup>1</sup> |

<sup>1</sup> Definidos en `server/maps/init.map` dentro de la sección `[tiles]`.

### Reglas generales de tiles

1. **Sombras**: cada tile debe incluir una dirección de luz consistente (noreste) para alinearse con el sombreado del motor isométrico.
2. **Texturas**: evite patrones que se repitan cada 1×1; introduzca variaciones cada 2×2 tiles para reducir el efecto moiré.
3. **Variaciones**: cuando existan assets alternos (p. ej. baldosas desgastadas) documentar el peso porcentual y la capa en la que deben mezclarse.
4. **Capas**: use `mode: overlay` sólo para elementos que deban pasar por encima de jugadores u objetos; combine con `elevation` para ajustar la altura aparente.

## Objetos y prototipos

| ID | Tipo | Colisión | Altura (tiles) | Sprite generator | Notas de QA |
| --- | --- | --- | --- | --- | --- |
| `welcome_terminal` | Mensaje | No | 1.25 | `terminalPanel` | Requiere brillo en pantalla y acentos cian.<sup>2</sup> |
| `community_door` | Mensaje | No | 1.4 | `communityDoor` | Marco metálico oscuro y luz ámbar en panel frontal.<sup>2</sup> |
| `plant_01` | Decorativo | No | 1.6 | `monstera` | Variaciones de hojas en 3 tonos, sombra elíptica suave.<sup>2</sup> |
| `elevated_platform` | Estructura | Sí | 1.6 | `tieredPlatform` | Debe mostrar soportes visibles y resalte en el borde superior.<sup>3</sup> |
| `observation_tower` | Landmark | Sí | 3.4 | `observationTower` | Columnas con gradiente lateral, barandales dobles y focos cálidos.<sup>3</sup> |

<sup>2</sup> Definiciones en `server/objects/definitions/welcome_terminal.obj`, `community_door.obj` y `plant01.obj`.

<sup>3</sup> Prototipos nuevos en `server/objects/definitions/elevated_platform.obj` y `observation_tower.obj`.

### Requisitos de detalle para objetos complejos

- **Sombras**: las plataformas y torres deben registrar una capa `shadow` con opacidad entre 0.28 y 0.32 para comprobar la superposición en `overlay`.
- **Texturas**: aplicar gradientes laterales para reforzar la sensación de volumen; utilice colores de borde más oscuros (`trimColor` / `railingColor`).
- **Variaciones**: documentar al menos dos esquemas de color por objeto (`options.topColor`, `options.bodyColor`) para garantizar diversidad en futuras expansiones.
- **Volúmenes**: especifique `volume.height` acorde a la proyección Z libre. En QA se valida que `maxVolumeHeight` supere los 3 tiles (ver inspección de datos en el canvas).

## Checklist de entrega

1. Añadir el tile u objeto al archivo de definición correspondiente (`server/maps/*.map` o `server/objects/definitions/*.obj`).
2. Registrar el `sprite generator` en `client/src/game/objects/spriteGenerators.js` cuando se trate de un asset nuevo.
3. Documentar variaciones y capas en esta tabla y actualizar los criterios QA en `docs/testing/visual-qa.md`.
