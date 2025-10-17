import { DataTypes } from 'sequelize'

const defineAvatar = (sequelize) => {
  const Avatar = sequelize.define('Avatar', {
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
    spriteAssetId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'sprite_asset_id'
    },
    layerHair: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'layer_hair'
    },
    layerFace: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'layer_face'
    },
    layerOutfit: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'layer_outfit'
    },
    layerShoes: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'layer_shoes'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'avatars',
    underscored: true
  })

  return Avatar
}

export default defineAvatar
