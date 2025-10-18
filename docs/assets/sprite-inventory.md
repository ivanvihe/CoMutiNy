# Inventario de sprites actuales

Este inventario resume los sprites definidos explícitamente en el repositorio y ayuda a detectar inconsistencias previas a la adopción del nuevo estándar gráfico.

## Personajes y entidades jugables

| Identificador | Fuente | Tipo | Observaciones |
| --- | --- | --- | --- |
| `Explorer Base` | `server/src/database/seeders/20241004130000-seed-sprite-assets.js` | Atlas remoto (`https://example.com/sprites/explorer.png`) | Único asset de personaje sembrado en base de datos. Metadatos incompletos: solo se declaran `theme` y `frames`, faltan proporciones exactas, direcciones o paleta. |
| `explorer` | `server/test/sessionManager.test.js` | Referencia de runtime | Usado en pruebas unitarias para jugadores pero no aparece en el manifest ni en los seeders. |
| `scientist` | `server/test/sessionManager.test.js` | Referencia de runtime | Igual que `explorer`, carece de definición de asset o metadatos asociados. |

**Inconsistencias detectadas**

- El manifest `server/assets/sprites/manifest.json` no registra sprites, por lo que el atlas que consume el cliente quedaría vacío al iniciar el sistema.【F:server/assets/sprites/manifest.json†L1-L5】
- Las pruebas se apoyan en identificadores (`explorer`, `scientist`) inexistentes en los seeders o en el manifest, generando riesgo de referencias rotas cuando se ejecute el servidor real.【F:server/test/sessionManager.test.js†L17-L63】

## Objetos decorativos y mobiliario

| ID | Archivo | Dimensiones declaradas | Paleta destacada | Notas |
| --- | --- | --- | --- | --- |
| `plant_atrium_totem` | `app/objects/atrium_plant.obj` | `width:1`, `height:2`, `tileSize:32` | Verdes (`#66BB6A`, `#43A047`, `#81C784`) con maceta café (`#6D4C41` – `#8D6E63`) y acento cálido (`rgba(255, 235, 59, 0.6)`) | Generador Canvas interno. Define ancla `{x:0.5,y:1}` sin volumen explícito. 【F:app/objects/atrium_plant.obj†L1-L60】 |
| `table_collaborative_island` | `app/objects/collab_table.obj` | `width:2`, `height:1`, `tileSize:32` | Maderas anaranjadas (`#FFE0B2`–`#FFB74D`), metales fríos (`#B0BEC5`–`#78909C`) | No registra capas auxiliares; iluminación especular simplificada. 【F:app/objects/collab_table.obj†L1-L75】 |
| `door_glass_arc` | `app/objects/glass_door.obj` | `width:1`, `height:2`, `tileSize:32` | Estructura gris oscura (`#212121`–`#484848`), vidrio cian translúcido | Sin capas auxiliares; requiere definir volumen para colisiones verticales. 【F:app/objects/glass_door.obj†L1-L89】 |
| `wall_modern_partition` | `app/objects/modern_wall.obj` | `width:1`, `height:1`, `tileSize:32`, `scale:{x:2,y:1.1}` | Azules grisáceos (`#37474F`, `#90A4AE`) con luces puntuales | Registra sombra auxiliar y ajusta volumen vía `helpers.setVolume`. 【F:app/objects/modern_wall.obj†L1-L74】 |

## Mapas

Los tres mapas de la carpeta `app/maps/` comparten las mismas referencias de objetos y puertas. No existen sprites de terreno externos; toda la apariencia se controla mediante tiles declarados inline.

| Mapa | Objetos con sprite/generador | Comentarios |
| --- | --- | --- |
| `calle-creativa` | `wall_modern_partition`, `door_glass_arc`, `table_collaborative_island`, `plant_atrium_totem` | Incluye puertas enlazadas a `comunidad-inicial`, pero este destino no está presente en el repositorio, lo que sugiere dependencia externa. 【F:app/maps/calle-creativa.map†L75-L86】 |
| `oficina-vanguardista` | `wall_modern_partition`, `door_glass_arc`, `table_collaborative_island`, `plant_atrium_totem` | Repite repertorio; faltan variaciones para mobiliario ligero o señalética. 【F:app/maps/oficina-vanguardista.map†L75-L84】 |
| `parque-urbano` | `wall_modern_partition`, `door_glass_arc`, `table_collaborative_island`, `plant_atrium_totem` | Igual repertorio; resalta ausencia de sprites orgánicos específicos del parque. 【F:app/maps/parque-urbano.map†L81-L90】 |

## Resumen de hallazgos

1. Solo existe un asset de personaje sembrado y no se ha incorporado al manifest del runtime.
2. Los objetos usan generadores Canvas con estilos dispares; comparten tileSize `32`, distinto del estándar documentado (`48×64 px` por frame) para personajes.【F:README.md†L45-L49】
3. Las referencias `explorer` y `scientist` carecen de definición formal, lo que impide validar antropomorfismo o consistencia cromática.
4. No hay sprites específicos para los mapas; se reutilizan los mismos cuatro objetos en todos los escenarios.

Este inventario servirá como línea base para la actualización estilística y para validar que los nuevos estándares cubran todas las categorías de asset.
