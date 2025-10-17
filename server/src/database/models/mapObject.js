import { DataTypes } from 'sequelize'

const defineMapObject = (sequelize) => {
  const MapObject = sequelize.define('MapObject', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    mapId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'map_id'
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    solid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    position: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { x: 0, y: 0 }
    },
    size: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { width: 1, height: 1 }
    },
    palette: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    actions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'map_objects',
    underscored: true
  })

  return MapObject
}

export default defineMapObject
