# Auditoría de tiles phase 3

Durante la revisión del directorio `client/assets/tilesets` no se encontraron atlas vigentes. Los mapas existentes dependían de definiciones textuales (`[tiles]`) heredadas sin respaldo gráfico unificado.

## Reemplazos propuestos

| Categoría | Identificador legacy | Sustitución phase 3 | Notas |
| --- | --- | --- | --- |
| Suelo base | `floor` (color único) | `floor` generador modular | Textura procedural con variación sutil y encaje en rejilla de 64×64. |
| Pasarela | `walkway` (derivado de `floor`) | `walkway` con baldosas retroiluminadas | Realza recorridos principales con brillo diagonal. |
| Barrera | `barrier` (color plano) | `barrier` modular con paneles metálicos | Compatibilidad con colisiones y capas elevadas. |
| Cobertura vegetal | `canopy` (verde plano) | `canopy` con follaje procedural | Permite transparencias suaves para capas overlay. |
| --- | --- | --- | --- |
| Nueva pared | — | `wall_window` | Muro con ventanal panorámico modular. |
| Nueva puerta | — | `door` | Acceso de doble hoja con iluminación inferior. |

Los nuevos tiles se generan a partir de los generadores `FloorGenerator` y `WallGenerator`, evitando la incorporación de recursos binarios y garantizando reproducibilidad.
