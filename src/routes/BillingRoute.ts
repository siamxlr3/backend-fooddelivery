import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { generateBill, processPayment, getPaymentHistory, deleteBill } from "../controller/BillingController.js";

const router = express.Router();

router.post("/generate", VerifyToken, generateBill);
router.post("/pay", VerifyToken, processPayment);
router.get("/history", VerifyToken, getPaymentHistory);
router.delete("/delete", VerifyToken, deleteBill);

export default router;
