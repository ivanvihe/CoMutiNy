import tilemapConfig from '../../../config/tilemap.json';
import phase3Tileset from '../../../assets/tilesets/phase3.tileset.json';
import { FloorGenerator, WallGenerator } from '../graphics/generators';

type TilePalette = {
  top?: string;
  bottom?: string;
  stroke?: string;
};

type GeneratorSpec = {
  name: 'FloorGenerator' | 'WallGenerator';
  method: string;
  options?: Record<string, unknown>;
};

type NormalisedTileDefinition = {
  id: string;
  tilesetId: string;
  palette: TilePalette | null;
  generator: GeneratorSpec | null;
  transparent: boolean | null;
  collides: boolean | null;
  color: string | null;
  category: string | null;
  metadata: Record<string, unknown>;
  patternSize: { width: number; height: number } | null;
  patternCache: WeakMap<CanvasRenderingContext2D, CanvasPattern>;
};

type TileType = {
  id?: string;
  color?: string | null;
  transparent?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type TilesetRegistry = Map<string, Map<string, NormalisedTileDefinition>>;

type Appearance = {
  palette: TilePalette | null;
  transparent: boolean | null;
  color: string | null;
  pattern: CanvasPattern | null;
  patternSize: { width: number; height: number } | null;
};

const TILESET_DATA: Record<string, unknown> = {
  phase3_structural: phase3Tileset,
  '../assets/tilesets/phase3.tileset.json': phase3Tileset,
  '/tilesheets/phase3.tileset.json': phase3Tileset
};

const parseJSON = <T>(value: unknown): T | null => {
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return null;
  }
};

const normaliseBoolean = (value: unknown, fallback: boolean | null = null): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(trimmed)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(trimmed)) {
      return false;
    }
  }
  return fallback;
};

const toPropertyMap = (
  properties: Array<{ name: string; type?: string; value: unknown }> | undefined
): Map<string, unknown> => {
  if (!Array.isArray(properties)) {
    return new Map();
  }
  return new Map(properties.map((property) => [property.name, property.value]));
};

const createGeneratorSpec = (raw: unknown): GeneratorSpec | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const [name, method] = raw.split('.');
  if (!name || !method) {
    return null;
  }
  if (name !== 'FloorGenerator' && name !== 'WallGenerator') {
    return null;
  }
  return { name, method };
};

const normaliseTileset = (tilesetId: string, raw: any): Map<string, NormalisedTileDefinition> => {
  const tiles = new Map<string, NormalisedTileDefinition>();

  if (!raw || typeof raw !== 'object') {
    return tiles;
  }

  const rawTiles = Array.isArray(raw.tiles) ? raw.tiles : [];
  rawTiles.forEach((tile: any) => {
    const properties = toPropertyMap(tile?.properties);
    const id = (properties.get('phase3:id') as string) || `${tile?.id}`;
    if (!id) {
      return;
    }
    const generator = createGeneratorSpec(properties.get('phase3:generator'));
    const palette = parseJSON<TilePalette>(properties.get('phase3:palette'));
    const options = parseJSON<Record<string, unknown>>(properties.get('phase3:options')) ?? {};
    if (generator) {
      generator.options = options;
    }

    const transparent = normaliseBoolean(properties.get('phase3:transparent'));
    const collides = normaliseBoolean(properties.get('phase3:collides'));
    const colorValue = properties.get('phase3:color');
    const color = typeof colorValue === 'string' ? colorValue : null;
    const categoryValue = properties.get('phase3:category');
    const category = typeof categoryValue === 'string' ? categoryValue : null;

    const definition: NormalisedTileDefinition = {
      id,
      tilesetId,
      palette: palette ?? null,
      generator: generator ?? null,
      transparent,
      collides,
      color,
      category,
      metadata: {},
      patternSize: null,
      patternCache: new WeakMap()
    };

    tiles.set(id, definition);
    tiles.set(`${tile?.id}`, definition);
  });

  return tiles;
};

const buildTilesetRegistry = (): TilesetRegistry => {
  const registry: TilesetRegistry = new Map();
  const tilesets = Array.isArray((tilemapConfig as any)?.tilesets)
    ? (tilemapConfig as any).tilesets
    : [];

  tilesets.forEach((entry: any) => {
    const tilesetId = typeof entry?.id === 'string' ? entry.id : null;
    if (!tilesetId) {
      return;
    }
    const sourceCandidates = [entry.source, entry.publicPath, tilesetId];
    let rawData: unknown = null;
    for (const candidate of sourceCandidates) {
      if (candidate && TILESET_DATA[candidate]) {
        rawData = TILESET_DATA[candidate];
        break;
      }
    }
    if (!rawData) {
      return;
    }
    registry.set(tilesetId, normaliseTileset(tilesetId, rawData));
  });

  if (!registry.has('phase3_structural')) {
    registry.set('phase3_structural', normaliseTileset('phase3_structural', phase3Tileset));
  }

  return registry;
};

export default class TileRenderer {
  private readonly tileWidth: number;

  private readonly tileHeight: number;

  private readonly tilesets: TilesetRegistry;

  private readonly generatorInstances: Record<string, FloorGenerator | WallGenerator>;

  private tileTypeLookup: Map<string, NormalisedTileDefinition>;

  constructor({ tileWidth, tileHeight }: { tileWidth: number; tileHeight: number }) {
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.tilesets = buildTilesetRegistry();
    this.generatorInstances = {
      FloorGenerator: new FloorGenerator({ defaultWidth: tileWidth, defaultHeight: tileHeight }),
      WallGenerator: new WallGenerator({ defaultWidth: tileWidth, defaultHeight: tileHeight })
    };
    this.tileTypeLookup = new Map();
  }

  updateTileTypes(tileTypes: Map<string, TileType>): void {
    this.tileTypeLookup = new Map();
    if (!(tileTypes instanceof Map)) {
      return;
    }

    tileTypes.forEach((tileType, key) => {
      const definition = this.resolveTileDefinition(tileType);
      if (definition) {
        this.tileTypeLookup.set(key, definition);
      }
    });
  }

  private resolveTileDefinition(tileType: TileType): NormalisedTileDefinition | null {
    if (!tileType) {
      return null;
    }

    const metadata = tileType.metadata ?? {};
    const tilesetId =
      typeof metadata.tilesetId === 'string'
        ? metadata.tilesetId
        : typeof metadata.tileset === 'string'
          ? metadata.tileset
          : typeof metadata.tilesetRef === 'string'
            ? metadata.tilesetRef
            : null;

    const tileKey =
      typeof metadata.tilesetTile === 'string'
        ? metadata.tilesetTile
        : typeof metadata.tilesetEntry === 'string'
          ? metadata.tilesetEntry
          : tileType.id ?? null;

    if (!tilesetId || !tileKey) {
      return null;
    }

    const tileset = this.tilesets.get(tilesetId);
    if (!tileset) {
      return null;
    }

    return tileset.get(tileKey) ?? tileset.get(tileType.id ?? '') ?? null;
  }

  private invokeGenerator(spec: GeneratorSpec | null): HTMLCanvasElement | null {
    if (!spec) {
      return null;
    }
    const instance = this.generatorInstances[spec.name];
    if (!instance) {
      return null;
    }
    const method = (instance as any)[spec.method];
    if (typeof method !== 'function') {
      return null;
    }
    const options = {
      width: this.tileWidth,
      height: this.tileHeight,
      ...(spec.options ?? {})
    };
    try {
      return method.call(instance, options);
    } catch (_error) {
      return null;
    }
  }

  private resolvePattern(
    definition: NormalisedTileDefinition,
    ctx: CanvasRenderingContext2D
  ): CanvasPattern | null {
    if (!ctx) {
      return null;
    }
    if (!definition.generator) {
      return null;
    }

    let pattern = definition.patternCache.get(ctx) ?? null;
    if (pattern) {
      return pattern;
    }

    const canvas = this.invokeGenerator(definition.generator);
    if (!canvas) {
      return null;
    }

    pattern = ctx.createPattern(canvas, 'repeat');
    if (pattern) {
      definition.patternSize = { width: canvas.width, height: canvas.height };
      definition.patternCache.set(ctx, pattern);
    }

    return pattern;
  }

  getAppearance(tileType: TileType, ctx: CanvasRenderingContext2D): Appearance | null {
    if (!tileType) {
      return null;
    }
    const key = tileType.id ?? '';
    const definition = this.tileTypeLookup.get(key);
    if (!definition) {
      return null;
    }

    const pattern = this.resolvePattern(definition, ctx);
    return {
      palette: definition.palette,
      transparent: definition.transparent,
      color: definition.color,
      pattern,
      patternSize: definition.patternSize
    };
  }
}
