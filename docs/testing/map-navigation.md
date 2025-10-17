# Plan de pruebas para navegación y renderizado de mapas

## Pruebas automatizadas
1. `npm run test -- --runTestsByPath src/context/__tests__/MapContext.test.jsx`
   - Verifica la inicialización de mapas, cambio de mapa y generación de eventos al interactuar con objetos.

## Pruebas manuales
1. **Cambio de mapa con botones e ítems del selector**
   - Abrir la aplicación en modo desarrollo (`npm run dev`).
   - Usar los iconos anterior/siguiente y el desplegable para recorrer los mapas.
   - Confirmar que el nombre, bioma y descripción se actualizan en el panel contextual.
2. **Interacción con objetos destacados**
   - Ubicarse en el mapa "Plaza Comunitaria".
   - Acercarse al panel informativo y pulsar "Interactuar".
   - Validar que aparece un evento con título y descripción del objeto.
3. **Listado de presencia**
   - Conectar un segundo cliente simulado o usar datos de prueba para fijar a otra persona remota en el mismo mapa.
   - Confirmar que el listado "Personas en este sector" muestra el alias correspondiente.
4. **Accesibilidad básica**
   - Navegar por los controles de mapa usando `Tab` y comprobar que los `Tooltip` y etiquetas aria describen la acción de cada botón.

## Criterios de aceptación
- Cada mapa muestra información contextual coherente con la definición en `client/src/game/maps.js`.
- La interacción con objetos genera eventos descriptivos sin depender de estados de misión.
- El listado de presencia refleja a las personas remotas conectadas al mapa activo.
- No se observan errores en consola durante la navegación y las interacciones descritas.
