export interface TilesetDefinition {
  key: string;
  url: string;
  description: string;
}

export const TILESET_PLACEHOLDERS: TilesetDefinition[] = [
  {
    key: 'tileset-ground',
    url: 'https://placehold.co/512x512/2d3436/ffffff?text=Ground+Tileset',
    description: 'Placeholder for isometric ground tileset (download real asset manually).',
  },
  {
    key: 'tileset-props',
    url: 'https://placehold.co/512x512/36404a/ffffff?text=Props+Tileset',
    description: 'Placeholder for decorative props tileset.',
  },
  {
    key: 'tileset-structures',
    url: 'https://placehold.co/512x512/4b5763/ffffff?text=Structures+Tileset',
    description: 'Placeholder for structures/buildings tileset.',
  },
];
