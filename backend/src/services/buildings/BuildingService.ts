import { Repository } from 'typeorm';

import { Building, User, WorldState } from '../../entities';
import { isPointInsideParcel, parseWorldParcels } from './parcels';

export interface BuildingPlacementRequest {
  worldId: string;
  owner: User;
  type: string;
  x: number;
  y: number;
}

export interface IBuildingService {
  validatePlacement(worldId: string, owner: User, x: number, y: number): Promise<WorldState>;
  createBuilding(request: BuildingPlacementRequest): Promise<Building>;
  getBuildingsForWorld(worldId: string): Promise<Building[]>;
}

export class BuildingService implements IBuildingService {
  constructor(
    private readonly buildingRepository: Repository<Building>,
    private readonly worldRepository: Repository<WorldState>,
  ) {}

  public async validatePlacement(worldId: string, owner: User, x: number, y: number): Promise<WorldState> {
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

    this.ensurePlacementWithinParcels(world, owner, x, y);

    return world;
  }

  public async createBuilding(request: BuildingPlacementRequest): Promise<Building> {
    const world = await this.validatePlacement(request.worldId, request.owner, request.x, request.y);

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

  private ensurePlacementWithinParcels(world: WorldState, owner: User, x: number, y: number): void {
    const parcels = parseWorldParcels(world);

    if (parcels.length === 0) {
      return;
    }

    const containingParcel = parcels.find((parcel) => isPointInsideParcel(parcel, x, y));

    if (!containingParcel) {
      throw new Error('Tile is not within an assigned parcel.');
    }

    if (containingParcel.ownerId !== owner.id && !containingParcel.allowPublic) {
      throw new Error('You are not allowed to build on this parcel.');
    }
  }
}
