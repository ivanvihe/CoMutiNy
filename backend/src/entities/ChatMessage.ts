import { Column, Entity, JoinColumn, ManyToOne, Relation } from 'typeorm';

import { AppBaseEntity } from './BaseEntity';
import { User } from './User';
import { WorldState } from './WorldState';

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
}
