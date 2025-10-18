import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { VolumetricLightScatteringPostProcess } from '@babylonjs/core/PostProcesses/volumetricLightScatteringPostProcess';
import { Engine } from '@babylonjs/core/Engines/engine';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { NoiseProceduralTexture } from '@babylonjs/core/Materials/Textures/Procedurals/noiseProceduralTexture';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import {
  createDayNightEnvironment,
  type DayNightEnvironment,
} from './environment';

export type TextureSource =
  | {
      type: 'url';
      /** URL absoluta o relativa desde la que cargar la textura. */
      url: string;
      options?: {
        /** Invierte el eje Y al cargar la textura (útil para imágenes generadas en WebGL). */
        invertY?: boolean;
        /** Indica si la textura contiene canal alfa. */
        hasAlpha?: boolean;
        /** Modo de muestreo de Babylon.js (por defecto, TRILINEAR). */
        samplingMode?: number;
      };
    }
  | {
      type: 'procedural';
      /** Nombre interno de la textura procedimental. */
      name?: string;
      /** Resolución de la textura generada. */
      size?: number;
      /** Intensidad de animación del ruido. */
      animationSpeedFactor?: number;
      /** Persistencia/fractalidad del ruido generado. */
      persistence?: number;
      /** Nivel de luminosidad del patrón. */
      brightness?: number;
      /** Número de octavas en el patrón de ruido. */
      octaves?: number;
    };

export interface EngineEffectsOptions {
  bloom?: {
    enabled?: boolean;
    threshold?: number;
    weight?: number;
    kernel?: number;
  };
  ssao2?: {
    enabled?: boolean;
    ratio?: number;
    totalStrength?: number;
    maxZ?: number;
  };
  volumetricLightScattering?: {
    enabled?: boolean;
    exposure?: number;
    decay?: number;
    weight?: number;
    samples?: number;
  };
}

export interface EnginePerformanceOptions {
  useHighPrecisionFloats?: boolean;
  hardwareScalingLevel?: number;
}

export interface EngineInitializationOptions {
  antialias?: boolean;
  adaptToDeviceRatio?: boolean;
  backgroundColor?: Color4 | string;
  effects?: EngineEffectsOptions;
  performance?: EnginePerformanceOptions;
  texture?: TextureSource;
}

export interface EngineBootstrapContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  environment: DayNightEnvironment;
  dispose: () => void;
}

export class EngineUnsupportedError extends Error {
  constructor(
    message = 'El motor gráfico no es compatible con este navegador.',
  ) {
    super(message);
    this.name = 'EngineUnsupportedError';
  }
}

/**
 * Inicializa una escena básica de Babylon.js con iluminación física y pipeline PBR.
 */
export async function initializeEngine(
  containerSelector: string,
  options: EngineInitializationOptions = {},
): Promise<EngineBootstrapContext> {
  const container = document.querySelector(containerSelector);
  if (!(container instanceof HTMLElement)) {
    throw new Error(
      `No se encontró el contenedor del motor para el selector: ${containerSelector}`,
    );
  }

  let canvas = container.querySelector('canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    container.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);
  }

  if (!isWebglAvailable()) {
    throw new EngineUnsupportedError(
      'WebGL no es compatible con este dispositivo.',
    );
  }

  let engine: Engine;
  try {
    engine = new Engine(canvas, options.antialias ?? true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
  } catch (error) {
    if (isWebglInitializationError(error)) {
      throw new EngineUnsupportedError(
        'WebGL no es compatible con este dispositivo.',
      );
    }
    throw error;
  }

  if (options.adaptToDeviceRatio) {
    engine.adaptToDeviceRatio = true;
  }

  if (typeof options.performance?.hardwareScalingLevel === 'number') {
    engine.setHardwareScalingLevel(options.performance.hardwareScalingLevel);
  }

  if (typeof options.performance?.useHighPrecisionFloats === 'boolean') {
    engine.useHighPrecisionFloats = options.performance.useHighPrecisionFloats;
  }

  const scene = new Scene(engine);
  scene.clearColor = resolveColor(options.backgroundColor);

  const camera = new ArcRotateCamera(
    'arcCamera',
    Math.PI / 4,
    Math.PI / 3,
    8,
    Vector3.Zero(),
    scene,
  );
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 30;
  camera.wheelPrecision = 40;
  camera.attachControl(canvas, true);

  const pipeline = configureRenderingPipeline(scene, camera, options.effects);
  const environment = createDayNightEnvironment(scene, pipeline);
  const textureMaterial = await createTexturePreview(scene, options.texture);

  const renderLoop = () => {
    if (textureMaterial?.albedoTexture instanceof NoiseProceduralTexture) {
      textureMaterial.albedoTexture.render();
    }
    scene.render();
  };
  engine.runRenderLoop(renderLoop);

  const handleResize = () => {
    engine.resize();
  };
  window.addEventListener('resize', handleResize);

  const dispose = () => {
    window.removeEventListener('resize', handleResize);
    pipeline?.dispose();
    environment.dispose();
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, camera, environment, dispose };
}

function isWebglAvailable(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const testCanvas = document.createElement('canvas');
    const context =
      (testCanvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (testCanvas.getContext('webgl') as WebGLRenderingContext | null) ??
      (testCanvas.getContext(
        'experimental-webgl',
      ) as WebGLRenderingContext | null);

    if (!context) {
      return false;
    }

    try {
      context.getParameter(context.VERSION);
    } catch {
      return false;
    } finally {
      const loseContext = context.getExtension?.('WEBGL_lose_context');
      loseContext?.loseContext?.();
      loseContext?.restoreContext?.();
    }

    return true;
  } catch {
    return false;
  }
}

function isWebglInitializationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('webgl') || message.includes('context');
}

function configureRenderingPipeline(
  scene: Scene,
  camera: ArcRotateCamera,
  effects: EngineEffectsOptions | undefined,
): DefaultRenderingPipeline | undefined {
  const postProcessCameras = [camera];
  const pipeline = new DefaultRenderingPipeline(
    'defaultPipeline',
    true,
    scene,
    postProcessCameras,
  );

  const bloomOptions = effects?.bloom ?? {};
  pipeline.bloomEnabled = bloomOptions.enabled ?? true;
  if (pipeline.bloomEnabled) {
    pipeline.bloomThreshold = bloomOptions.threshold ?? 0.9;
    pipeline.bloomWeight = bloomOptions.weight ?? 0.15;
    pipeline.bloomKernel = bloomOptions.kernel ?? 64;
  }

  const ssaoOptions = effects?.ssao2 ?? { enabled: true };
  if (ssaoOptions.enabled ?? true) {
    const ssaoPipeline = new SSAO2RenderingPipeline(
      'ssao2',
      scene,
      ssaoOptions.ratio ?? 0.75,
      postProcessCameras,
    );
    ssaoPipeline.totalStrength = ssaoOptions.totalStrength ?? 1.0;
    ssaoPipeline.maxZ = ssaoOptions.maxZ ?? 100;
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
      'ssao2',
      camera,
    );
  }

  const volumetricOptions = effects?.volumetricLightScattering ?? {
    enabled: true,
  };
  if (volumetricOptions.enabled ?? true) {
    const volumetric = new VolumetricLightScatteringPostProcess(
      'godrays',
      1.0,
      camera,
      undefined,
      volumetricOptions.samples ?? 100,
      Texture.BILINEAR_SAMPLINGMODE,
      scene.getEngine(),
      false,
      scene,
    );
    volumetric.exposure = volumetricOptions.exposure ?? 0.6;
    volumetric.decay = volumetricOptions.decay ?? 0.968;
    volumetric.weight = volumetricOptions.weight ?? 0.9875;
  }

  return pipeline;
}

async function createTexturePreview(
  scene: Scene,
  source: TextureSource | undefined,
): Promise<PBRMaterial | undefined> {
  if (!source) {
    return undefined;
  }

  const sphere = MeshBuilder.CreateSphere(
    'previewSphere',
    { segments: 48, diameter: 2 },
    scene,
  );

  const material = new PBRMaterial('previewMaterial', scene);
  material.roughness = 0.35;
  material.metallic = 0.2;

  if (source.type === 'url') {
    Texture.CrossOrigin = 'anonymous';
    const texture = new Texture(
      source.url,
      scene,
      undefined,
      source.options?.invertY ?? false,
      source.options?.samplingMode,
    );
    texture.hasAlpha = source.options?.hasAlpha ?? false;
    material.albedoTexture = texture;
  } else {
    const texture = new NoiseProceduralTexture(
      source.name ?? 'proceduralTexture',
      source.size ?? 512,
      scene,
    );
    texture.animationSpeedFactor = source.animationSpeedFactor ?? 1;
    texture.persistence = source.persistence ?? 2;
    texture.brightness = source.brightness ?? 0.4;
    texture.octaves = source.octaves ?? 6;
    material.albedoTexture = texture;
  }

  sphere.material = material;

  return material;
}

function resolveColor(
  color: EngineInitializationOptions['backgroundColor'],
): Color4 {
  if (!color) {
    return new Color4(0, 0, 0, 1);
  }

  if (typeof color === 'string') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return new Color4(0, 0, 0, 1);
    }
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return new Color4(
      data[0] / 255,
      data[1] / 255,
      data[2] / 255,
      data[3] / 255,
    );
  }

  return color;
}
