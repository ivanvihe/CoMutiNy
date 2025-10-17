# Expansión de mapas y biomas

Este documento resume la nueva hornada de mapas y biomas disponibles en la build actual.

| ID | Nombre | Bioma | Misiones destacadas |
|----|--------|-------|---------------------|
| `bridge` | Puente de mando | Comando | "Reconfigurar el rumbo", "Diagnosticar sensores" |
| `quarters` | Camarotes | Habitacional | "Organizar inventario", "Coordinar turnos" |
| `hydroponics` | Vivero Hidropónico | Biológico | "Reactivar riego", "Calibrar drones" |
| `engine-bay` | Bahía de motores | Industrial | "Purga de plasma", "Reinicio de núcleo" |
| `asteroid-research` | Laboratorio de asteroides | Exoplanetario | "Cartografiar bioma", "Extraer muestras" |

Cada misión tiene soporte para estados `available`, `in-progress` y `completed`, visibles desde el HUD actualizado. Las definiciones completas pueden consultarse en `client/src/game/maps.js` y el resumen para sincronización externa en `config/maps.json`.
