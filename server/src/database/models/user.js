import { DataTypes } from 'sequelize'

const defineUser = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user'
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_banned'
    },
    suspensionUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'suspension_until'
    },
    moderationReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'moderation_reason'
    }
  }, {
    tableName: 'users',
    underscored: true
  })

  return User
}

export default defineUser
