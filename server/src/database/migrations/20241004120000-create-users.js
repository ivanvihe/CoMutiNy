export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

  await queryInterface.createTable('users', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()')
    },
    username: {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true
    },
    password_hash: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW')
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW')
    }
  })
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('users')
}
