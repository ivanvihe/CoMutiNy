import path from 'path'
import { fileURLToPath } from 'url'
import { Umzug, SequelizeStorage } from 'umzug'
import { Sequelize } from 'sequelize'

import sequelize from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, 'seeders', '*.js'),
    resolve: ({ name, path: seederPath, context }) => {
      return {
        name,
        up: async () => {
          const seeder = await import(seederPath)
          return seeder.up({ context, Sequelize })
        },
        down: async () => {
          const seeder = await import(seederPath)
          return seeder.down({ context, Sequelize })
        }
      }
    }
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({
    sequelize,
    modelName: 'SequelizeData'
  }),
  logger: console
})

const runSeeders = async () => {
  await sequelize.authenticate()
  await umzug.up()
  await sequelize.close()
}

runSeeders().catch((error) => {
  console.error('Seeding failed:', error)
  process.exitCode = 1
})
