# Plan de pruebas para navegación y renderizado de mapas

## Pruebas automatizadas
1. `npm run test -- --runTestsByPath src/components/__tests__/MissionStatusList.test.jsx`
   - Verifica que el componente de misiones renderiza los estados correctos.
2. `npm run test -- --runTestsByPath src/context/__tests__/MapContext.test.jsx`
   - Asegura que la lógica de inicialización y actualización de misiones conserva la inmutabilidad del estado.

## Pruebas manuales
1. **Cambio de mapa con botones e ítems del selector**
   - Abrir la aplicación en modo desarrollo (`npm run dev`).
   - Usar los iconos anterior/siguiente y el desplegable para recorrer los mapas.
   - Confirmar que el nombre, bioma y descripción se actualizan en el panel contextual.
2. **Interacción con objetos que actualizan misiones**
   - Ubicarse en el mapa "Vivero Hidropónico".
   - Interactuar con el panel de riego y verificar que el estado de la misión cambia a "Completada" y que se agrega una entrada al registro.
3. **Visualización del registro de eventos**
   - Tras completar al menos una misión, abrir la pestaña "Registro" y validar que aparece la entrada con timestamp.
4. **Sincronización de tripulación remota**
   - Conectar un segundo cliente simulado o usar la vista actual para confirmar que la pestaña "Tripulación" lista a los jugadores remotos presentes en el mapa actual.
5. **Accesibilidad básica**
   - Navegar por los controles de mapa usando `Tab` y comprobar que los `Tooltip` y etiquetas aria describen la acción de cada botón.

## Criterios de aceptación
- Cada mapa muestra información contextual coherente con la definición en `config/maps.json`.
- Las misiones cambian de estado de acuerdo con las interacciones definidas en `client/src/game/maps.js`.
- No se observan errores en consola durante la navegación y las interacciones descritas.
