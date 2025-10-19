import Phaser from 'phaser';
import type { BuildBlueprint, BuildPlacementStatus } from '../buildings/types';

export const GameEvent = {
  BuildSelect: 'build:select',
  BuildPlacementResult: 'build:placementResult',
} as const;

export type GameEventName = (typeof GameEvent)[keyof typeof GameEvent];

export interface BuildSelectPayload {
  blueprint: BuildBlueprint | null;
}

export const gameEvents = new Phaser.Events.EventEmitter();

export const emitBuildSelection = (blueprint: BuildBlueprint | null): void => {
  const payload: BuildSelectPayload = { blueprint };
  gameEvents.emit(GameEvent.BuildSelect, payload);
};

export const emitBuildPlacementResult = (status: BuildPlacementStatus): void => {
  gameEvents.emit(GameEvent.BuildPlacementResult, status);
};
