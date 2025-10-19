export interface TilesetDefinition {
  key: string;
  url: string;
  description: string;
}

export const TILESET_PLACEHOLDERS: TilesetDefinition[] = [
  {
    key: 'tileset-ground',
    url: 'assets/tilesets/kenney-citybuilder-colormap.png',
    description: 'Placeholder plano generado con dummyimage.com para suelos provisionales.',
  },
  {
    key: 'tileset-props',
    url: 'assets/tilesets/kenney-citybuilder-selector.png',
    description: 'Imagen temporal estilo plano para resaltar selección de props.',
  },
  {
    key: 'tileset-structures',
    url: 'assets/tilesets/kenney-citybuilder-coin.png',
    description: 'Marcador provisional para estructuras con estética uniforme.',
  },
];
