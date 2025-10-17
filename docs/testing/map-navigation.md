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
   - Ubicarse en el mapa "Puente de mando".
   - Acercarse a la consola de navegación y pulsar "Interactuar".
   - Validar que aparece un evento con título y descripción del objeto.
3. **Listado de tripulación**
   - Conectar un segundo cliente simulado o usar datos de prueba para fijar un jugador remoto en el mismo mapa.
   - Confirmar que el listado "Tripulación en este sector" muestra nombre y rol del jugador.
4. **Accesibilidad básica**
   - Navegar por los controles de mapa usando `Tab` y comprobar que los `Tooltip` y etiquetas aria describen la acción de cada botón.

## Criterios de aceptación
- Cada mapa muestra información contextual coherente con la definición en `client/src/game/maps.js`.
- La interacción con objetos genera eventos descriptivos sin depender de estados de misión.
- El listado de tripulación refleja los jugadores remotos conectados al mapa activo.
- No se observan errores en consola durante la navegación y las interacciones descritas.
