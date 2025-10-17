# Formato de mapas de CoMutiNy

Esta guía describe el formato textual `.map` utilizado por CoMutiNy y las nuevas
capacidades para definir capas de tiles con propiedades avanzadas. El objetivo
es facilitar la construcción de escenarios complejos tanto para el servidor
como para el cliente.

## Secciones principales

Un archivo `.map` está dividido en secciones identificadas por cabeceras entre
corchetes (`[seccion]`). Las secciones disponibles son:

- `meta`: metadatos del mapa (nombre, dimensiones, puertas, etc.).
- `objects`: listado de objetos interactivos o decorativos embebidos.
- `tiles`: definición de tipos de tile reutilizables.
- `layer ...`: una o varias capas de tiles que referencian los tipos definidos
  previamente. El nombre de la capa se toma del texto tras `layer`.

Las secciones `meta` y `objects` conservan el mismo comportamiento que antes.
Las nuevas secciones `tiles` y `layer` son opcionales, pero altamente
recomendadas. Si no se proporcionan, el motor generará una capa de suelo
predeterminada.

## Definición de tiles (`[tiles]`)

Cada línea dentro de la sección `tiles` asigna un símbolo a un identificador de
mosaico y sus propiedades, usando la sintaxis:

```
SIMBOLO = tileId; clave=valor; ...
```

Ejemplo:

```
. = floor; name=Suelo; transparent=true; color=#9db4ff
# = wall; name=Pared de ladrillo; collides=true; transparent=false; color=#7f4c3f
W = window; name=Ventana; collides=true; transparent=true; color=#cfd8ff
```

Propiedades disponibles:

- `name` / `label`: nombre descriptivo.
- `collides` / `solid` / `collision`: marca el tile como bloqueante.
- `transparent`: indica si debe renderizarse con opacidad reducida.
- `color` o `colour`: color base en formato hexadecimal (`#RRGGBB`).
- Cualquier otra clave se conserva como metadato adicional.

Los símbolos definidos pueden reutilizarse en las capas. Si se desea dejar un
espacio vacío dentro de una capa, se puede usar `none`, `empty`, `void` o un
valor en blanco.

## Capas (`[layer ...]`)

Cada sección que comience con `layer` define una capa de tiles. El nombre de la
sección determina el identificador de la capa (`[layer piso]` → `piso`). Dentro
de la sección se pueden combinar líneas de configuración (`clave: valor`) y
filas de tiles.

Ejemplo completo:

```
[layer piso]
name: Suelo interior
order: 0
visible: true
....####
....####
....####

[layer decoracion]
order: 1
. . . .
. W . .
. . . .
```

- Las filas pueden escribirse sin espacios (`....####`) o separando símbolos con
  espacios (`. W . .`).
- Todas las filas de una capa deben tener el mismo ancho.
- Las capas se renderizan siguiendo la propiedad `order` (menor a mayor). Si se
  omite, se usa el orden de aparición.
- `visible: false` permite preparar capas alternativas sin mostrarlas.

## Colisiones y lógica del servidor

El motor de carga calcula automáticamente los tiles bloqueantes combinando:

1. La lista `collidableTiles` derivada de las capas y sus tipos de tile.
2. Las áreas bloqueadas automáticas (bordes del mapa).
3. Objetos sólidos definidos en la sección `objects`.

El nuevo módulo `server/world/physics.py` expone `PhysicsEngine`, encargado de
resolver si una coordenada es transitable. Esto facilita comprobar colisiones
sin duplicar reglas.

## Renderizado del cliente

El motor isométrico (`client/src/game/isometricEngine.js`) interpreta las capas
y dibuja cada tile utilizando el color declarado en su definición. Los tiles
transparentes se renderizan con opacidad reducida y los tiles bloqueantes
muestran una superposición roja. Los marcadores de portal, objetos y bordes se
mantienen mediante superposiciones semitransparentes.

## Consejos para crear mapas

- Define siempre al menos una capa base (`order: 0`) que cubra el área jugable.
- Utiliza capas adicionales para elementos decorativos o techos que deban
  representarse encima de los jugadores.
- Combina objetos sólidos (`!identificador`) con tiles bloqueantes para evitar
  inconsistencias entre el render y la lógica del servidor.
- Mantén la coherencia de colores reutilizando los mismos tonos para tiles
  similares; el parámetro `color` se encarga del sombreado automáticamente.
- Si necesitas dejar celdas vacías en una capa superior, usa `none` o `empty`.

Con estas herramientas, mapear nuevas zonas se vuelve más expresivo y mantiene
la paridad entre servidor y cliente.
