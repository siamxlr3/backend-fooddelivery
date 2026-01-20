import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
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
import SupplierRouter from "./routes/SupplierRoute.js";
import BookingRouter from "./routes/BookingRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// 1. CORS Configuration
app.use(cors({
    origin: "https://frontend-fooddelivery-7cv3.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));

// 2. Explicit Preflight Handling
app.options("(.*)", (req, res) => {
    res.header("Access-Control-Allow-Origin", "https://frontend-fooddelivery-7cv3.vercel.app");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.sendStatus(200);
});

// Initialize Socket.io
initSocket(httpServer);

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
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
app.use("/api/supplier", SupplierRouter);
app.use("/api/booking", BookingRouter);

const Port = process.env.PORT || 3000;
httpServer.listen(Port, () => {
    console.log(`Server started on port ${Port}`);
});

export default app;
