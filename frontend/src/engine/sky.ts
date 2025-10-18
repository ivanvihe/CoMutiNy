import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { SkyMaterial } from "@babylonjs/materials/sky/skyMaterial";

export function buildProceduralSky(scene: Scene) {
  const skyMaterial = new SkyMaterial("sky", scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.turbidity = 20;
  skyMaterial.luminance = 1.2;
  skyMaterial.rayleigh = 2.0;
  skyMaterial.azimuth = 0.25;
  skyMaterial.inclination = 0.5;
  skyMaterial.useSunPosition = false;
  skyMaterial.cameraOffset.y = 0;

  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.0035;
  scene.fogColor = new Color3(0.05, 0.08, 0.14);

  return skyMaterial;
}
