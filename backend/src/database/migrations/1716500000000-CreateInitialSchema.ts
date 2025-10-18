import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInitialSchema1716500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'display_name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'password_hash',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'idx_users_email_unique',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'world_states',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'width',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'height',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'buildings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'x',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'y',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'owner_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'world_id',
            type: 'uuid',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'buildings',
      new TableIndex({
        name: 'idx_buildings_world_coordinates_unique',
        columnNames: ['world_id', 'x', 'y'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'buildings',
      new TableForeignKey({
        name: 'fk_buildings_owner_id_users',
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'buildings',
      new TableForeignKey({
        name: 'fk_buildings_world_id_world_states',
        columnNames: ['world_id'],
        referencedTableName: 'world_states',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'chat_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'content',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'sender_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'world_id',
            type: 'uuid',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        name: 'fk_chat_messages_sender_id_users',
        columnNames: ['sender_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'chat_messages',
      new TableForeignKey({
        name: 'fk_chat_messages_world_id_world_states',
        columnNames: ['world_id'],
        referencedTableName: 'world_states',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('chat_messages', 'fk_chat_messages_sender_id_users');
    await queryRunner.dropForeignKey('chat_messages', 'fk_chat_messages_world_id_world_states');
    await queryRunner.dropTable('chat_messages');

    await queryRunner.dropForeignKey('buildings', 'fk_buildings_owner_id_users');
    await queryRunner.dropForeignKey('buildings', 'fk_buildings_world_id_world_states');
    await queryRunner.dropIndex('buildings', 'idx_buildings_world_coordinates_unique');
    await queryRunner.dropTable('buildings');

    await queryRunner.dropTable('world_states');
    await queryRunner.dropIndex('users', 'idx_users_email_unique');
    await queryRunner.dropTable('users');
  }
}
