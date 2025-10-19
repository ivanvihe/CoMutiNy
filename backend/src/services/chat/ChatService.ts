import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { ChatMessage, ChatScope, User, WorldState } from '../../entities';

export interface ChatMessagePayload {
  world: WorldState;
  sender: User;
  content: string;
  scope?: ChatScope;
  persist?: boolean;
  chunkId?: string | null;
}

export interface IChatService {
  postMessage(payload: ChatMessagePayload): Promise<ChatMessage>;
  getRecentMessages(worldId: string, limit?: number): Promise<ChatMessage[]>;
}

export class ChatService implements IChatService {
  private static readonly DEFAULT_LIMIT = 50;

  constructor(private readonly chatRepository: Repository<ChatMessage>) {}

  public async postMessage(payload: ChatMessagePayload): Promise<ChatMessage> {
    const content = payload.content.trim();

    if (!content) {
      throw new Error('Message content cannot be empty');
    }

    const scope = payload.scope ?? 'global';
    const persist = payload.persist ?? true;
    const chunkId = payload.chunkId ?? null;

    if (!persist) {
      const transient = new ChatMessage();
      transient.id = randomUUID();
      transient.content = content;
      transient.sender = payload.sender;
      transient.world = payload.world;
      transient.scope = scope;
      transient.isPersistent = false;
      transient.chunkId = chunkId;
      const now = new Date();
      transient.createdAt = now;
      transient.updatedAt = now;
      return transient;
    }

    const message = this.chatRepository.create({
      content,
      sender: payload.sender,
      world: payload.world,
      scope,
      isPersistent: true,
      chunkId,
    });

    const saved = await this.chatRepository.save(message);
    saved.sender = payload.sender;
    saved.world = payload.world;
    saved.scope = scope;
    saved.isPersistent = true;
    saved.chunkId = chunkId;
    return saved;
  }

  public getRecentMessages(
    worldId: string,
    limit = ChatService.DEFAULT_LIMIT,
  ): Promise<ChatMessage[]> {
    return this.chatRepository.find({
      where: { world: { id: worldId }, isPersistent: true },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
