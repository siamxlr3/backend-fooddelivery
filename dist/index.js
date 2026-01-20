import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { initSocket } from "./socket.js";
import FoodRouter from "./routes/FoodRoute.js";
import UserRouter from "./routes/UserRoute.js";
import CartRouter from "./routes/CartRoute.js";
import FoodCategoryRouter from "./routes/FoodCategoryRoute.js";
import InventoryRouter from "./routes/InventoryRoute.js";
import OrderRouter from "./routes/OrderRoute.js";
import BillingRouter from "./routes/BillingRoute.js";
import SessionRouter from "./routes/SessionRoute.js";
import ReportRouter from "./routes/ReportRoute.js";
import TableRouter from "./routes/TableRoute.js";
import SettingRouter from "./routes/SettingRoute.js";
const app = express();
const httpServer = createServer(app);
// Initialize Socket.io
initSocket(httpServer);
app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));
app.use(cookieParser());
app.use("/api/food", FoodRouter);
app.use("/api/user", UserRouter);
app.use("/api/cart", CartRouter);
app.use("/api/category", FoodCategoryRouter);
app.use("/api/inventory", InventoryRouter);
app.use("/api/order", OrderRouter);
app.use("/api/billing", BillingRouter);
app.use("/api/session", SessionRouter);
app.use("/api/report", ReportRouter);
app.use("/api/table", TableRouter);
app.use("/api/settings", SettingRouter);
const Port = process.env.PORT || 3000;
httpServer.listen(Port, () => {
    console.log(`Server started on port ${Port}`);
});
