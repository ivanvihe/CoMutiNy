import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAdminUserSupport1718000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL');

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'is_admin',
        type: 'boolean',
        isNullable: false,
        default: 'false',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'is_admin');

    await queryRunner.query('ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL');
  }
}
