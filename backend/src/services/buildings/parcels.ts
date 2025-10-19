import { WorldState } from '../../entities';

export interface ParcelDefinition {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowPublic?: boolean;
}

type RawParcel = Partial<ParcelDefinition> & Record<string, unknown>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const normalizeParcel = (parcel: RawParcel): ParcelDefinition | null => {
  if (typeof parcel.id !== 'string' || parcel.id.trim() === '') {
    return null;
  }

  if (typeof parcel.ownerId !== 'string' || parcel.ownerId.trim() === '') {
    return null;
  }

  if (!isFiniteNumber(parcel.x) || !isFiniteNumber(parcel.y)) {
    return null;
  }

  if (!isFiniteNumber(parcel.width) || !isFiniteNumber(parcel.height)) {
    return null;
  }

  if (parcel.width <= 0 || parcel.height <= 0) {
    return null;
  }

  const allowPublic = isBoolean(parcel.allowPublic) ? parcel.allowPublic : false;

  return {
    id: parcel.id,
    ownerId: parcel.ownerId,
    x: Math.floor(parcel.x),
    y: Math.floor(parcel.y),
    width: Math.floor(parcel.width),
    height: Math.floor(parcel.height),
    allowPublic,
  };
};

export const parseWorldParcels = (world: Pick<WorldState, 'metadata'>): ParcelDefinition[] => {
  const metadata = world.metadata;

  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const parcels = (metadata as Record<string, unknown>).parcels;

  if (!Array.isArray(parcels)) {
    return [];
  }

  return parcels
    .map((parcel) => normalizeParcel(parcel as RawParcel))
    .filter((parcel): parcel is ParcelDefinition => Boolean(parcel));
};

export const isPointInsideParcel = (parcel: ParcelDefinition, x: number, y: number): boolean => {
  return (
    x >= parcel.x &&
    y >= parcel.y &&
    x < parcel.x + parcel.width &&
    y < parcel.y + parcel.height
  );
};
