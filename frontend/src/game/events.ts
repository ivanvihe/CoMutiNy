import Phaser from 'phaser';
import type { BuildBlueprint, BuildPlacementStatus } from '../buildings/types';

export const GameEvent = {
  BuildSelect: 'build:select',
  BuildPlacementResult: 'build:placementResult',
  ChatSend: 'chat:send',
  ChatTyping: 'chat:typing',
  ChatMessage: 'chat:message',
  ChatHistory: 'chat:history',
  ChatTypingStatus: 'chat:typingStatus',
} as const;

export type GameEventName = (typeof GameEvent)[keyof typeof GameEvent];

export interface BuildSelectPayload {
  blueprint: BuildBlueprint | null;
}

export type ChatScope = 'global' | 'proximity' | 'system';

export interface ChatMessageEvent {
  id: string;
  senderId: string | null;
  senderName: string;
  content: string;
  timestamp: number;
  scope: ChatScope;
  persistent: boolean;
  chunkId: string | null;
}

export interface ChatHistoryEvent {
  messages: ChatMessageEvent[];
}

export interface ChatSendPayload {
  content: string;
  scope: Exclude<ChatScope, 'system'>;
  persist?: boolean;
}

export interface ChatTypingPayload {
  scope: Exclude<ChatScope, 'system'>;
  typing: boolean;
}

export interface ChatTypingStatusPayload {
  scope: ChatScope;
  userId: string;
  displayName: string;
  typing: boolean;
  chunkId: string | null;
}

export const gameEvents = new Phaser.Events.EventEmitter();

export const emitBuildSelection = (blueprint: BuildBlueprint | null): void => {
  const payload: BuildSelectPayload = { blueprint };
  gameEvents.emit(GameEvent.BuildSelect, payload);
};

export const emitBuildPlacementResult = (status: BuildPlacementStatus): void => {
  gameEvents.emit(GameEvent.BuildPlacementResult, status);
};

export const emitChatSend = (payload: ChatSendPayload): void => {
  gameEvents.emit(GameEvent.ChatSend, payload);
};

export const emitChatTyping = (payload: ChatTypingPayload): void => {
  gameEvents.emit(GameEvent.ChatTyping, payload);
};
