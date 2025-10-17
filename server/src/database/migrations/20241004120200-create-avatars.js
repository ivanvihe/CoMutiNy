export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.createTable('avatars', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()')
    },
    user_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    sprite_asset_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'sprite_assets',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
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

  await queryInterface.addIndex('avatars', ['user_id'])
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('avatars')
}
