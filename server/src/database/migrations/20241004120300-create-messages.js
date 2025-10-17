export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.createTable('messages', {
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
    avatar_id: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'avatars',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    content: {
      type: Sequelize.TEXT,
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

  await queryInterface.addIndex('messages', ['user_id'])
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('messages')
}
