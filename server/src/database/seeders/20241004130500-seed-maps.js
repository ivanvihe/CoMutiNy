import { randomUUID } from 'crypto'

const now = new Date()
const mapId = randomUUID()
const terminalId = randomUUID()
const welcomeActionId = randomUUID()

const maps = [
  {
    id: mapId,
    slug: 'hello-world',
    name: 'Hello World',
    biome: 'Demo',
    description: 'Un pequeño mundo de bienvenida para explorar los controles básicos.',
    width: 7,
    height: 7,
    spawn_x: 3,
    spawn_y: 3,
    palette: ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c'],
    blocked_areas: [
      { x: 0, y: 0, width: 7, height: 1 },
      { x: 0, y: 6, width: 7, height: 1 },
      { x: 0, y: 0, width: 1, height: 7 },
      { x: 6, y: 0, width: 1, height: 7 }
    ],
    metadata: { version: 1 },
    created_at: now,
    updated_at: now
  }
]

const mapObjects = [
  {
    id: terminalId,
    map_id: mapId,
    name: 'Terminal de bienvenida',
    type: 'terminal',
    description: 'Activa un mensaje de saludo para los nuevos tripulantes.',
    solid: true,
    position: { x: 3, y: 1 },
    size: { width: 1, height: 1 },
    palette: ['#118ab2', '#ef476f', '#ffd166'],
    actions: [
      {
        id: welcomeActionId,
        type: 'dialogue',
        label: 'Mensaje de bienvenida',
        payload: {
          text: 'Bienvenido a CoMutiNy. Explora y conoce a la tripulación.'
        }
      }
    ],
    metadata: { reward: null },
    created_at: now,
    updated_at: now
  }
]

export const up = async ({ context: queryInterface }) => {
  await queryInterface.bulkInsert('maps', maps)
  await queryInterface.bulkInsert('map_objects', mapObjects)
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.bulkDelete('map_objects', { map_id: mapId })
  await queryInterface.bulkDelete('maps', { id: mapId })
}
