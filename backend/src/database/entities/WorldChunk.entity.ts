import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'world_chunks' })
export class WorldChunkEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Index()
  @Column({ type: 'integer' })
  chunkX!: number;

  @Index()
  @Column({ type: 'integer' })
  chunkY!: number;

  @Index()
  @Column({ type: 'integer' })
  chunkZ!: number;

  @Column({ type: 'text', nullable: true })
  data!: string | null;

  @Column({ type: 'text', nullable: false, default: '[]', name: 'blocks_json' })
  blocksJson!: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
