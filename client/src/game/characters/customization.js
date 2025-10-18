import { createAstronautTexture, createTextureSwatch } from './proceduralTextures.js';

const HEX_COLOR_REGEX = /^#?[0-9a-f]{3,8}$/i;

const normaliseHex = (value, fallback) => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return fallback;
  }
  if (trimmed.startsWith('#')) {
    return trimmed.length === 4 || trimmed.length === 5
      ? `#${trimmed
          .slice(1)
          .split('')
          .map((char) => `${char}${char}`)
          .join('')}`
      : trimmed.toLowerCase();
  }
  if (trimmed.length === 3 || trimmed.length === 4) {
    return `#${trimmed
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`.toLowerCase();
  }
  return `#${trimmed.toLowerCase()}`;
};

const createTextureDefinition = ({ id, label, description, palette, pattern }) => ({
  id,
  label,
  description,
  palette,
  pattern,
  generator: () => createAstronautTexture({ palette, pattern }),
  swatch: createTextureSwatch(palette, pattern)
});

export const CHARACTER_TEXTURES = Object.freeze({
  'astronaut/classic': createTextureDefinition({
    id: 'astronaut/classic',
    label: 'Traje orbital',
    description: 'Textura base azul utilizada en misiones de observación y soporte.',
    pattern: 'banded',
    palette: {
      suit: '#2b6cb0',
      accent: '#63b3ed',
      helmet: '#f5f5f5',
      visor: '#d7ecff'
    }
  }),
  'astronaut/engineer': createTextureDefinition({
    id: 'astronaut/engineer',
    label: 'Ingeniería táctica',
    description: 'Refuerzos térmicos y señalización de mantenimiento para ingeniería.',
    pattern: 'diagonal',
    palette: {
      suit: '#9b2c2c',
      accent: '#fc8181',
      helmet: '#fdf1e2',
      visor: '#ffe5d4'
    }
  }),
  'astronaut/biologist': createTextureDefinition({
    id: 'astronaut/biologist',
    label: 'Bio-laboratorio',
    description: 'Textura adaptada a laboratorios vivos con tonos verdes y cobre.',
    pattern: 'organic',
    palette: {
      suit: '#276749',
      accent: '#68d391',
      helmet: '#f1f8f5',
      visor: '#d3f8df'
    }
  })
});

const DEFAULT_TEXTURE_ID = 'astronaut/classic';

export const CHARACTER_MESHES = Object.freeze({
  compact: {
    id: 'compact',
    label: 'Compacto',
    description: 'Perfil equilibrado para maniobras rápidas y estaciones orbitales.',
    scale: 1,
    bodyWidth: 1,
    bodyHeight: 1,
    torsoHeight: 1,
    headRadius: 1,
    shadow: 1,
    shadowHeight: 1,
    shadowOffset: 1,
    textureScaleX: 1,
    textureScaleY: 1,
    textureOffsetY: 0
  },
  tall: {
    id: 'tall',
    label: 'Esbelto',
    description: 'Mayor altura para visibilidad en tareas de señalización.',
    scale: 1.05,
    bodyWidth: 0.95,
    bodyHeight: 1.15,
    torsoHeight: 1.1,
    headRadius: 0.9,
    shadow: 1.1,
    shadowHeight: 1.05,
    shadowOffset: 1.05,
    textureScaleX: 1,
    textureScaleY: 1.1,
    textureOffsetY: -0.05
  },
  sturdy: {
    id: 'sturdy',
    label: 'Robusto',
    description: 'Armadura presurizada pensada para mantenimiento externo.',
    scale: 1,
    bodyWidth: 1.15,
    bodyHeight: 1.05,
    torsoHeight: 0.95,
    headRadius: 1.05,
    shadow: 1.2,
    shadowHeight: 1.1,
    shadowOffset: 1.1,
    textureScaleX: 1.05,
    textureScaleY: 1,
    textureOffsetY: 0.02
  }
});

const DEFAULT_MESH_ID = 'compact';

const VISOR_COLORS = Object.freeze([
  '#d7ecff',
  '#ffe5d4',
  '#c9f4ff',
  '#fdf3ff',
  '#f8ffd7'
]);

const ACCENT_COLORS = Object.freeze([
  '#1a202c',
  '#f8f9fa',
  '#2f855a',
  '#9b2c2c',
  '#1f2937'
]);

export const CHARACTER_CUSTOMIZATION_SCHEMA = Object.freeze([
  {
    id: 'texture',
    type: 'texture',
    label: 'Textura del traje',
    description: 'Selecciona el revestimiento exterior del traje espacial.',
    defaultOption: DEFAULT_TEXTURE_ID,
    options: Object.values(CHARACTER_TEXTURES).map((texture) => ({
      id: texture.id,
      label: texture.label,
      description: texture.description,
      preview: texture.palette?.suit ?? '#6b7280'
    }))
  },
  {
    id: 'mesh',
    type: 'mesh',
    label: 'Fisonomía',
    description: 'Ajusta la silueta general y proporciones corporales.',
    defaultOption: DEFAULT_MESH_ID,
    options: Object.values(CHARACTER_MESHES).map((mesh) => ({
      id: mesh.id,
      label: mesh.label,
      description: mesh.description
    }))
  },
  {
    id: 'visorColor',
    type: 'color',
    label: 'Color del visor',
    description: 'Define el filtro lumínico del visor frontal.',
    defaultOption: VISOR_COLORS[0],
    options: VISOR_COLORS.map((color) => ({ id: color, label: color, preview: color }))
  },
  {
    id: 'accentColor',
    type: 'color',
    label: 'Detalles y herrajes',
    description: 'Color para hebillas, juntas y franjas auxiliares.',
    defaultOption: ACCENT_COLORS[0],
    options: ACCENT_COLORS.map((color) => ({ id: color, label: color, preview: color }))
  }
]);

export const DEFAULT_CHARACTER_APPEARANCE = Object.freeze({
  texture: DEFAULT_TEXTURE_ID,
  mesh: DEFAULT_MESH_ID,
  visorColor: VISOR_COLORS[0],
  accentColor: ACCENT_COLORS[0]
});

const LEGACY_TEXTURE_MAP = {
  explorer: 'astronaut/classic',
  pilot: 'astronaut/engineer',
  engineer: 'astronaut/engineer',
  scientist: 'astronaut/biologist'
};

const sanitizeMesh = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_MESH_ID;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_MESH_ID;
  }
  return CHARACTER_MESHES[trimmed] ? trimmed : DEFAULT_MESH_ID;
};

const sanitizeTexture = (value) => {
  if (typeof value !== 'string') {
    return DEFAULT_TEXTURE_ID;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_TEXTURE_ID;
  }
  if (CHARACTER_TEXTURES[trimmed]) {
    return trimmed;
  }
  if (LEGACY_TEXTURE_MAP[trimmed]) {
    return LEGACY_TEXTURE_MAP[trimmed];
  }
  return DEFAULT_TEXTURE_ID;
};

const sanitizeColor = (value, fallback) => normaliseHex(value, fallback);

export const normaliseCharacterAppearance = (candidate) => {
  if (!candidate || typeof candidate !== 'object') {
    return { ...DEFAULT_CHARACTER_APPEARANCE };
  }

  const source = { ...candidate };

  if (source.sprite && !source.texture) {
    source.texture = source.sprite;
  }
  if (source.color && !source.accentColor) {
    source.accentColor = source.color;
  }
  if (source.accent && !source.accentColor) {
    source.accentColor = source.accent;
  }

  const texture = sanitizeTexture(source.texture);
  const mesh = sanitizeMesh(source.mesh);
  const texturePalette = CHARACTER_TEXTURES[texture]?.palette ?? {};
  const accentFallback = texturePalette.accent ?? DEFAULT_CHARACTER_APPEARANCE.accentColor;
  const visorFallback = texturePalette.visor ?? DEFAULT_CHARACTER_APPEARANCE.visorColor;

  return {
    texture,
    mesh,
    visorColor: sanitizeColor(source.visorColor ?? source.visor, visorFallback),
    accentColor: sanitizeColor(source.accentColor, accentFallback)
  };
};

export const listAvailableTextures = () => Object.values(CHARACTER_TEXTURES);
export const listAvailableMeshes = () => Object.values(CHARACTER_MESHES);
export const listAvailableVisorColors = () => [...VISOR_COLORS];
export const listAvailableAccentColors = () => [...ACCENT_COLORS];
