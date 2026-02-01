let ioInstance = null
let userSocketsMap = null

const setSocketIO = (io, userSockets) => {
  ioInstance = io
  userSocketsMap = userSockets
}

const emitToUser = (userid, event, data) => {
  if (!ioInstance) return false

  ioInstance.to(userid).emit(event, data)
  return true
}

const getIO = () => ioInstance
const getUserSockets = () => userSocketsMap

module.exports = {
  setSocketIO,
  emitToUser,
  getIO,
  getUserSockets,
}
