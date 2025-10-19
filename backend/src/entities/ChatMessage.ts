import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';

import { AppBaseEntity } from './BaseEntity';
import { User } from './User';
import { WorldState } from './WorldState';

export type ChatScope = 'global' | 'proximity' | 'system';

/**
 * Message sent by a player in the world chat.
 */
@Entity({ name: 'chat_messages' })
export class ChatMessage extends AppBaseEntity {
  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => User, (user) => user.messages, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender!: Relation<User>;

  @ManyToOne(() => WorldState, (world) => world.chatMessages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'world_id' })
  world!: Relation<WorldState>;

  @Column({ type: 'varchar', length: 16, default: 'global' })
  scope!: ChatScope;

  @Column({ name: 'is_persistent', type: 'boolean', default: true })
  isPersistent!: boolean;

  @Column({ name: 'chunk_id', type: 'varchar', length: 32, nullable: true })
  chunkId!: string | null;
}
