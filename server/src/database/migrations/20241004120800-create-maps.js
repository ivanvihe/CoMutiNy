export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.createTable('maps', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()')
    },
    slug: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: Sequelize.STRING(120),
      allowNull: false
    },
    biome: {
      type: Sequelize.STRING(80),
      allowNull: true
    },
    description: {
      type: Sequelize.TEXT,
      allowNull: true
    },
    width: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    height: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    spawn_x: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    spawn_y: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    palette: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    },
    blocked_areas: {
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
  await queryInterface.dropTable('maps')
}
