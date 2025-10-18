# Pipeline de incorporación de assets

Esta guía describe el flujo para añadir nuevos tiles, sprites y objetos al motor isométrico. Sigue los pasos en orden para mantener consistencia y evitar regresiones.

## 1. Diseño y planificación

1. Identifica el propósito del asset (piso, overlay, estructura, interactivo).
2. Define altura objetivo y comportamiento de colisión.
3. Registra la entrada en el [catálogo de tiles y objetos](./tile-object-catalog.md) con requisitos artísticos preliminares.

## 2. Producción de tiles

1. Diseña la textura base a 64×32 px.
2. Añade la entrada en el mapa correspondiente (`server/maps/*.map`) dentro de `[tiles]`, especificando `color`, `collides`, `transparent` y metadatos de sombreado.
3. Para capas superiores usa `mode: overlay` y, si es necesario, agrega `elevation` para compensar la altura virtual (`client/src/game/map/parser.js`).
4. Añade una capa `[layer ...]` con las filas de símbolos. Verifica que todas tengan el mismo ancho.

## 3. Definición de objetos

1. Crea un archivo `.obj` en `server/objects/definitions/` con `id`, `name`, `description` y `metadata` relevantes.
2. Define `appearance` con `generator`, `width`, `height`, `tileSize`, `anchor`, `offset` y `options`.
3. Ajusta `volume.height` y `anchor` para representar la altura física. Este valor se usa en la proyección Z y en el dataset de QA.
4. Documenta `interaction` si el objeto necesita feedback en HUD o broadcast.

## 4. Sprite generators

1. Implementa o reutiliza un generador en `client/src/game/objects/spriteGenerators.js`.
2. Registra capas auxiliares (`helpers.registerLayer`) para sombras, brillos o luces cuando el objeto requiera validar superposiciones.
3. Llama a `helpers.setVolume` para mantener sincronía entre sprite y colisión vertical.

## 5. Integración en mapas

1. Añade el objeto en la sección `[objects]` del mapa con sintaxis `!objectId@xxyy`. El prefijo `!` marca la colisión.
2. Asigna capas opcionales (`[objects nombre]`) para controlar el orden de renderizado.
3. Revisa que `collidableTiles` incluya las posiciones esperadas (el parser lo calcula automáticamente a partir de tiles y objetos sólidos).

## 6. QA y documentación

1. Ejecuta las pruebas E2E (`npx playwright test client/tests/e2e/map-visual.spec.js`) para validar el overlay y las colisiones.
2. Captura una imagen de referencia (canvas) para comparar en regresiones.
3. Actualiza:
   - [docs/assets/tile-object-catalog.md](./tile-object-catalog.md) con nuevas entradas.
   - [docs/testing/visual-qa.md](../testing/visual-qa.md) con criterios adicionales si aplica.
4. Verifica los atributos `data-*` expuestos en el canvas (`MapViewport`) para confirmar conteo de capas, objetos sólidos y altura máxima.

## 7. Publicación

1. Confirma que los assets existen en el repositorio (`git status`).
2. Crea commit con mensaje descriptivo y abre PR siguiendo la plantilla del proyecto.
3. Acompaña la PR con capturas antes/después si el cambio impacta la experiencia visual.
