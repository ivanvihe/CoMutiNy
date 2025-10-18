import { Repository } from 'typeorm';

import { Building, User, WorldState } from '../../../entities';
import { BuildingService } from '../BuildingService';

describe('BuildingService', () => {
  let buildingRepository: jest.Mocked<Repository<Building>>;
  let worldRepository: jest.Mocked<Repository<WorldState>>;
  let service: BuildingService;
  let world: WorldState;
  let owner: User;

  beforeEach(() => {
    buildingRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Building>>;

    worldRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<WorldState>>;

    service = new BuildingService(buildingRepository, worldRepository);

    world = new WorldState();
    world.id = 'world-1';
    world.name = 'Test World';
    world.width = 4;
    world.height = 4;

    owner = new User();
    owner.id = 'user-1';
    owner.displayName = 'Tester';
    owner.email = 'test@example.com';
    owner.passwordHash = 'hash';
  });

  describe('validatePlacement', () => {
    it('throws when world does not exist', async () => {
      worldRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement('missing', 0, 0)).rejects.toThrow('World not found');
    });

    it('throws when coordinates are outside bounds', async () => {
      worldRepository.findOne.mockResolvedValue(world);

      await expect(service.validatePlacement(world.id, 10, 0)).rejects.toThrow(
        'Coordinates are outside of the world bounds',
      );
    });

    it('throws when tile already occupied', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue({} as Building);

      await expect(service.validatePlacement(world.id, 1, 1)).rejects.toThrow(
        'Tile already occupied by another building',
      );
    });

    it('returns world when placement is valid', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement(world.id, 1, 1)).resolves.toBe(world);
    });
  });

  describe('createBuilding', () => {
    it('creates a building when placement is valid', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      const createdBuilding = new Building();
      buildingRepository.create.mockReturnValue(createdBuilding);
      buildingRepository.save.mockResolvedValue(createdBuilding);

      const result = await service.createBuilding({
        owner,
        type: 'house',
        worldId: world.id,
        x: 1,
        y: 1,
      });

      expect(buildingRepository.create).toHaveBeenCalledWith({
        owner,
        world,
        type: 'house',
        x: 1,
        y: 1,
      });
      expect(buildingRepository.save).toHaveBeenCalledWith(createdBuilding);
      expect(result).toBe(createdBuilding);
    });
  });
});
