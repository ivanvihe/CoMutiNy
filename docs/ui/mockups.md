# Mockups y guías visuales actualizadas

Este documento resume los cambios visuales aplicados al HUD y navegación de mapas. Incluye descripciones textuales para referencia rápida durante la implementación de assets gráficos definitivos.

## Panel contextual del mapa
- **Ubicación**: Sección superior izquierda del `MapViewport`.
- **Contenido**:
  - Nombre del mapa (`Typography` `variant="h6"`).
  - Bioma y etiquetas ambientales representadas mediante `Chip` coloreado.
  - Descripción corta (`Typography` `variant="body2"`).
  - Chips de portales conectados (icono `TravelExplore` + nombre del destino).
  - Estado de red actual mostrado como `Chip` compacto.

```
┌────────────────────────────────────┐
│ Plaza central          [Entorno]   │
│ Estado de red: Conectado           │
│ "Espacio para encuentros..."      │
│ Portales → Taller | Invernadero    │
└────────────────────────────────────┘
```

## Indicadores de interacción
- Presentados inmediatamente debajo del resumen del mapa.
- Mensaje dinámico (`Typography` `variant="body2"`) indica si existe un objeto cercano con el que interactuar.
- Segundo renglón resalta el número de compañeros presentes en el mapa actual.

```
┌─────────────────────────────┐
│ Objeto cercano: Panel común │
│ Personas en este mapa: 2    │
└─────────────────────────────┘
```

## Presencia visible en el mapa
- Lista densa (`List` + `ListItemText`) que aparece tras un `Divider`.
- Cada entrada muestra el nombre reportado en la metadata del jugador remoto.
- Mensaje vacío comunica que aún no hay participación remota conectada.

```
┌──────────────────────────────┐
│ Personas en este sector      │
├──────────────────────────────┤
│ Vega                       │
│ Noor                       │
└──────────────────────────────┘
```

## Navegación entre mapas
- Botones circulares (`IconButton`) con `NavigateBefore` / `NavigateNext` flanquean el selector existente.
- `Tooltip` describe la acción para mejorar accesibilidad.

Estas guías sirven como referencia para futuros assets visuales y para alinear al equipo de diseño con el estado funcional actual del visor de mapas centrado en exploración compartida.
