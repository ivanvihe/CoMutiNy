import { Repository } from 'typeorm';

import { Building, User, WorldState } from '../../../entities';
import { BuildingService } from '../BuildingService';

describe('BuildingService', () => {
  let buildingRepository: jest.Mocked<Repository<Building>>;
  let worldRepository: jest.Mocked<Repository<WorldState>>;
  let service: BuildingService;
  let world: WorldState;
  let owner: User;
  let otherOwner: User;

  beforeEach(() => {
    buildingRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
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

    otherOwner = new User();
    otherOwner.id = 'user-2';
    otherOwner.displayName = 'Other';
    otherOwner.email = 'other@example.com';
    otherOwner.passwordHash = 'hash';
  });

  describe('validatePlacement', () => {
    it('throws when world does not exist', async () => {
      worldRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement('missing', owner, 0, 0)).rejects.toThrow('World not found');
    });

    it('throws when coordinates are outside bounds', async () => {
      worldRepository.findOne.mockResolvedValue(world);

      await expect(service.validatePlacement(world.id, owner, 10, 0)).rejects.toThrow(
        'Coordinates are outside of the world bounds',
      );
    });

    it('throws when tile already occupied', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue({} as Building);

      await expect(service.validatePlacement(world.id, owner, 1, 1)).rejects.toThrow(
        'Tile already occupied by another building',
      );
    });

    it('returns world when placement is valid', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement(world.id, owner, 1, 1)).resolves.toBe(world);
    });

    it('throws when tile is not within an assigned parcel', async () => {
      world.metadata = {
        parcels: [
          { id: 'parcel-1', ownerId: owner.id, x: 0, y: 0, width: 2, height: 2 },
        ],
      };
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement(world.id, owner, 3, 3)).rejects.toThrow(
        'Tile is not within an assigned parcel.',
      );
    });

    it('throws when tile belongs to a different owner without public access', async () => {
      world.metadata = {
        parcels: [
          { id: 'parcel-1', ownerId: otherOwner.id, x: 0, y: 0, width: 2, height: 2 },
        ],
      };
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement(world.id, owner, 1, 1)).rejects.toThrow(
        'You are not allowed to build on this parcel.',
      );
    });

    it('allows placement on a public parcel owned by someone else', async () => {
      world.metadata = {
        parcels: [
          { id: 'parcel-1', ownerId: otherOwner.id, x: 0, y: 0, width: 2, height: 2, allowPublic: true },
        ],
      };
      worldRepository.findOne.mockResolvedValue(world);
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.validatePlacement(world.id, owner, 1, 1)).resolves.toBe(world);
    });
  });

  describe('createBuilding', () => {
    it('creates a building when placement is valid', async () => {
      worldRepository.findOne.mockResolvedValue(world);
      world.metadata = {
        parcels: [
          { id: 'parcel-1', ownerId: owner.id, x: 0, y: 0, width: 4, height: 4 },
        ],
      };
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

  describe('removeBuilding', () => {
    it('throws when the building does not exist', async () => {
      buildingRepository.findOne.mockResolvedValue(null);

      await expect(service.removeBuilding('missing', owner)).rejects.toThrow('Building not found');
      expect(buildingRepository.remove).not.toHaveBeenCalled();
    });

    it('throws when requester does not own the building', async () => {
      const building = new Building();
      building.id = 'building-1';
      building.owner = otherOwner;
      building.world = world;
      buildingRepository.findOne.mockResolvedValue(building);

      await expect(service.removeBuilding(building.id, owner)).rejects.toThrow(
        'You are not allowed to remove this building.',
      );
      expect(buildingRepository.remove).not.toHaveBeenCalled();
    });

    it('removes a building owned by the requester', async () => {
      const building = new Building();
      building.id = 'building-1';
      building.owner = owner;
      building.world = world;
      building.x = 1;
      building.y = 2;
      buildingRepository.findOne.mockResolvedValue(building);
      buildingRepository.remove.mockResolvedValue(building);

      await expect(service.removeBuilding(building.id, owner)).resolves.toBe(building);

      expect(buildingRepository.findOne).toHaveBeenCalledWith({
        where: { id: building.id },
        relations: ['owner', 'world'],
      });
      expect(buildingRepository.remove).toHaveBeenCalledWith(building);
    });
  });
});
