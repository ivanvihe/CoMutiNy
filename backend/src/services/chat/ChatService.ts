import { Repository } from 'typeorm';

import { ChatMessage, User, WorldState } from '../../entities';

export interface ChatMessagePayload {
  world: WorldState;
  sender: User;
  content: string;
}

export interface IChatService {
  postMessage(payload: ChatMessagePayload): Promise<ChatMessage>;
  getRecentMessages(worldId: string, limit?: number): Promise<ChatMessage[]>;
}

export class ChatService implements IChatService {
  private static readonly DEFAULT_LIMIT = 50;

  constructor(private readonly chatRepository: Repository<ChatMessage>) {}

  public async postMessage(payload: ChatMessagePayload): Promise<ChatMessage> {
    if (!payload.content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const message = this.chatRepository.create({
      content: payload.content,
      sender: payload.sender,
      world: payload.world,
    });

    return this.chatRepository.save(message);
  }

  public getRecentMessages(
    worldId: string,
    limit = ChatService.DEFAULT_LIMIT,
  ): Promise<ChatMessage[]> {
    return this.chatRepository.find({
      where: { world: { id: worldId } },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
