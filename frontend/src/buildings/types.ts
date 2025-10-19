export type BuildCategory = 'houses' | 'decorations' | 'paths';

export interface BuildBlueprint {
  id: string;
  name: string;
  type: string;
  category: BuildCategory;
  description?: string;
  previewColor: string;
}

export interface ParcelDefinition {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  allowPublic?: boolean;
}

export interface WorldInfoPayload {
  width: number;
  height: number;
  parcels: ParcelDefinition[];
  assignedParcelIds: string[];
}

export type BuildPlacementResultStatus = 'pending' | 'success' | 'error';

export interface BuildPlacementStatus {
  status: BuildPlacementResultStatus;
  message: string;
}
