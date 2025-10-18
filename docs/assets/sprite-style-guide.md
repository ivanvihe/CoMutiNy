# Guía de estilo para sprites de CoMutiNy

Este documento define el estándar visual para personajes, objetos y fondos generados o integrados en el motor isométrico. Complementa el inventario existente y sirve como referencia tanto para artistas como para desarrolladores.

## Proporciones y antropomorfismo

- **Marco base**. Cada frame debe medir `48×64 px`, con el personaje apoyado en la base del frame y el ancla centrada (`{x:0.5, y:1, z:0}`) para asegurar colisiones y alineación homogénea.【F:client/src/game/graphics/spriteStyleExamples.js†L10-L24】
- **Línea de ojos y distribución corporal**. Ubica la línea ocular a 24 px desde la parte superior. Mantén la relación `18%` cabeza, `45%` torso y `37%` extremidades inferiores para conservar silueta humana estilizada.【F:client/src/game/graphics/spriteStyleExamples.js†L16-L28】
- **Direcciones obligatorias**. Todo sprite antropomorfo debe incluir las cuatro direcciones (`down`, `left`, `right`, `up`) y al menos ocho frames para las animaciones `idle` y `walk`. Esto asegura paridad con las pruebas existentes y evita saltos al interpolar animaciones.【F:client/src/game/graphics/spriteStyleExamples.js†L30-L36】

## Paleta cromática y coherencia

- **Tonos de piel**. Usa la gama `#F4D1B0`–`#8C5331` para cubrir diversidad de tonos sin perder contraste en escenarios oscuros.【F:client/src/game/graphics/spriteStyleExamples.js†L41-L42】
- **Cabello y atuendo**. Selecciona colores de `hair` y `outfits` para generar contrastes complementarios entre personajes y fondos urbanos. Los naranjas (`#FF8C42`, `#F9C784`) actúan como acentos limitados para evitar saturación.【F:client/src/game/graphics/spriteStyleExamples.js†L43-L45】
- **Metales y delineados**. Adhiérete a la gama `metals` para accesorios tecnológicos y conserva outlines en `#1B1F23` o `#2C2F33` para compatibilidad con objetos Canvas existentes.【F:client/src/game/graphics/spriteStyleExamples.js†L46-L48】

## Nivel de detalle

- **Sombreado**. Aplica tres capas mínimas (base, sombra suave, resaltado) para preservar volumen sin introducir gradientes que rompan la estética pixel-art estilizada.【F:client/src/game/graphics/spriteStyleExamples.js†L52-L58】
- **Brillos y contornos**. Mantén brillos especulares por debajo de `0.25` de opacidad y contornos de 1 px. Ajusta sombras proyectadas con un desfase de 6 px para alinear con los generadores actuales (`plant_atrium_totem`, `wall_modern_partition`).【F:client/src/game/graphics/spriteStyleExamples.js†L58-L60】【F:app/objects/modern_wall.obj†L38-L66】

## Procedimiento de referencia y validación

1. Genera la configuración inicial con `createStandardHumanoidSpriteConfig()` antes de enviar sprites al `SpriteAnimator`. Esta utilidad rellena metadatos y mantiene la velocidad de animación consistente.【F:client/src/game/graphics/spriteStyleExamples.js†L66-L81】
2. Comprueba el cumplimiento del estándar invocando `isSpriteFollowingStyleGuide(sprite)`. La función valida dimensiones, direcciones, número de capas de sombreado y presencia de colores de contorno aprobados.【F:client/src/game/graphics/spriteStyleExamples.js†L85-L106】
3. Registra las combinaciones de paleta usadas por cada personaje en el inventario para prevenir duplicados y favorecer diversidad.

## Aplicación a objetos y mapas

- Ajusta generadores Canvas existentes para que adopten los colores de `metals` y `outfits`, asegurando que mesas, muros y puertas compartan saturación y contraste con los personajes.【F:client/src/game/graphics/spriteStyleExamples.js†L44-L48】【F:app/objects/collab_table.obj†L40-L73】
- Cuando un objeto requiera silueta antropomorfa (por ejemplo, maniquíes o robots asistentes), reutiliza las proporciones descritas y añade volumen mediante `helpers.setVolume` para mantener coherencia con el motor.【F:app/objects/modern_wall.obj†L24-L55】
- Incluye variantes de vegetación o señalética que respeten el límite de sombreado y el contorno de 1 px para integrarse con el repertorio actual.【F:client/src/game/graphics/spriteStyleExamples.js†L52-L60】【F:app/objects/atrium_plant.obj†L1-L60】

## Próximos pasos sugeridos

- Incorporar los sprites faltantes (`explorer`, `scientist`) al manifest oficial y documentar sus paletas dentro del inventario.【F:docs/assets/sprite-inventory.md†L9-L37】
- Añadir mapas que introduzcan al menos dos objetos nuevos por escenario, aprovechando la guía cromática para diferenciar biomas.【F:docs/assets/sprite-inventory.md†L47-L63】

Con esta guía, cualquier sprite nuevo —ya provenga del pipeline automático o de la edición manual— puede alinearse rápidamente al estándar de CoMutiNy.
