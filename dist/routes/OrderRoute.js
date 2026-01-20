import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { CheckRole } from "../middleware/CheckRole.js";
import { createOrder, getOrders, updateOrderStatus, deleteOrder } from "../controller/OrderController.js";
const router = express.Router();
router.post("/", VerifyToken, createOrder); // Waiter, Cashier, even Customer (if enabled)
router.get("/", VerifyToken, getOrders); // Kitchen, Cashier, Admin
router.put("/:id/status", VerifyToken, CheckRole(['Admin', 'KitchenStaff', 'Cashier', 'Waiter']), updateOrderStatus);
router.delete("/delete", VerifyToken, CheckRole(['Admin', 'Cashier']), deleteOrder);
export default router;
