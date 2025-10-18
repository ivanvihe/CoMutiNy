const PHASE3_COLLISION_PRESETS = new Map([
  [
    'workspace_desk',
    {
      size: { width: 2, height: 1 },
      volume: { height: 1.1, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  [
    'collab_chairs',
    {
      size: { width: 1, height: 1 },
      volume: { height: 1, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  [
    'livingroom_lamp',
    {
      size: { width: 1, height: 1 },
      volume: { height: 1.6, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  [
    'lounge_plant',
    {
      size: { width: 1, height: 1 },
      volume: { height: 1.4, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  [
    'outdoor_tree_large',
    {
      size: { width: 2, height: 2 },
      volume: { height: 2.4, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ],
  [
    'decorative_fountain',
    {
      size: { width: 2, height: 2 },
      volume: { height: 1.2, anchor: { x: 0.5, y: 1, z: 0 } }
    }
  ]
]);

export const listPhase3ObjectIds = () => Array.from(PHASE3_COLLISION_PRESETS.keys());

export const getObjectCollisionPreset = (objectId) => {
  if (!objectId) {
    return null;
  }
  const key = `${objectId}`.trim();
  if (!key) {
    return null;
  }
  return PHASE3_COLLISION_PRESETS.get(key) ?? null;
};

export default {
  listPhase3ObjectIds,
  getObjectCollisionPreset
};
