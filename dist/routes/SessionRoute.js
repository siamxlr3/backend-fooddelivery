import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { startSession, closeSession, getCurrentSession, getSessionHistory } from "../controller/SessionController.js";
const router = express.Router();
router.post("/start", VerifyToken, startSession);
router.post("/close", VerifyToken, closeSession);
router.get("/current", VerifyToken, getCurrentSession);
router.get("/history", VerifyToken, getSessionHistory);
export default router;
