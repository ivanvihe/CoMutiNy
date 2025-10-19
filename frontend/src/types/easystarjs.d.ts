declare module 'easystarjs' {
  interface EasyStarNode {
    x: number;
    y: number;
    cost?: number;
  }

  type EasyStarPath = EasyStarNode[];

  interface EasyStarInstance {
    setGrid(grid: number[][]): void;
    setAcceptableTiles(tiles: number[]): void;
    enableSync(): void;
    findPath(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      callback: (path: EasyStarPath | null) => void,
    ): void;
    calculate(): void;
  }

  const EasyStar: {
    js: new () => EasyStarInstance;
  };

  export default EasyStar;
}
