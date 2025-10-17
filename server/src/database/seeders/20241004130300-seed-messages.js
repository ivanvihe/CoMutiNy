import { randomUUID } from 'crypto'

const now = new Date()

const messageDefinitions = [
  {
    username: 'commander',
    avatarName: 'Commander Nova',
    content: 'All systems are green. Preparing for launch.'
  },
  {
    username: 'navigator',
    avatarName: 'Navigator Flux',
    content: 'Star map plotted. Awaiting your command.'
  }
]

export const up = async ({ context: queryInterface }) => {
  const [users] = await queryInterface.sequelize.query(
    'SELECT id, username FROM users WHERE username IN (:usernames)',
    { replacements: { usernames: messageDefinitions.map((definition) => definition.username) } }
  )

  const [avatars] = await queryInterface.sequelize.query(
    'SELECT id, name FROM avatars WHERE name IN (:names)',
    { replacements: { names: messageDefinitions.map((definition) => definition.avatarName) } }
  )

  const userByUsername = Object.fromEntries(users.map((user) => [user.username, user.id]))
  const avatarByName = Object.fromEntries(avatars.map((avatar) => [avatar.name, avatar.id]))

  const messages = messageDefinitions.map((definition) => ({
    id: randomUUID(),
    user_id: userByUsername[definition.username],
    avatar_id: avatarByName[definition.avatarName] ?? null,
    content: definition.content,
    created_at: now,
    updated_at: now
  }))

  await queryInterface.bulkInsert('messages', messages)
}

export const down = async ({ context: queryInterface }) => {
  await queryInterface.bulkDelete('messages', {
    content: messageDefinitions.map((definition) => definition.content)
  })
}
