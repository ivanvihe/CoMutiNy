# Pruebas manuales de renderizado de objetos

Estas comprobaciones aseguran que los objetos decorativos generados mediante Canvas se dibujan en el orden correcto, respetan sus anclas y offsets, y mantienen la escala al hacer zoom.

## Preparación

1. Inicia la aplicación web de CoMutiNy en modo desarrollo (`npm run dev` en la carpeta `client`).
2. Asegúrate de que el servidor entrega los mapas incluidos en `server/maps` y las definiciones base de `server/objects/definitions`.
3. Habilita los atajos de zoom del cliente (rueda del ratón o `Ctrl/Cmd` + `+` / `-`).

## Caso 1: "Hello world" (`init.map`)

1. Carga el mapa inicial `hello_world`.
2. Localiza la pared de ladrillo (`wall_01`) colocada en la columna 10.
3. Verifica que:
   - El sprite se apoya exactamente sobre el suelo; al hacer zoom, permanece alineado sin "flotar" ni cortarse.
   - El ancla responde a los offsets configurados: la pared queda centrada en la baldosa.
4. Encuentra la planta monstera (`plant_01`) en la fila 15 y confirma que:
   - El tallo nace desde el borde inferior del tile y las hojas no se desplazan al alternar entre zoom mínimo y máximo.
   - Al mover la cámara, la planta se mantiene por detrás del avatar del jugador cuando corresponde.

## Caso 2: Sandbox comunitario (`sandbox.map`)

1. Cambia al mapa `sandbox` mediante el menú de navegación.
2. Identifica cualquier instancia adicional de `wall_01` o `plant_01` (hay variaciones con distintos `options`).
3. Comprueba que las versiones duplicadas reutilizan el mismo generador Canvas (p. ej. `createBrickWall`) y respetan las variaciones de color definidas en el backend.
4. Activa y desactiva las capas del editor de mapas (si está disponible) y valida que los objetos desaparecen/aparecen según su capa sin alterar el orden del jugador.

## Validación general

- Desde la consola del navegador ejecuta `window.CoMutiNy.objects.list()` (si la herramienta está habilitada) y verifica que los generadores dinámicos como `createBrickWall` aparecen registrados.
- Guarda capturas de pantalla comparando zoom mínimo y máximo para confirmar que no hay desplazamientos inesperados.
- Informa cualquier discrepancia indicando el mapa, el identificador del objeto y el nivel de zoom donde ocurre.
