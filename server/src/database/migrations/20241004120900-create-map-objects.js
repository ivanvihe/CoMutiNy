export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.createTable('map_objects', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()')
    },
    map_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'maps',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    name: {
      type: Sequelize.STRING(120),
      allowNull: false
    },
    type: {
      type: Sequelize.STRING(60),
      allowNull: true
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    solid: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    position: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { x: 0, y: 0 }
    },
    size: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { width: 1, height: 1 }
    },
    palette: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    },
    actions: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    },
    metadata: {
      type: Sequelize.JSONB,
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
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('map_objects')
}
