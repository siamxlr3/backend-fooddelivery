import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { CheckRole } from "../middleware/CheckRole.js";
import { getDailyReport, getTopSellingItems, getMonthlyFinancialReport } from "../controller/ReportController.js";

const router = express.Router();

router.get("/daily", VerifyToken, CheckRole(['Admin', 'Cashier']), getDailyReport);
router.get("/top-selling", VerifyToken, CheckRole(['Admin', 'Cashier']), getTopSellingItems);
router.get("/financial", VerifyToken, CheckRole(['Admin']), getMonthlyFinancialReport);

export default router;
