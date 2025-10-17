import { DataTypes } from 'sequelize'

const defineSpriteAsset = (sequelize) => {
  const SpriteAsset = sequelize.define('SpriteAsset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    imageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
      field: 'image_url'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'sprite_assets',
    underscored: true
  })

  return SpriteAsset
}

export default defineSpriteAsset
