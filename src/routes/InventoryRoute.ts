import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { CheckRole } from "../middleware/CheckRole.js";
import { getInventory, createStockItem, updateStockItem } from "../controller/InventoryController.js";

const router = express.Router();

// Only Admin and KitchenStaff usually manage inventory, or specific roles
router.get("/", VerifyToken, CheckRole(['Admin', 'KitchenStaff', 'Cashier']), getInventory);
router.post("/", VerifyToken, CheckRole(['Admin', 'KitchenStaff']), createStockItem);
router.put("/:id", VerifyToken, CheckRole(['Admin', 'KitchenStaff']), updateStockItem);

export default router;
