import { Column, Entity, Index, OneToMany, Relation } from 'typeorm';

import { AppBaseEntity } from './BaseEntity';
import { Building } from './Building';
import { ChatMessage } from './ChatMessage';

/**
 * Player account that can authenticate and interact with the world.
 */
@Entity({ name: 'users' })
@Index('idx_users_email_unique', ['email'], { unique: true })
export class User extends AppBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @OneToMany(() => Building, (building) => building.owner)
  buildings!: Relation<Building[]>;

  @OneToMany(() => ChatMessage, (message) => message.sender)
  messages!: Relation<ChatMessage[]>;
}
