import { Sequelize } from 'sequelize'

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'comutiny',
  DB_USER = 'postgres',
  DB_PASSWORD = 'postgres',
  DB_LOGGING = 'false'
} = process.env

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'postgres',
  logging: DB_LOGGING === 'true' ? console.log : false
})

export const connectDatabase = async () => {
  try {
    await sequelize.authenticate()
    console.log('Database connection has been established successfully.')
  } catch (error) {
    console.error('Unable to connect to the database:', error)
    throw error
  }
}

export default sequelize
