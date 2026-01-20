import { Server } from "socket.io";
let io;
export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: [
                "http://localhost:3000",
                "http://localhost:3001",
                "https://frontend-fooddelivery.vercel.app",
                process.env.FRONTEND_URL || ""
            ].filter(Boolean),
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        }
    });
    return io;
};
export { io };
