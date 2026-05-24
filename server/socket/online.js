const setupOnlineHandlers = (io, socket, context) => {
  const { onlineUsers } = context;

  socket.on("user_online", (userId) => {
    onlineUsers.add(userId);
    io.emit("user_online", userId);
  });

  socket.on("get_initial_online_users", () => {
    socket.emit("initial_online_users", Array.from(onlineUsers));
  });
};

module.exports = {
  setupOnlineHandlers,
};
