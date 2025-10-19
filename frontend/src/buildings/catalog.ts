import type { BuildBlueprint, BuildCategory } from './types';

export interface BuildCategoryDefinition {
  id: BuildCategory;
  label: string;
  description: string;
  blueprints: BuildBlueprint[];
}

const buildBlueprint = (
  id: string,
  name: string,
  type: string,
  category: BuildCategory,
  previewColor: string,
  description?: string,
): BuildBlueprint => ({
  id,
  name,
  type,
  category,
  previewColor,
  description,
});

export const BUILD_CATEGORIES: BuildCategoryDefinition[] = [
  {
    id: 'houses',
    label: 'Casas',
    description: 'Estructuras principales donde viven los habitantes.',
    blueprints: [
      buildBlueprint('small-house', 'Casa pequeña', 'house.small', 'houses', '#f4b400'),
      buildBlueprint('medium-house', 'Casa mediana', 'house.medium', 'houses', '#f7941d'),
      buildBlueprint('villa', 'Villa moderna', 'house.villa', 'houses', '#ff7043'),
    ],
  },
  {
    id: 'decorations',
    label: 'Decoración',
    description: 'Objetos para embellecer tu parcela.',
    blueprints: [
      buildBlueprint('tree', 'Árbol', 'decor.tree', 'decorations', '#81c784'),
      buildBlueprint('fountain', 'Fuente', 'decor.fountain', 'decorations', '#4fc3f7'),
      buildBlueprint('bench', 'Banco', 'decor.bench', 'decorations', '#ba68c8'),
    ],
  },
  {
    id: 'paths',
    label: 'Caminos',
    description: 'Senderos y pavimentos para conectar tu vecindario.',
    blueprints: [
      buildBlueprint('stone-path', 'Camino de piedra', 'path.stone', 'paths', '#b0bec5'),
      buildBlueprint('wood-path', 'Camino de madera', 'path.wood', 'paths', '#a1887f'),
      buildBlueprint('plaza', 'Plaza', 'path.plaza', 'paths', '#90a4ae'),
    ],
  },
];

const blueprintByType = new Map<string, BuildBlueprint>();
const blueprintById = new Map<string, BuildBlueprint>();

BUILD_CATEGORIES.forEach((category) => {
  category.blueprints.forEach((blueprint) => {
    blueprintByType.set(blueprint.type, blueprint);
    blueprintById.set(blueprint.id, blueprint);
  });
});

export const getBlueprintByType = (type: string): BuildBlueprint | undefined =>
  blueprintByType.get(type);

export const getBlueprintById = (id: string): BuildBlueprint | undefined => blueprintById.get(id);
