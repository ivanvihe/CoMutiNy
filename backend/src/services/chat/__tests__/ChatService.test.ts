import { Repository } from 'typeorm';

import { ChatMessage, User, WorldState } from '../../../entities';
import { ChatService } from '../ChatService';

describe('ChatService', () => {
  let chatRepository: jest.Mocked<Repository<ChatMessage>>;
  let service: ChatService;
  let sender: User;
  let world: WorldState;

  beforeEach(() => {
    chatRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<ChatMessage>>;

    service = new ChatService(chatRepository);

    sender = new User();
    sender.id = 'user-1';

    world = new WorldState();
    world.id = 'world-1';
  });

  describe('postMessage', () => {
    it('throws when the content is blank', async () => {
      await expect(
        service.postMessage({
          content: '   ',
          sender,
          world,
        }),
      ).rejects.toThrow('Message content cannot be empty');
    });

    it('persists a message when content is provided', async () => {
      const created = new ChatMessage();
      chatRepository.create.mockReturnValue(created);
      chatRepository.save.mockResolvedValue(created);

      const result = await service.postMessage({
        content: 'Hello world',
        sender,
        world,
      });

      expect(chatRepository.create).toHaveBeenCalledWith({
        content: 'Hello world',
        sender,
        world,
      });
      expect(chatRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });

  describe('getRecentMessages', () => {
    it('defaults to the service limit when none provided', async () => {
      await service.getRecentMessages(world.id);

      expect(chatRepository.find).toHaveBeenCalledWith({
        where: { world: { id: world.id } },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('applies a custom limit when provided', async () => {
      await service.getRecentMessages(world.id, 10);

      expect(chatRepository.find).toHaveBeenCalledWith({
        where: { world: { id: world.id } },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });
});
