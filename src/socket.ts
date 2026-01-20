import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
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
