import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

async function createBabylonEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  if (await WebGPUEngine.IsSupportedAsync) {
    const webGpu = new WebGPUEngine(canvas, {
      stencil: true,
      adaptToDeviceRatio: true
    });
    await webGpu.initAsync();
    return webGpu;
  }

  return new Engine(canvas, true, { stencil: true, adaptToDeviceRatio: true });
}

export default createBabylonEngine;
