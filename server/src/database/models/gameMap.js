import { DataTypes } from 'sequelize'

const defineGameMap = (sequelize) => {
  const GameMap = sequelize.define('GameMap', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    biome: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    width: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    height: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    spawnX: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'spawn_x'
    },
    spawnY: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'spawn_y'
    },
    palette: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    blockedAreas: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'blocked_areas'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    tableName: 'maps',
    underscored: true
  })

  return GameMap
}

export default defineGameMap
