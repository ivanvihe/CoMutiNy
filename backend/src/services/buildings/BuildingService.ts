import { Repository } from 'typeorm';

import { Building, User, WorldState } from '../../entities';

export interface BuildingPlacementRequest {
  worldId: string;
  owner: User;
  type: string;
  x: number;
  y: number;
}

export interface IBuildingService {
  validatePlacement(worldId: string, x: number, y: number): Promise<WorldState>;
  createBuilding(request: BuildingPlacementRequest): Promise<Building>;
  getBuildingsForWorld(worldId: string): Promise<Building[]>;
}

export class BuildingService implements IBuildingService {
  constructor(
    private readonly buildingRepository: Repository<Building>,
    private readonly worldRepository: Repository<WorldState>,
  ) {}

  public async validatePlacement(worldId: string, x: number, y: number): Promise<WorldState> {
    const world = await this.worldRepository.findOne({ where: { id: worldId } });

    if (!world) {
      throw new Error('World not found');
    }

    if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
      throw new Error('Coordinates are outside of the world bounds');
    }

    const existingBuilding = await this.buildingRepository.findOne({
      where: {
        world: { id: worldId },
        x,
        y,
      },
      relations: ['world'],
    });

    if (existingBuilding) {
      throw new Error('Tile already occupied by another building');
    }

    return world;
  }

  public async createBuilding(request: BuildingPlacementRequest): Promise<Building> {
    const world = await this.validatePlacement(request.worldId, request.x, request.y);

    const building = this.buildingRepository.create({
      owner: request.owner,
      world,
      type: request.type,
      x: request.x,
      y: request.y,
    });

    return this.buildingRepository.save(building);
  }

  public getBuildingsForWorld(worldId: string): Promise<Building[]> {
    return this.buildingRepository.find({ where: { world: { id: worldId } } });
  }
}
