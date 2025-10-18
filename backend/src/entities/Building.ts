import { Column, Entity, Index, JoinColumn, ManyToOne, Relation } from 'typeorm';

import { AppBaseEntity } from './BaseEntity';
import { User } from './User';
import { WorldState } from './WorldState';

/**
 * Structure owned by a player and positioned in the world grid.
 */
@Entity({ name: 'buildings' })
@Index('idx_buildings_world_coordinates_unique', ['world', 'x', 'y'], { unique: true })
export class Building extends AppBaseEntity {
  @Column({ type: 'varchar', length: 120 })
  type!: string;

  @Column({ type: 'integer' })
  x!: number;

  @Column({ type: 'integer' })
  y!: number;

  @ManyToOne(() => User, (user) => user.buildings, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: Relation<User>;

  @ManyToOne(() => WorldState, (world) => world.buildings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'world_id' })
  world!: Relation<WorldState>;
}
