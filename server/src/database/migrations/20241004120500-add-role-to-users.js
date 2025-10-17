export const up = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.addColumn('users', 'role', {
    type: Sequelize.ENUM('user', 'admin'),
    allowNull: false,
    defaultValue: 'user'
  })
}

export const down = async ({ context: queryInterface, Sequelize }) => {
  await queryInterface.removeColumn('users', 'role')
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";')
}
