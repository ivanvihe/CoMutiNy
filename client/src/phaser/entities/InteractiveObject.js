import Phaser from 'phaser';
import { resolveObjectDefinition } from '../../game/objects/definitions.js';

const toPlainObject = (value, fallback = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...fallback };
  }
  return { ...fallback, ...value };
};

const cloneBehaviour = (behaviour) => {
  if (!behaviour || typeof behaviour !== 'object' || Array.isArray(behaviour)) {
    return null;
  }

  const cloned = { ...behaviour };
  if (behaviour.metadata && typeof behaviour.metadata === 'object' && !Array.isArray(behaviour.metadata)) {
    cloned.metadata = { ...behaviour.metadata };
  }
  if (Array.isArray(behaviour.effects)) {
    cloned.effects = [...behaviour.effects];
  }
  return cloned;
};

const mergeBehaviours = (primary, fallback) => {
  const source = cloneBehaviour(primary) ?? cloneBehaviour(fallback);
  if (!source) {
    return null;
  }
  return source;
};

const resolveObjectReferenceId = (object) => {
  if (!object || typeof object !== 'object') {
    return null;
  }
  if (typeof object.objectId === 'string' && object.objectId.trim()) {
    return object.objectId.trim();
  }
  if (typeof object.definitionId === 'string' && object.definitionId.trim()) {
    return object.definitionId.trim();
  }
  if (object.metadata && typeof object.metadata === 'object' && typeof object.metadata.objectId === 'string') {
    const trimmed = object.metadata.objectId.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
};

const DEFAULT_ORIGIN = { x: 0.5, y: 1 };

export default class InteractiveObject extends Phaser.GameObjects.Sprite {
  constructor(scene, {
    object = {},
    definition = null,
    mapId = null,
    position = { x: 0, y: 0 },
    textureKey = null,
    textureFallback = Phaser.Textures.Texture.DEFAULT,
    origin = DEFAULT_ORIGIN,
    scale = { x: 1, y: 1 },
    size = { width: 1, height: 1 },
    tileSize = 64,
    behaviour,
    interaction
  } = {}) {
    const resolvedTexture = textureKey ?? textureFallback ?? Phaser.Textures.Texture.DEFAULT;
    const x = Number.isFinite(position?.x) ? position.x : 0;
    const y = Number.isFinite(position?.y) ? position.y : 0;

    super(scene, x, y, resolvedTexture);

    this.scene = scene;
    scene.add.existing(this);

    this.objectData = object && typeof object === 'object' ? { ...object } : {};
    this.mapId = mapId ?? null;
    this.definition = definition ?? resolveObjectDefinition(resolveObjectReferenceId(this.objectData));
    this.definitionId = this.definition?.id ?? null;
    this.objectId = this.objectData?.id ?? null;
    this.displayName = this.objectData?.name ?? this.definition?.name ?? this.objectId ?? this.definitionId ?? 'Objeto';

    const definitionMetadata = toPlainObject(this.definition?.metadata);
    const objectMetadata = toPlainObject(this.objectData?.metadata);
    this.metadata = { ...definitionMetadata, ...objectMetadata };

    this.behaviour = mergeBehaviours(
      behaviour ?? this.objectData?.behaviour,
      this.definition?.behaviour ?? this.definition?.interaction ?? this.objectData?.interaction
    );
    this.interaction = mergeBehaviours(interaction ?? this.objectData?.interaction, this.definition?.interaction);

    this.size = {
      width: Number.isFinite(size?.width) ? size.width : 1,
      height: Number.isFinite(size?.height) ? size.height : 1
    };
    this.tileSize = Number.isFinite(tileSize) ? tileSize : 64;

    const originX = Number.isFinite(origin?.x) ? origin.x : DEFAULT_ORIGIN.x;
    const originY = Number.isFinite(origin?.y) ? origin.y : DEFAULT_ORIGIN.y;
    this.setOrigin(originX, originY);

    const scaleX = Number.isFinite(scale?.x) ? scale.x : 1;
    const scaleY = Number.isFinite(scale?.y) ? scale.y : 1;
    this.setScale(scaleX, scaleY);

    if (!textureKey) {
      this.setDisplaySize(this.size.width * this.tileSize, this.size.height * this.tileSize);
    }

    this.setName(this.displayName);
    this.setDataEnabled();
    if (this.objectId) {
      this.setData('objectId', this.objectId);
    }
    if (this.definitionId) {
      this.setData('definitionId', this.definitionId);
    }
    if (this.mapId) {
      this.setData('mapId', this.mapId);
    }

    this._handlePointerDown = this._handlePointerDown.bind(this);
    if (this.behaviour || this.interaction) {
      this.setInteractive({ useHandCursor: true });
      this.on('pointerdown', this._handlePointerDown);
    }
  }

  getBehaviourPayload(overrides = {}) {
    const base = this.behaviour ?? this.interaction;
    if (!base) {
      return null;
    }

    const payload = {
      ...base,
      objectId: this.objectId ?? this.definitionId ?? null,
      objectName: this.displayName,
      mapId: this.mapId ?? null,
      metadata: base.metadata ? { ...base.metadata } : {},
      ...(Array.isArray(base.effects) ? { effects: [...base.effects] } : {}),
      ...overrides
    };

    if (!payload.description && this.interaction?.description) {
      payload.description = this.interaction.description;
    }
    if (!payload.title && this.interaction?.title) {
      payload.title = this.interaction.title;
    }

    if (!payload.metadata || typeof payload.metadata !== 'object') {
      payload.metadata = {};
    }

    return payload;
  }

  triggerBehaviour(overrides = {}) {
    const payload = this.getBehaviourPayload(overrides);
    if (!payload) {
      return null;
    }

    this.emit('behaviour', payload, this);
    return payload;
  }

  updateMapId(mapId) {
    this.mapId = typeof mapId === 'string' ? mapId : this.mapId;
    if (this.mapId) {
      this.setData('mapId', this.mapId);
    }
  }

  _handlePointerDown() {
    this.triggerBehaviour();
  }

  destroy(fromScene) {
    this.off('pointerdown', this._handlePointerDown);
    super.destroy(fromScene);
  }
}
