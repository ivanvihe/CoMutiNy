import registerNavigationEvents from './navigation.js'

export const registerWorldEventHandlers = (sessionManager) => {
  registerNavigationEvents(sessionManager)
  return sessionManager
}

export default registerWorldEventHandlers
