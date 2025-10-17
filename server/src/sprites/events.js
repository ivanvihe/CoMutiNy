import { EventEmitter } from 'node:events'

const spriteEvents = new EventEmitter()

export const SPRITE_EVENTS = Object.freeze({
  ATLAS_UPDATED: 'atlas:updated'
})

export default spriteEvents
