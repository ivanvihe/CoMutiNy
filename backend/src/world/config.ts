export interface TerrainFeatureSettings {
  amplitude: number;
  scale: number;
  octaves: number;
  persistence: number;
  lacunarity: number;
  exponent?: number;
}

export interface PlainsSettings extends TerrainFeatureSettings {}

export interface WaterSettings extends TerrainFeatureSettings {
  baseLevel: number;
}

export interface TerrainLayerSettings {
  surfaceBlock: number;
  soilBlock: number;
  stoneBlock: number;
  waterBlock: number;
  surfaceDepth: number;
  soilDepth: number;
}

export interface TerrainParameters {
  seed: string;
  baseHeight: number;
  features: {
    mountains: TerrainFeatureSettings;
    valleys: TerrainFeatureSettings;
    plains: PlainsSettings;
  };
  water: WaterSettings;
  layers: TerrainLayerSettings;
}

export interface WorldConfig {
  terrain: TerrainParameters;
}

const DEFAULT_TERRAIN_PARAMETERS: TerrainParameters = {
  seed: 'CoMutiNy',
  baseHeight: 52,
  features: {
    mountains: {
      amplitude: 34,
      scale: 210,
      octaves: 4,
      persistence: 0.52,
      lacunarity: 2.1,
      exponent: 1.6,
    },
    valleys: {
      amplitude: 28,
      scale: 160,
      octaves: 4,
      persistence: 0.58,
      lacunarity: 2.05,
      exponent: 1.8,
    },
    plains: {
      amplitude: 12,
      scale: 70,
      octaves: 3,
      persistence: 0.62,
      lacunarity: 1.95,
    },
  },
  water: {
    baseLevel: 58,
    amplitude: 4,
    scale: 95,
    octaves: 2,
    persistence: 0.55,
    lacunarity: 2,
    exponent: 1.2,
  },
  layers: {
    surfaceBlock: 1,
    soilBlock: 2,
    stoneBlock: 3,
    waterBlock: 4,
    surfaceDepth: 1,
    soilDepth: 4,
  },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const sanitizeFeature = (
  defaults: TerrainFeatureSettings,
  override?: Partial<TerrainFeatureSettings>,
): TerrainFeatureSettings => ({
  amplitude: override?.amplitude ?? defaults.amplitude,
  scale: Math.max(1, override?.scale ?? defaults.scale),
  octaves: Math.max(1, Math.floor(override?.octaves ?? defaults.octaves)),
  persistence: clamp(override?.persistence ?? defaults.persistence, 0.1, 0.99),
  lacunarity: Math.max(1, override?.lacunarity ?? defaults.lacunarity),
  exponent: override?.exponent ?? defaults.exponent,
});

const sanitizeWater = (
  defaults: WaterSettings,
  override?: Partial<WaterSettings>,
): WaterSettings => ({
  ...sanitizeFeature(defaults, override),
  baseLevel: override?.baseLevel ?? defaults.baseLevel,
});

const sanitizeLayers = (
  defaults: TerrainLayerSettings,
  override?: Partial<TerrainLayerSettings>,
): TerrainLayerSettings => ({
  surfaceBlock: override?.surfaceBlock ?? defaults.surfaceBlock,
  soilBlock: override?.soilBlock ?? defaults.soilBlock,
  stoneBlock: override?.stoneBlock ?? defaults.stoneBlock,
  waterBlock: override?.waterBlock ?? defaults.waterBlock,
  surfaceDepth: Math.max(1, Math.floor(override?.surfaceDepth ?? defaults.surfaceDepth)),
  soilDepth: Math.max(0, Math.floor(override?.soilDepth ?? defaults.soilDepth)),
});

const sanitizeParameters = (
  overrides?: Partial<TerrainParameters>,
): TerrainParameters => {
  const seed = overrides?.seed && overrides.seed.length > 0
    ? overrides.seed
    : DEFAULT_TERRAIN_PARAMETERS.seed;

  const baseHeight =
    typeof overrides?.baseHeight === 'number'
      ? overrides.baseHeight
      : DEFAULT_TERRAIN_PARAMETERS.baseHeight;

  return {
    seed,
    baseHeight,
    features: {
      mountains: sanitizeFeature(
        DEFAULT_TERRAIN_PARAMETERS.features.mountains,
        overrides?.features?.mountains,
      ),
      valleys: sanitizeFeature(
        DEFAULT_TERRAIN_PARAMETERS.features.valleys,
        overrides?.features?.valleys,
      ),
      plains: sanitizeFeature(
        DEFAULT_TERRAIN_PARAMETERS.features.plains,
        overrides?.features?.plains,
      ),
    },
    water: sanitizeWater(DEFAULT_TERRAIN_PARAMETERS.water, overrides?.water),
    layers: sanitizeLayers(DEFAULT_TERRAIN_PARAMETERS.layers, overrides?.layers),
  };
};

let cachedConfig: WorldConfig | undefined;

const cloneConfig = (config: WorldConfig): WorldConfig => ({
  terrain: {
    ...config.terrain,
    features: {
      mountains: { ...config.terrain.features.mountains },
      valleys: { ...config.terrain.features.valleys },
      plains: { ...config.terrain.features.plains },
    },
    water: { ...config.terrain.water },
    layers: { ...config.terrain.layers },
  },
});

export const createWorldConfig = (): WorldConfig => {
  const seedFromEnv = process.env.WORLD_SEED;
  const terrainOverrides: Partial<TerrainParameters> | undefined = seedFromEnv
    ? { seed: seedFromEnv }
    : undefined;

  return {
    terrain: sanitizeParameters(terrainOverrides),
  };
};

export const getWorldConfig = (): WorldConfig => {
  if (!cachedConfig) {
    cachedConfig = createWorldConfig();
  }
  return cloneConfig(cachedConfig);
};
