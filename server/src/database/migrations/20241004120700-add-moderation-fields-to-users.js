import { DataTypes } from 'sequelize'

export const up = async ({ context: queryInterface }) => {
  await queryInterface.addColumn('users', 'is_banned', {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })

  await queryInterface.addColumn('users', 'suspension_until', {
    type: DataTypes.DATE,
    allowNull: true
  })

  await queryInterface.addColumn('users', 'moderation_reason', {
    type: DataTypes.TEXT,
    allowNull: true
  })

  await queryInterface.addIndex('users', {
    fields: ['is_banned']
  })

  await queryInterface.addIndex('users', {
    fields: ['suspension_until']
  })
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.removeIndex('users', ['suspension_until'])
  await queryInterface.removeIndex('users', ['is_banned'])

  await queryInterface.removeColumn('users', 'moderation_reason')
  await queryInterface.removeColumn('users', 'suspension_until')
  await queryInterface.removeColumn('users', 'is_banned')
}
