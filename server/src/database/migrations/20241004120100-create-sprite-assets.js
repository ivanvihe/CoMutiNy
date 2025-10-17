export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.createTable('sprite_assets', {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal('uuid_generate_v4()')
    },
    name: {
      type: Sequelize.STRING(100),
      allowNull: false
    },
    category: {
      type: Sequelize.STRING(50),
      allowNull: false
    },
    image_url: {
      type: Sequelize.STRING(2048),
      allowNull: false
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
  await queryInterface.dropTable('sprite_assets')
}
