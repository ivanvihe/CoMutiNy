import { DataTypes } from 'sequelize'

const defineMessage = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    avatarId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'avatar_id'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'messages',
    underscored: true
  })

  return Message
}

export default defineMessage
