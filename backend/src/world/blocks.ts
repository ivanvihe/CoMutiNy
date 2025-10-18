export interface BlockTypeDefinition {
  id: number;
  name: string;
  displayName: string;
}

export const BLOCK_CATALOG: BlockTypeDefinition[] = [
  { id: 1, name: 'grass', displayName: 'Hierba' },
  { id: 2, name: 'dirt', displayName: 'Tierra' },
  { id: 3, name: 'stone', displayName: 'Piedra' },
  { id: 4, name: 'water', displayName: 'Agua' },
  { id: 5, name: 'sand', displayName: 'Arena' },
];

const ALLOWED_BLOCK_TYPES = new Set(BLOCK_CATALOG.map((block) => block.name));

export const DEFAULT_HOTBAR_BLOCKS = BLOCK_CATALOG.slice(0, 5).map((block) => block.name);

export const isAllowedBlockType = (type: string): boolean => ALLOWED_BLOCK_TYPES.has(type);
