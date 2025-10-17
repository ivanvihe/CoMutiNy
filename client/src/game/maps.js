export const MAPS = [
  {
    id: 'hello-world',
    name: 'Hello World',
    biome: 'Demo',
    description: 'Un pequeño mundo de bienvenida para explorar los controles básicos.',
    size: { width: 7, height: 7 },
    spawn: { x: 3, y: 3 },
    blockedAreas: [
      { x: 0, y: 0, width: 7, height: 1 },
      { x: 0, y: 6, width: 7, height: 1 },
      { x: 0, y: 0, width: 1, height: 7 },
      { x: 6, y: 0, width: 1, height: 7 }
    ],
    objects: [],
    portals: []
  }
];
