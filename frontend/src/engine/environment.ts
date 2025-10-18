import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Scalar } from '@babylonjs/core/Maths/math.scalar';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { NoiseProceduralTexture } from '@babylonjs/core/Materials/Textures/Procedurals/noiseProceduralTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';

const DAY_LENGTH_MS = 24 * 60 * 60 * 1000;
const SUN_DISTANCE = 250;
const DAY_COLOR = Color3.FromHexString('#f4f1e5');
const NIGHT_COLOR = Color3.FromHexString('#0a1233');
const DAWN_COLOR = Color3.FromHexString('#ffb48a');
const AMBIENT_DAY = Color3.FromHexString('#bcd4ff');
const AMBIENT_NIGHT = Color3.FromHexString('#3a4c6e');
const GROUND_DAY = Color3.FromHexString('#6d6044');
const GROUND_NIGHT = Color3.FromHexString('#1b1f33');

export interface DayNightEnvironment {
  sunLight: DirectionalLight;
  moonLight: DirectionalLight;
  sunShadow: ShadowGenerator;
  moonShadow: ShadowGenerator;
  skybox: SkyMaterial;
  setTimeProvider: (provider: () => number) => void;
  dispose: () => void;
}

const lerpColor3 = (from: Color3, to: Color3, amount: number): Color3 =>
  Color3.Lerp(from, to, amount);

const clamp01 = (value: number): number => Scalar.Clamp(value, 0, 1);

const modulo = (value: number, modulus: number): number =>
  ((value % modulus) + modulus) % modulus;

export const createDayNightEnvironment = (
  scene: Scene,
  pipeline?: DefaultRenderingPipeline,
): DayNightEnvironment => {
  const ambientLight = new HemisphericLight(
    'ambientLight',
    Vector3.Up(),
    scene,
  );
  ambientLight.intensity = 0.3;
  ambientLight.specular = Color3.Black();

  const sunLight = new DirectionalLight(
    'sunLight',
    new Vector3(-0.5, -1, -0.5).normalize(),
    scene,
  );
  sunLight.intensity = 0;
  sunLight.shadowMinZ = 1;
  sunLight.shadowMaxZ = 400;
  sunLight.autoCalcShadowZBounds = true;
  sunLight.shadowOrthoScale = 0.5;
  sunLight.diffuse = Color3.FromHexString('#fff6db');
  sunLight.specular = Color3.FromHexString('#f8e8c8');

  const moonLight = new DirectionalLight(
    'moonLight',
    new Vector3(0.5, -1, 0.5).normalize(),
    scene,
  );
  moonLight.intensity = 0.15;
  moonLight.shadowMinZ = 1;
  moonLight.shadowMaxZ = 400;
  moonLight.autoCalcShadowZBounds = true;
  moonLight.diffuse = Color3.FromHexString('#b0c4ff');
  moonLight.specular = Color3.FromHexString('#9fb7ff');

  const sunShadow = new ShadowGenerator(2048, sunLight);
  sunShadow.usePercentageCloserFiltering = true;
  sunShadow.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  sunShadow.frustumEdgeFalloff = 0.4;
  sunShadow.darkness = 0.2;
  sunShadow.bias = 0.00025;

  const moonShadow = new ShadowGenerator(1024, moonLight);
  moonShadow.usePercentageCloserFiltering = true;
  moonShadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
  moonShadow.frustumEdgeFalloff = 0.25;
  moonShadow.darkness = 0.4;
  moonShadow.bias = 0.0003;

  const skyMaterial = new SkyMaterial('skyMaterial', scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.distance = 1000;
  skyMaterial.inclination = 0;
  skyMaterial.azimuth = 0;
  skyMaterial.luminance = 1;
  skyMaterial.turbidity = 4;
  skyMaterial.rayleigh = 2;
  skyMaterial.mieCoefficient = 0.005;
  skyMaterial.mieDirectionalG = 0.8;
  skyMaterial.useSunPosition = true;

  const skybox = MeshBuilder.CreateBox('skybox', { size: 2000 }, scene);
  skybox.material = skyMaterial;
  skybox.infiniteDistance = true;
  skybox.isPickable = false;
  skybox.applyFog = false;
  skybox.receiveShadows = false;

  const cloudTexture = new NoiseProceduralTexture('clouds', 512, scene);
  cloudTexture.animationSpeedFactor = 0.15;
  cloudTexture.persistence = 2.5;
  cloudTexture.brightness = 0.6;
  cloudTexture.octaves = 4;
  cloudTexture.wrapU = Texture.WRAP_ADDRESSMODE;
  cloudTexture.wrapV = Texture.WRAP_ADDRESSMODE;

  const cloudMaterial = new StandardMaterial('cloudMaterial', scene);
  cloudMaterial.backFaceCulling = false;
  cloudMaterial.disableLighting = true;
  cloudMaterial.useAlphaFromDiffuseTexture = true;
  cloudMaterial.alpha = 0.45;
  cloudMaterial.diffuseTexture = cloudTexture;
  cloudMaterial.opacityTexture = cloudTexture;
  cloudMaterial.emissiveTexture = cloudTexture;
  cloudMaterial.emissiveColor = Color3.FromHexString('#f0f6ff');

  const cloudDome = MeshBuilder.CreateSphere(
    'cloudDome',
    { diameter: 1980, segments: 32 },
    scene,
  );
  cloudDome.material = cloudMaterial;
  cloudDome.infiniteDistance = true;
  cloudDome.isPickable = false;
  cloudDome.applyFog = false;
  cloudDome.receiveShadows = false;

  let timeProvider: () => number = () => Date.now();
  let observer: Observer<Scene> | undefined;

  const updateEnvironment = () => {
    const now = timeProvider();
    const normalizedTime = modulo(now, DAY_LENGTH_MS);
    const dayProgress = normalizedTime / DAY_LENGTH_MS;

    const solarAngle = (dayProgress - 0.25) * Math.PI * 2;
    const altitude = Math.sin(solarAngle);
    const horizontalRadius = Math.cos(solarAngle);
    const azimuth = dayProgress * Math.PI * 2;

    const sunVector = new Vector3(
      Math.cos(azimuth) * horizontalRadius,
      altitude,
      Math.sin(azimuth) * horizontalRadius,
    ).normalize();

    const sunPosition = sunVector.scale(SUN_DISTANCE);
    sunLight.position = sunPosition;
    sunLight.direction = sunVector.scale(-1);

    const moonPosition = sunVector.scale(-SUN_DISTANCE);
    moonLight.position = moonPosition;
    moonLight.direction = sunVector;

    const daylightFactor = clamp01((altitude + 0.15) / 1.15);
    const duskFactor = clamp01((0.1 - Math.abs(altitude)) / 0.1);

    const ambientColor = lerpColor3(AMBIENT_NIGHT, AMBIENT_DAY, daylightFactor);
    ambientLight.diffuse = ambientColor;
    ambientLight.groundColor = lerpColor3(
      GROUND_NIGHT,
      GROUND_DAY,
      daylightFactor,
    );
    ambientLight.intensity = Scalar.Lerp(0.25, 0.95, daylightFactor);

    const clearTint = Color3.Lerp(NIGHT_COLOR, DAY_COLOR, daylightFactor);
    scene.clearColor = new Color4(
      clearTint.r * 0.25,
      clearTint.g * 0.3,
      clearTint.b * 0.4,
      1,
    );
    scene.environmentIntensity = Scalar.Lerp(0.2, 1.0, daylightFactor);

    sunLight.intensity = Scalar.Lerp(0.0, 2.2, daylightFactor);
    moonLight.intensity = Scalar.Lerp(0.05, 0.6, 1 - daylightFactor);

    const exposure = Scalar.Lerp(0.35, 1.2, daylightFactor);
    const contrast = Scalar.Lerp(1.05, 1.35, daylightFactor);
    scene.imageProcessingConfiguration.exposure = exposure;
    scene.imageProcessingConfiguration.contrast = contrast;
    if (pipeline?.imageProcessing) {
      pipeline.imageProcessing.exposure = exposure;
      pipeline.imageProcessing.contrast = contrast;
    }

    skyMaterial.sunPosition = sunVector.scale(1000);
    skyMaterial.luminance = Scalar.Lerp(0.15, 1.05, daylightFactor);
    skyMaterial.turbidity = Scalar.Lerp(6, 2.5, daylightFactor);
    skyMaterial.rayleigh = Scalar.Lerp(0.4, 2.5, daylightFactor);
    skyMaterial.mieDirectionalG = Scalar.Lerp(0.9, 0.75, daylightFactor);

    const horizonTint = Color3.Lerp(
      Color3.Lerp(NIGHT_COLOR, DAWN_COLOR, duskFactor),
      DAY_COLOR,
      daylightFactor,
    );
    cloudMaterial.emissiveColor = horizonTint.scale(0.8);
    cloudMaterial.alpha = Scalar.Lerp(0.6, 0.35, daylightFactor);
  };

  observer = scene.onBeforeRenderObservable.add(() => {
    const deltaTime = scene.getEngine().getDeltaTime();
    cloudTexture.render();
    cloudDome.rotation.y += (deltaTime / 1000) * 0.02;
    updateEnvironment();
  });

  updateEnvironment();

  const setTimeProvider = (provider: () => number) => {
    timeProvider = provider;
  };

  const dispose = () => {
    if (observer) {
      scene.onBeforeRenderObservable.remove(observer);
      observer = undefined;
    }
    skybox.dispose(false, true);
    cloudDome.dispose(false, true);
    skyMaterial.dispose();
    cloudMaterial.dispose();
    cloudTexture.dispose();
    sunShadow.dispose();
    moonShadow.dispose();
    sunLight.dispose();
    moonLight.dispose();
    ambientLight.dispose();
  };

  return {
    sunLight,
    moonLight,
    sunShadow,
    moonShadow,
    skybox: skyMaterial,
    setTimeProvider,
    dispose,
  };
};
