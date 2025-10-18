import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import createBabylonEngine from "@engine/createEngine";
import createCommunityScene from "@engine/createScene";

const EngineCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let disposed = false;

    (async () => {
      engine = await createBabylonEngine(canvas);
      if (disposed) {
        engine.dispose();
        return;
      }
      scene = await createCommunityScene(engine, canvas);
      engine.runRenderLoop(() => {
        scene?.render();
      });
    })();

    const handleResize = () => {
      engine?.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);
      scene?.dispose();
      engine?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="engine-canvas" />;
};

export default EngineCanvas;
