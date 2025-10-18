/**
 * Referencias autocontenidas para aplicar el nuevo estándar gráfico a personajes y props.
 *
 * Los valores de proporción y paleta se inspiran en el documento de requisitos técnicos
 * del motor isométrico y permiten validar sprites generados automáticamente o por artistas.
 */

export const STANDARD_SPRITE_PROPORTIONS = Object.freeze({
  /**
   * Cada frame ocupa 48×64 px siguiendo la guía del motor. El personaje queda centrado en x
   * y apoyado en la base del frame para alinear correctamente las colisiones.
   */
  frameWidth: 48,
  frameHeight: 64,
  /**
   * Altura efectiva en tiles (64 px) y la línea de ojos situada a 24 px desde la parte superior
   * para preservar antropomorfismo en vista isométrica.
   */
  eyeLinePx: 24,
  baseAnchor: { x: 0.5, y: 1, z: 0 },
  /**
   * Distribución porcentual del cuerpo respecto a la altura disponible. Mantiene silueta humana
   * estilizada sin perder proporciones naturales.
   */
  bodySegments: {
    head: 0.18,
    torso: 0.45,
    legs: 0.37
  },
  /**
   * Las direcciones soportadas por defecto; se espera animación `idle` y `walk` para cada una.
   */
  directions: ['down', 'left', 'right', 'up'],
  /**
   * Número mínimo de frames por animación base; sincronizado con seeds y pruebas actuales.
   */
  baseFrames: 8
});

export const STANDARD_COLOR_PALETTE = Object.freeze({
  /** Paleta de piel con subtonos cálidos y fríos para variedad cultural. */
  skin: ['#F4D1B0', '#DFA37A', '#B97856', '#8C5331'],
  /** Cabello con valores que mantienen contraste suficiente sobre fondos urbanos. */
  hair: ['#1B1B21', '#4B2E1F', '#915129', '#C6883A', '#D8C2AA'],
  /** Textiles y acentos pensados para escenarios tecnológicos sin saturar. */
  outfits: ['#1F3C88', '#476D9A', '#8AC6D0', '#FF8C42', '#F9C784'],
  /** Elementos metálicos y accesorios con compatibilidad con objetos existentes. */
  metals: ['#2F3C4F', '#55697D', '#90A4AE', '#C0CAD6'],
  /** Colores neutros recomendados para sombras y delineado. */
  outlines: ['#1B1F23', '#2C2F33']
});

export const STANDARD_DETAIL_LEVEL = Object.freeze({
  /**
   * Mínimo de capas de sombreado: base + sombra suave + resaltado. Evita gradientes complejos
   * que rompan la legibilidad en tamaños pequeños.
   */
  shadingLayers: 3,
  /** Opacidad sugerida para brillos especulares en ropa o accesorios. */
  highlightOpacity: 0.25,
  /** Grosor de contorno en píxeles; la línea se atenúa en sprites menores para evitar halos. */
  outlineWidthPx: 1,
  /** Desfase vertical para sombras proyectadas compatible con generadores Canvas existentes. */
  shadowOffsetPx: 6
});

/**
 * Genera la configuración base que puede reutilizarse al definir nuevos sprites en tiempo real
 * o al normalizar recursos importados del pipeline automático.
 */
export const createStandardHumanoidSpriteConfig = (overrides = {}) => ({
  ...STANDARD_SPRITE_PROPORTIONS,
  ...overrides,
  /**
   * Se normaliza la metadata para el animator del motor (`SpriteAnimator`).
   */
  metadata: {
    frameWidth: overrides.frameWidth ?? STANDARD_SPRITE_PROPORTIONS.frameWidth,
    frameHeight: overrides.frameHeight ?? STANDARD_SPRITE_PROPORTIONS.frameHeight,
    frames: overrides.frames ?? STANDARD_SPRITE_PROPORTIONS.baseFrames,
    directions: overrides.directions ?? STANDARD_SPRITE_PROPORTIONS.directions,
    animationSpeed: overrides.animationSpeed ?? 0.12
  }
});

/**
 * Ejemplo de validación rápida: comprueba si un sprite cumple con la altura mínima antropomórfica
 * y con el número de capas exigido para luces/sombras.
 */
export const isSpriteFollowingStyleGuide = (sprite) => {
  if (!sprite?.metadata) {
    return false;
  }

  const { metadata, palette, shading } = sprite;
  const frameHeight = Number(metadata.frameHeight) || 0;
  const frameWidth = Number(metadata.frameWidth) || 0;

  if (frameHeight < STANDARD_SPRITE_PROPORTIONS.frameHeight || frameWidth < STANDARD_SPRITE_PROPORTIONS.frameWidth) {
    return false;
  }

  if (!Array.isArray(metadata.directions) || metadata.directions.length < STANDARD_SPRITE_PROPORTIONS.directions.length) {
    return false;
  }

  const layerCount = Number(shading?.layers ?? shading?.layerCount);
  if (!Number.isFinite(layerCount) || layerCount < STANDARD_DETAIL_LEVEL.shadingLayers) {
    return false;
  }

  const hasOutlineColor = Array.isArray(palette?.outlines)
    ? palette.outlines.some((color) => STANDARD_COLOR_PALETTE.outlines.includes(color))
    : false;

  return hasOutlineColor;
};
