import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddChatMessageScope1717201000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'chat_messages',
      new TableColumn({
        name: 'scope',
        type: 'varchar',
        length: '16',
        isNullable: false,
        default: `'global'`,
      }),
    );

    await queryRunner.addColumn(
      'chat_messages',
      new TableColumn({
        name: 'is_persistent',
        type: 'boolean',
        isNullable: false,
        default: true,
      }),
    );

    await queryRunner.addColumn(
      'chat_messages',
      new TableColumn({
        name: 'chunk_id',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('chat_messages', 'chunk_id');
    await queryRunner.dropColumn('chat_messages', 'is_persistent');
    await queryRunner.dropColumn('chat_messages', 'scope');
  }
}
