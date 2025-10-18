import { Column, Entity, OneToMany, Relation } from 'typeorm';

import { AppBaseEntity } from './BaseEntity';
import { Building } from './Building';
import { ChatMessage } from './ChatMessage';

/**
 * Snapshot representing the shared state of the world map.
 */
@Entity({ name: 'world_states' })
export class WorldState extends AppBaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'integer' })
  width!: number;

  @Column({ type: 'integer' })
  height!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @OneToMany(() => Building, (building) => building.world)
  buildings!: Relation<Building[]>;

  @OneToMany(() => ChatMessage, (message) => message.world)
  chatMessages!: Relation<ChatMessage[]>;
}
