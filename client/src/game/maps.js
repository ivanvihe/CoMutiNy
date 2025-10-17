export const MAPS = [
  {
    id: 'bridge',
    name: 'Puente de mando',
    size: { width: 10, height: 6 },
    spawn: { x: 4, y: 4 },
    blockedAreas: [
      { x: 0, y: 0, width: 10, height: 1 },
      { x: 0, y: 5, width: 10, height: 1 },
      { x: 0, y: 0, width: 1, height: 6 },
      { x: 9, y: 0, width: 1, height: 6 },
      // Consola central
      { x: 3, y: 2, width: 4, height: 1 }
    ],
    objects: [
      {
        id: 'nav-console',
        name: 'Consola de navegación',
        position: { x: 3, y: 1 },
        size: { width: 4, height: 1 },
        solid: true,
        interaction: {
          type: 'dialog',
          title: 'Consola de navegación',
          description:
            'Las coordenadas están bloqueadas para evitar otra mutinería... pero quizá alguien con el rol adecuado pueda cambiarlas.'
        }
      },
      {
        id: 'captains-chair',
        name: 'Silla del capitán',
        position: { x: 5, y: 3 },
        size: { width: 1, height: 1 },
        solid: false,
        interaction: {
          type: 'status',
          title: 'Silla del capitán',
          description: 'Te sientas por un momento. Sientes el peso de la responsabilidad sobre tus hombros.'
        }
      }
    ],
    portals: [
      {
        id: 'bridge-to-quarters',
        from: { x: 1, y: 1, width: 1, height: 1 },
        targetMap: 'quarters',
        targetPosition: { x: 8, y: 3 },
        description: 'Entrada hacia los camarotes.'
      }
    ]
  },
  {
    id: 'quarters',
    name: 'Camarotes',
    size: { width: 9, height: 7 },
    spawn: { x: 1, y: 3 },
    blockedAreas: [
      { x: 0, y: 0, width: 9, height: 1 },
      { x: 0, y: 6, width: 9, height: 1 },
      { x: 0, y: 0, width: 1, height: 7 },
      { x: 8, y: 0, width: 1, height: 7 }
    ],
    objects: [
      {
        id: 'storage-locker',
        name: 'Taquilla de suministros',
        position: { x: 2, y: 2 },
        size: { width: 1, height: 2 },
        solid: true,
        interaction: {
          type: 'inventory',
          title: 'Taquilla de suministros',
          description: 'Encuentras uniformes de repuesto y una caja con componentes electrónicos.'
        }
      },
      {
        id: 'bunk-bed',
        name: 'Literas',
        position: { x: 5, y: 2 },
        size: { width: 2, height: 2 },
        solid: true,
        interaction: {
          type: 'rest',
          title: 'Literas',
          description: 'Los colchones son sorprendentemente cómodos. Recuperas tu energía mental.'
        }
      }
    ],
    portals: [
      {
        id: 'quarters-to-bridge',
        from: { x: 7, y: 3, width: 1, height: 1 },
        targetMap: 'bridge',
        targetPosition: { x: 2, y: 1 },
        description: 'Corredor hacia el puente de mando.'
      }
    ]
  }
];
