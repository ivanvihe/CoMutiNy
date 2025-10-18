# Objetos fase 3

Este directorio agrupa las paletas, guías de tamaño y definiciones JSON que acompañan a los objetos introducidos en la fase 3 del entorno isométrico. Todos los tamaños respetan un tile base de 48×48 px y se alinean con el ancla inferior central del personaje jugador.

## Contenido

- `palettes.json`: paletas cromáticas de referencia para cada objeto.
- `size-guides.json`: resumen de dimensiones en tiles y altura máxima estimada.
- `*.json`: definiciones de objetos listas para ser consumidas por el registro del cliente.

Las definiciones JSON se registran automáticamente desde `client/src/game/objects/definitions.js` y comparten los mismos identificadores que las definiciones del servidor (`server/objects/definitions`).
