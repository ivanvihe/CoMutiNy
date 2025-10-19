export interface TilesetDefinition {
  key: string;
  url: string;
  description: string;
}

export const TILESET_PLACEHOLDERS: TilesetDefinition[] = [
  {
    key: 'tileset-ground',
    url: 'assets/tilesets/kenney-citybuilder-colormap.png',
    description: 'Kenney Starter Kit City Builder – textura de terreno (MIT).',
  },
  {
    key: 'tileset-props',
    url: 'assets/tilesets/kenney-citybuilder-selector.png',
    description: 'Selector del pack City Builder usado como sustituto temporal de props.',
  },
  {
    key: 'tileset-structures',
    url: 'assets/tilesets/kenney-citybuilder-coin.png',
    description: 'Icono de moneda del pack City Builder como marcador de estructuras.',
  },
];
