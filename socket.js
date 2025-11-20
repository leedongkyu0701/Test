let io;

module.exports = {
    init: (server) => {
        io = require("socket.io")(server, {
            cors: {
                origin: "https://test-frontend-git-main-leedongkyus-projects-c6361242.vercel.app/",
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