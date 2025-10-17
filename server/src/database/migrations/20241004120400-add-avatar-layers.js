export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.addColumn('avatars', 'layer_hair', {
    type: Sequelize.STRING(100),
    allowNull: true
  })

  await queryInterface.addColumn('avatars', 'layer_face', {
    type: Sequelize.STRING(100),
    allowNull: true
  })

  await queryInterface.addColumn('avatars', 'layer_outfit', {
    type: Sequelize.STRING(100),
    allowNull: true
  })

  await queryInterface.addColumn('avatars', 'layer_shoes', {
    type: Sequelize.STRING(100),
    allowNull: true
  })
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.removeColumn('avatars', 'layer_shoes')
  await queryInterface.removeColumn('avatars', 'layer_outfit')
  await queryInterface.removeColumn('avatars', 'layer_face')
  await queryInterface.removeColumn('avatars', 'layer_hair')
}
