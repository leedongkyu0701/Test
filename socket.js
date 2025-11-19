let io;

module.exports = {
    init: (server) => {
        io = require("socket.io")(server, {
            cors: {
                origin: "https://test-frontend-five-pearl.vercel.app",
                methods: ["GET", "POST"],
                credentials: true,
            },
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
};  