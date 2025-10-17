# Guía rápida para mapas estáticos

Este documento explica cómo crear mapas `.map` compatibles con el cargador estático del servidor y cómo vincularlos con objetos definidos en `.obj`.

## Directorios clave

- `app/maps`: sobrescribe o amplía los mapas incluidos en `server/maps`. Ideal para iterar contenido sin modificar el repositorio base.
- `app/objects`: almacena objetos personalizados que pueden reutilizarse en múltiples mapas. Si un `id` coincide con uno empaquetado, tendrá prioridad la versión local.

## Estructura mínima de un mapa

Un archivo `.map` se divide en secciones:

```text
id: ejemplo
title: Ejemplo didáctico
biome: Comunidad
description: Descripción visible en la UI.
dimensions: 10x10
starting_point: 5x5
border colour: #3f51b5

[tiles]
. = piso; name=Suelo; color=#d7ccc8; transparent=true
# = muro; name=Pared; color=#3e2723; collides=true

[layer ground]
order: 0
##########
#........#
#........#
#........#
#........#
#........#
#........#
#........#
#........#
##########

[objects]
!wall_modern_partition@3x3 | Pared sólida
plant_atrium_totem@6x6 | Decoración vegetal
```

### Secciones más comunes

- **Encabezado:** metadatos básicos y puertas (`door in`/`door out`).
- **`[tiles]`:** define símbolos para cada tipo de terreno y sus propiedades (nombre, color, colisión, transparencia).
- **`[layer ...]`:** describe capas de tiles. Todas las filas deben tener el mismo ancho.
- **`[objects ...]`:** coloca instancias de objetos usando su `id` y coordenadas (`@xxy`). El prefijo `!` marca al objeto como sólido.

## Capas y objetos

Puedes declarar múltiples capas de objetos añadiendo sufijos (`[objects_mobiliario]`, `[objects_calle]`, etc.). Cada capa acepta metadatos opcionales:

```text
[objects_calle]
order: 5
visible: true
plant_atrium_totem@18x8 | Jardinera sur
```

El motor fusiona todas las capas y adjunta la información de visibilidad y orden para que el cliente pueda decidir qué dibujar primero.

## Ejemplos listos para usar

Los mapas añadidos en `app/maps` sirven como referencia:

- **`oficina-vanguardista.map`**: interior con varias capas (`estructura`, `alfombra`, `pasillos`) y objetos de colaboración.
- **`parque-urbano.map`**: paisaje exterior con senderos curvos y vegetación modular.
- **`calle-creativa.map`**: escena urbana que combina ciclovías, mobiliario temporal y escaparates interactivos.

Todos ellos reutilizan los objetos Canvas `wall_modern_partition`, `table_collaborative_island`, `plant_atrium_totem` y `door_glass_arc`. Puedes duplicarlos como punto de partida, ajustar dimensiones y añadir tus propios objetos.

## Flujo recomendado

1. Diseña o reutiliza objetos en `app/objects`. Ejecuta `npm run objects:inspect` (si está definido en tu proyecto) para validar los generadores Canvas.
2. Crea el mapa en `app/maps`, definiendo primero los tiles y las capas principales.
3. Añade las secciones `[objects]` necesarias con los `id` de los objetos.
4. Reinicia el servidor o limpia la caché del cargador (`npm run refresh:static-content`) para publicar los cambios.

Siguiendo estos pasos, puedes construir biomas completos que mezclen interiores, exteriores y zonas urbanas sin tocar el código del cliente.
