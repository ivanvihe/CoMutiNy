# Auditoría de componentes de UI

## Alcance
La revisión cubre los componentes del cliente en `client/src/`, con énfasis en las pantallas principales (`App.jsx`), el flujo de autenticación (`components/AuthForm.jsx`), la personalización de avatar (`components/AvatarCustomizer.jsx`) y la experiencia de mapas y HUD (`components/MapViewport.jsx`).

## Hallazgos clave

### Fortalezas
- **Jerarquía visual clara** en la pantalla de bienvenida gracias al uso de `Container`, `Stack` y tipografías destacadas (`App.jsx`).
- **Feedback inmediato** durante el inicio de sesión/registro mediante `Alert` y `CircularProgress` (`AuthForm.jsx`).
- **Personalización accesible** del avatar con controles agrupados por categoría y previsualización en tiempo real (`AvatarCustomizer.jsx`).
- **Mapa orientado a la colaboración** con resumen contextual, chips de portales, estado de red y listado de tripulación remota (`MapViewport.jsx`).

### Oportunidades de mejora
1. **Descubrir objetos interactivos** (`MapViewport.jsx`)
   - Aunque el panel informa la proximidad, sería útil resaltar visualmente los objetos interactivos dentro de la cuadrícula.
2. **Navegación entre mapas más visible**
   - El selector desplegable es funcional pero poco descubrible para usuarios novatos.
3. **Eventos efímeros**
   - Los eventos mostrados tras una interacción desaparecen al cerrar el panel; podría evaluarse un historial ligero si se requiere auditoría de acciones.
4. **Accesibilidad y localización**
   - Algunos botones repetidos (p. ej. controles de movimiento) carecen de etiquetas aria.

### Recomendaciones
- Añadir indicadores visuales (p. ej. borde animado) sobre objetos interactivos en la cuadrícula.
- Incorporar controles de navegación más visibles (iconos previo/siguiente y listado persistente).
- Evaluar la incorporación opcional de un historial compacto de eventos si los equipos de juego lo solicitan.
- Exponer estados de red y presencia de tripulación de forma más destacada (p. ej. iconografía adicional) conforme se refinen los assets.

## Próximos pasos sugeridos
Las recomendaciones anteriores se han priorizado para implementación inmediata dentro de este trabajo, con documentación actualizada y pruebas que verifiquen la nueva navegación y renderizado de mapas.
