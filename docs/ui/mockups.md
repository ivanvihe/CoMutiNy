# Mockups y guías visuales actualizadas

Este documento resume los cambios visuales aplicados al HUD y navegación de mapas. Incluye descripciones textuales para referencia rápida durante la implementación de assets gráficos definitivos.

## Panel contextual del mapa
- **Ubicación**: Sección superior izquierda del `MapViewport`.
- **Contenido**:
  - Nombre del mapa (`Typography` `variant="h6"`).
  - Bioma y etiquetas ambientales representadas mediante `Chip` coloreado.
  - Descripción corta (`Typography` `variant="body2"`).
  - Listado compacto de portales conectados (icono `Launch` + nombre del destino).

```
┌──────────────────────────────┐
│ Puente de mando      [Bioma] │
│ Estado de red: Estable       │
│ "La sala de control..."     │
│ Portales → Camarotes, Vivero │
└──────────────────────────────┘
```

## Panel de misiones
- **Ubicación**: Ficha dedicada en el conjunto de pestañas contextuales.
- **Componentes**:
  - `MissionStatusList` (nuevo componente) que muestra cada misión con título, resumen y un `Chip` de estado (`Disponible`, `En curso`, `Completada`).
  - Botón contextual para centrar la cámara o abrir detalles (placeholder `Ver detalles`).

```
┌──────────────────────────────┐
│ Misiones (3)                 │
├──────────────────────────────┤
│ [Disponible] Reactivar riego │
│     Restablece el flujo...   │
│ [En curso] Calibrar sensores │
│     Ajusta los drones...     │
└──────────────────────────────┘
```

## Registro de eventos
- **Ubicación**: Pestaña `Registro` dentro del panel contextual.
- **Formato**:
  - Lista cronológica inversa con timestamp corto y descripción del hito.
  - Íconos indicativos (`TaskAlt` para completado, `Info` para actualizaciones).

## Navegación entre mapas
- Botones circulares (`IconButton`) con `NavigateBefore` / `NavigateNext` flanquean el selector existente.
- `Tooltip` describe la acción para mejorar accesibilidad.

Estas guías sirven como referencia para futuros assets visuales y para alinear al equipo de diseño con el estado funcional actual.
