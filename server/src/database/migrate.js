import path from 'path'
import { fileURLToPath } from 'url'
import { Umzug, SequelizeStorage } from 'umzug'
import { Sequelize } from 'sequelize'

import sequelize from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'migrations', '*.js'),
    resolve: ({ name, path: migrationPath, context }) => {
      return {
        name,
        up: async () => {
          const migration = await import(migrationPath)
          return migration.up({ context, Sequelize })
        },
        down: async () => {
          const migration = await import(migrationPath)
          return migration.down({ context, Sequelize })
        }
      }
    }
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console
})

const runMigrations = async () => {
  await sequelize.authenticate()
  await umzug.up()
  await sequelize.close()
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})
