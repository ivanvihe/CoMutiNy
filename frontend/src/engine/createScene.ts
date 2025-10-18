import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Color4, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import { ScenePerformancePriority } from "@babylonjs/core/scenePerformancePriority";
import { createChunkMesh } from "@voxel/chunkMesh";
import { generateChunkData } from "@voxel/chunk";
import { BLOCK_REGISTRY } from "@voxel/registry";
import { buildProceduralSky } from "@engine/sky";

MeshBuilder.CreateBox.name;

const SKYBOX_SIZE = 1000;

async function createCommunityScene(engine: Engine, canvas: HTMLCanvasElement): Promise<Scene> {
  const scene = new Scene(engine);
  scene.performancePriority = ScenePerformancePriority.Aggressive;
  scene.clearColor = new Color4(0.03, 0.05, 0.1, 1.0);

  const camera = new UniversalCamera("mainCamera", new Vector3(0, 18, -28), scene);
  camera.speed = 0.6;
  camera.minZ = 0.1;
  camera.maxZ = 2000;
  camera.inertia = 0.6;
  camera.angularSensibility = 4000;
  camera.setTarget(new Vector3(0, 12, 0));
  camera.attachControl(canvas, true);

  const hemiLight = new HemisphericLight("hemisphere", new Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new Color3(0.75, 0.85, 1.0);
  hemiLight.groundColor = new Color3(0.05, 0.08, 0.12);
  hemiLight.intensity = 0.6;

  const sunLight = new DirectionalLight("sunLight", new Vector3(-0.8, -1.2, 0.5), scene);
  sunLight.intensity = 3.8;
  sunLight.shadowMinZ = -20;
  sunLight.shadowMaxZ = 60;

  const shadowGenerator = new ShadowGenerator(4096, sunLight);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

  const skyboxMaterial = buildProceduralSky(scene);
  const skybox = MeshBuilder.CreateBox("skybox", { size: SKYBOX_SIZE }, scene);
  skybox.isPickable = false;
  skybox.infiniteDistance = true;
  skybox.material = skyboxMaterial;

  const plazaMaterial = new PBRMaterial("plaza", scene);
  plazaMaterial.albedoColor = new Color3(0.45, 0.48, 0.52);
  plazaMaterial.reflectivityColor = new Color3(0.2, 0.23, 0.28);
  plazaMaterial.metallic = 0.0;
  plazaMaterial.roughness = 0.45;
  plazaMaterial.subSurface.isTranslucencyEnabled = false;

  const plaza = MeshBuilder.CreateGround("plaza", { width: 48, height: 48, subdivisions: 64 }, scene);
  plaza.receiveShadows = true;
  plaza.material = plazaMaterial;

  const chunk = generateChunkData({ x: 0, z: 0 });
  const chunkMesh = createChunkMesh(scene, chunk, BLOCK_REGISTRY);
  chunkMesh.receiveShadows = true;
  shadowGenerator.addShadowCaster(chunkMesh);

  const reflectionTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.dds", scene);
  scene.environmentTexture = reflectionTexture;
  scene.environmentIntensity = 0.9;

  return scene;
}

export default createCommunityScene;
