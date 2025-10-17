# Auditoría de componentes de UI

## Alcance
La revisión cubre los componentes del cliente en `client/src/`, con énfasis en las pantallas principales (`App.jsx`), el flujo de autenticación (`components/AuthForm.jsx`), la personalización de avatar (`components/AvatarCustomizer.jsx`) y la experiencia de mapas y HUD (`components/MapViewport.jsx`).

## Hallazgos clave

### Fortalezas
- **Jerarquía visual clara** en la pantalla de bienvenida gracias al uso de `Container`, `Stack` y tipografías destacadas (`App.jsx`).
- **Feedback inmediato** durante el inicio de sesión/registro mediante `Alert` y `CircularProgress` (`AuthForm.jsx`).
- **Personalización accesible** del avatar con controles agrupados por categoría y previsualización en tiempo real (`AvatarCustomizer.jsx`).

### Oportunidades de mejora
1. **Contexto limitado del mapa** (`MapViewport.jsx`)
   - No se muestra la descripción del mapa ni sus biomas, dificultando la orientación.
   - La lista de misiones asociadas al mapa está ausente, lo que obliga a depender de conocimiento externo.
2. **Navegación entre mapas poco visible**
   - El selector desplegable es funcional pero poco descubrible para usuarios novatos.
3. **HUD sin registros de eventos/misiones**
   - Tras interactuar con objetos, los jugadores no tienen un historial persistente que resuma el progreso.
4. **Accesibilidad y localización**
   - Algunos botones repetidos (p. ej. controles de movimiento) carecen de etiquetas aria.

### Recomendaciones
- Añadir paneles contextuales con detalles de bioma, misiones y conexiones del mapa.
- Incorporar controles de navegación más visibles (iconos previo/siguiente y listado persistente).
- Implementar un registro de misiones y eventos que conserve hitos clave.
- Exponer estados de red y presencia de tripulación de forma más destacada.

## Próximos pasos sugeridos
Las recomendaciones anteriores se han priorizado para implementación inmediata dentro de este trabajo, con documentación actualizada y pruebas que verifiquen la nueva navegación y renderizado de mapas.
