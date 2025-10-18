import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Nullable } from '@babylonjs/core/types';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

import type { EngineBootstrapContext } from '../engine';
import type {
  BlockPlacedEvent,
  BlockRemovedEvent,
  MultiplayerClient,
} from '../multiplayer';
import type { VoxelWorld } from '../voxel';
import type { BlockDefinition } from '../voxel/blocks';

type QuantityValue = number | 'infinite';

interface InternalHotbarSlot {
  key: number;
  type: string | null;
  block: BlockDefinition | null;
}

interface Vector3Coordinates {
  x: number;
  y: number;
  z: number;
}

const HOTBAR_KEYS = Array.from({ length: 9 }, (_value, index) => index + 1);

const DEFAULT_HOTBAR_PRESET: Array<{ type: string; quantity: QuantityValue }> = [
  { type: 'grass', quantity: 256 },
  { type: 'dirt', quantity: 256 },
  { type: 'stone', quantity: 256 },
  { type: 'sand', quantity: 128 },
  { type: 'water', quantity: 64 },
];

const CHUNK_UPDATE_INTERVAL_MS = 250;

const HOTBAR_UPDATE_EVENT = 'hotbarupdate';
const HOTBAR_SELECT_EVENT = 'hotbarselect';
const HOTBAR_FEEDBACK_EVENT = 'hotbarfeedback';

export interface GameHotbarSlot {
  key: number;
  type: string | null;
  block: BlockDefinition | null;
  quantity: QuantityValue | null;
}

export interface HotbarFeedbackDetail {
  slotKey: number;
  reason: 'empty' | 'blocked';
}

export class GameController extends EventTarget {
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly world: VoxelWorld;
  private readonly multiplayer?: MultiplayerClient;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly hotbarSlots: InternalHotbarSlot[];
  private readonly inventory = new Map<string, QuantityValue>();
  private inputEnabled = true;
  private pointerObserver: Nullable<Observer<PointerInfo>> = null;
  private updateObserver: Nullable<Observer<Scene>> = null;
  private contextMenuListener: ((event: MouseEvent) => void) | null = null;
  private lastChunkUpdate = 0;
  private disposed = false;
  private selectedIndex = 0;

  constructor(
    context: EngineBootstrapContext,
    world: VoxelWorld,
    multiplayer?: MultiplayerClient,
  ) {
    super();
    this.scene = context.scene;
    this.camera = context.camera;
    this.canvas = context.engine.getRenderingCanvas() ?? null;
    this.world = world;
    this.multiplayer = multiplayer;
    this.hotbarSlots = this.buildInitialHotbar();

    this.registerPointerHandlers();
    this.registerWorldUpdater();
    this.registerMultiplayerListeners();

    this.dispatchHotbarUpdate();
    this.dispatchHotbarSelect();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.pointerObserver) {
      this.scene.onPointerObservable.remove(this.pointerObserver);
      this.pointerObserver = null;
    }
    if (this.updateObserver) {
      this.scene.onBeforeRenderObservable.remove(this.updateObserver);
      this.updateObserver = null;
    }
    if (this.canvas && this.contextMenuListener) {
      this.canvas.removeEventListener('contextmenu', this.contextMenuListener);
    }
    if (this.multiplayer) {
      this.multiplayer.removeEventListener('block:placed', this.handleBlockPlaced);
      this.multiplayer.removeEventListener('block:removed', this.handleBlockRemoved);
    }
  }

  getHotbarSlots(): GameHotbarSlot[] {
    return this.hotbarSlots.map((slot) => this.toPublicSlot(slot));
  }

  getSelectedHotbarIndex(): number {
    return this.selectedIndex;
  }

  selectHotbarIndex(index: number): void {
    if (index < 0 || index >= this.hotbarSlots.length) {
      return;
    }
    if (this.selectedIndex === index) {
      return;
    }
    this.selectedIndex = index;
    this.dispatchHotbarSelect();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
  }

  private buildInitialHotbar(): InternalHotbarSlot[] {
    const registry = this.world.getRegistry();
    const slots: InternalHotbarSlot[] = [];

    HOTBAR_KEYS.forEach((key, index) => {
      const preset = DEFAULT_HOTBAR_PRESET[index];
      if (!preset) {
        slots.push({ key, type: null, block: null });
        return;
      }
      const definition = registry.getByName(preset.type) ?? null;
      if (definition) {
        this.inventory.set(definition.name, preset.quantity);
      }
      slots.push({ key, type: definition?.name ?? null, block: definition });
    });

    return slots;
  }

  private registerPointerHandlers(): void {
    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.inputEnabled || pointerInfo.type !== PointerEventTypes.POINTERDOWN) {
        return;
      }
      const event = pointerInfo.event as PointerEvent;
      if (!(event.target instanceof HTMLCanvasElement) || event.target !== this.canvas) {
        return;
      }
      if (event.button === 2) {
        event.preventDefault();
      }
      const pickInfo = this.resolvePick(pointerInfo);
      if (!pickInfo || !pickInfo.hit) {
        if (event.button === 2) {
          this.dispatchFeedback('blocked');
        }
        return;
      }
      if (event.button === 0) {
        this.tryBreakBlock(pickInfo.pickedPoint, pickInfo.getNormal(true, true));
      } else if (event.button === 2) {
        this.tryPlaceBlock(pickInfo.pickedPoint, pickInfo.getNormal(true, true));
      }
    });

    if (this.canvas) {
      this.contextMenuListener = (event: MouseEvent) => {
        if (event.target === this.canvas) {
          event.preventDefault();
        }
      };
      this.canvas.addEventListener('contextmenu', this.contextMenuListener);
    }
  }

  private registerWorldUpdater(): void {
    this.updateObserver = this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      if (now - this.lastChunkUpdate < CHUNK_UPDATE_INTERVAL_MS) {
        return;
      }
      this.lastChunkUpdate = now;
      void this.world.update(this.camera.position);
    });
  }

  private registerMultiplayerListeners(): void {
    if (!this.multiplayer) {
      return;
    }
    this.multiplayer.addEventListener('block:placed', this.handleBlockPlaced);
    this.multiplayer.addEventListener('block:removed', this.handleBlockRemoved);
  }

  private handleBlockPlaced = (event: Event): void => {
    const detail = (event as CustomEvent<BlockPlacedEvent>).detail;
    this.world.applyBlockChange(detail.position, detail.type);
    const localSession = this.multiplayer?.getSessionId();
    if (localSession && detail.by === localSession) {
      this.adjustInventory(detail.type, -1);
    }
  };

  private handleBlockRemoved = (event: Event): void => {
    const detail = (event as CustomEvent<BlockRemovedEvent>).detail;
    const previous = this.world.getBlockDefinitionAt(detail.position);
    this.world.applyBlockChange(detail.position, 'air');
    const localSession = this.multiplayer?.getSessionId();
    if (localSession && detail.by === localSession && previous) {
      this.adjustInventory(previous.name, 1);
    }
  };

  private resolvePick(pointerInfo: PointerInfo) {
    if (pointerInfo.pickInfo?.hit) {
      return pointerInfo.pickInfo;
    }
    return this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh: AbstractMesh | null) => Boolean(mesh?.name?.startsWith('chunk-')),
    );
  }

  private tryBreakBlock(point: Nullable<Vector3>, normal: Nullable<Vector3>): void {
    if (!point || !normal) {
      return;
    }
    const offset = normal.scale(0.01);
    const target = point.subtract(offset);
    const position = this.toIntegerCoordinates(target);
    if (!position) {
      return;
    }
    this.multiplayer?.removeBlock({ position });
  }

  private tryPlaceBlock(point: Nullable<Vector3>, normal: Nullable<Vector3>): void {
    if (!point || !normal) {
      this.dispatchFeedback('blocked');
      return;
    }
    const slot = this.hotbarSlots[this.selectedIndex];
    if (!slot || !slot.type) {
      this.dispatchFeedback('empty');
      return;
    }
    const available = this.inventory.get(slot.type);
    if (typeof available === 'number' && available <= 0) {
      this.dispatchFeedback('empty');
      return;
    }

    const offset = normal.scale(0.51);
    const target = point.add(offset);
    const position = this.toIntegerCoordinates(target);
    if (!position) {
      this.dispatchFeedback('blocked');
      return;
    }

    this.multiplayer?.placeBlock({ position, type: slot.type });
  }

  private adjustInventory(type: string, delta: number): void {
    const current = this.inventory.get(type);
    if (current === undefined || current === 'infinite') {
      return;
    }
    const next = Math.max(0, current + delta);
    if (next === current) {
      return;
    }
    this.inventory.set(type, next);
    this.dispatchHotbarUpdate();
  }

  private dispatchHotbarUpdate(): void {
    const detail = this.getHotbarSlots();
    this.dispatchEvent(new CustomEvent<GameHotbarSlot[]>(HOTBAR_UPDATE_EVENT, { detail }));
  }

  private dispatchHotbarSelect(): void {
    this.dispatchEvent(
      new CustomEvent<number>(HOTBAR_SELECT_EVENT, { detail: this.selectedIndex }),
    );
  }

  private dispatchFeedback(reason: HotbarFeedbackDetail['reason']): void {
    const slot = this.hotbarSlots[this.selectedIndex];
    this.dispatchEvent(
      new CustomEvent<HotbarFeedbackDetail>(HOTBAR_FEEDBACK_EVENT, {
        detail: { slotKey: slot?.key ?? this.selectedIndex + 1, reason },
      }),
    );
  }

  private toPublicSlot(slot: InternalHotbarSlot): GameHotbarSlot {
    const quantity = slot.type ? this.inventory.get(slot.type) : null;
    return {
      key: slot.key,
      block: slot.block,
      type: slot.type,
      quantity: slot.type
        ? quantity === undefined
          ? 'infinite'
          : quantity
        : null,
    };
  }

  private toIntegerCoordinates(point: Vector3): Vector3Coordinates | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      return null;
    }
    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
      z: Math.round(point.z),
    };
  }
}

export type { QuantityValue };
export { HOTBAR_UPDATE_EVENT, HOTBAR_SELECT_EVENT, HOTBAR_FEEDBACK_EVENT };
