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
        scope: 'global',
        isPersistent: true,
        chunkId: null,
      });
      expect(chatRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
      expect(result.scope).toBe('global');
      expect(result.isPersistent).toBe(true);
      expect(result.chunkId).toBeNull();
    });

    it('creates an ephemeral message when persistence is disabled', async () => {
      const result = await service.postMessage({
        content: 'Local',
        sender,
        world,
        persist: false,
        scope: 'proximity',
        chunkId: '0:0',
      });

      expect(chatRepository.create).not.toHaveBeenCalled();
      expect(chatRepository.save).not.toHaveBeenCalled();
      expect(result.scope).toBe('proximity');
      expect(result.isPersistent).toBe(false);
      expect(result.chunkId).toBe('0:0');
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getRecentMessages', () => {
    it('defaults to the service limit when none provided', async () => {
      await service.getRecentMessages(world.id);

      expect(chatRepository.find).toHaveBeenCalledWith({
        where: { world: { id: world.id }, isPersistent: true },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });

    it('applies a custom limit when provided', async () => {
      await service.getRecentMessages(world.id, 10);

      expect(chatRepository.find).toHaveBeenCalledWith({
        where: { world: { id: world.id }, isPersistent: true },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });
});
