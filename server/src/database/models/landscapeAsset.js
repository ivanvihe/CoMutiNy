import { DataTypes } from 'sequelize'

const defineLandscapeAsset = (sequelize) => {
  const LandscapeAsset = sequelize.define('LandscapeAsset', {
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
    tableName: 'landscape_assets',
    underscored: true
  })

  return LandscapeAsset
}

export default defineLandscapeAsset
