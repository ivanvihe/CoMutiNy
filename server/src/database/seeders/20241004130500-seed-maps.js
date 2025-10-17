import { randomUUID } from 'crypto'

const now = new Date()
const mapId = randomUUID()
const terminalId = randomUUID()
const welcomeActionId = randomUUID()

const maps = [
  {
    id: mapId,
    slug: 'comunidad-inicial',
    name: 'Plaza Comunitaria',
    biome: 'Comunidad',
    description: 'Espacio central de bienvenida para encuentros y orientaciones comunitarias.',
    width: 28,
    height: 28,
    spawn_x: 14,
    spawn_y: 14,
    palette: ['#2b2d42', '#8d99ae', '#edf2f4', '#ef233c'],
    blocked_areas: [
      { x: 0, y: 0, width: 28, height: 1 },
      { x: 0, y: 27, width: 28, height: 1 },
      { x: 0, y: 0, width: 1, height: 28 },
      { x: 27, y: 0, width: 1, height: 28 }
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
    name: 'Panel de bienvenida',
    type: 'panel',
    description: 'Activa un mensaje de bienvenida para quienes llegan por primera vez.',
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
          text: 'Bienvenido a CoMutiNy. Explora y conoce a la comunidad.'
        }
      }
    ],
    metadata: { reward: null, objectId: 'welcome_terminal' },
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
