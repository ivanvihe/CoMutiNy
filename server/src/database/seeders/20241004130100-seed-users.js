import { randomUUID } from 'crypto'

const users = [
  {
    id: randomUUID(),
    username: 'commander',
    email: 'commander@example.com',
    password_hash: '$2b$10$KbQiYrQmFXoYz7V6czS4QeC9n.WxJz9n9VfNQXmpfz6WZ0oS9dXG2',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: randomUUID(),
    username: 'navigator',
    email: 'navigator@example.com',
    password_hash: '$2b$10$KbQiYrQmFXoYz7V6czS4QeC9n.WxJz9n9VfNQXmpfz6WZ0oS9dXG2',
    created_at: new Date(),
    updated_at: new Date()
  }
]

export const up = async ({ context: queryInterface }) => {
  await queryInterface.bulkInsert('users', users)
}

export const down = async ({ context: queryInterface }) => {
  const ids = users.map((user) => user.id)
  await queryInterface.bulkDelete('users', { id: ids })
}
