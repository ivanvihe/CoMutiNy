import { parseWorldParcels, isPointInsideParcel } from '../parcels';

interface WorldMetadata {
  metadata: Record<string, unknown> | null;
}

describe('parcels utilities', () => {
  describe('parseWorldParcels', () => {
    it('returns an empty array when metadata is missing', () => {
      const world: WorldMetadata = { metadata: null };

      expect(parseWorldParcels(world)).toEqual([]);
    });

    it('filters out invalid parcels and normalizes numeric values', () => {
      const world: WorldMetadata = {
        metadata: {
          parcels: [
            {
              id: 'parcel-1',
              ownerId: 'owner-1',
              x: 2.9,
              y: 1.2,
              width: 3.7,
              height: 4.1,
              allowPublic: true,
            },
            {
              id: '',
              ownerId: 'missing',
            },
            'not-a-parcel',
          ],
        },
      };

      const result = parseWorldParcels(world);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'parcel-1',
        ownerId: 'owner-1',
        x: 2,
        y: 1,
        width: 3,
        height: 4,
        allowPublic: true,
      });
    });

    it('defaults allowPublic to false when omitted', () => {
      const world: WorldMetadata = {
        metadata: {
          parcels: [
            { id: 'parcel-1', ownerId: 'owner-1', x: 0, y: 0, width: 1, height: 1 },
          ],
        },
      };

      expect(parseWorldParcels(world)[0].allowPublic).toBe(false);
    });
  });

  describe('isPointInsideParcel', () => {
    const parcel = {
      id: 'parcel-1',
      ownerId: 'owner-1',
      x: 2,
      y: 3,
      width: 2,
      height: 2,
      allowPublic: false,
    } as const;

    it('returns true when coordinates fall inside the parcel bounds', () => {
      expect(isPointInsideParcel(parcel, 2, 4)).toBe(true);
    });

    it('returns false when coordinates are outside the parcel bounds', () => {
      expect(isPointInsideParcel(parcel, 4, 5)).toBe(false);
    });
  });
});
