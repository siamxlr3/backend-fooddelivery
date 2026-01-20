import express from 'express'
import {
    getUser,
    login,
    logout,
    RecoverEmail, RecoverOtp,
    RecoverPassword,
    Register,
    verifyOTP,
    createStaff,
    updateStaff,
    deleteStaff
} from "../controller/UserController.js";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { VerifyAdmin } from "../middleware/VerifyAdmin.js";
import { CheckRole } from "../middleware/CheckRole.js";

const router = express.Router()

router.post("/create", Register)
router.post("/register", Register)  // Alias for registration
router.post("/login", login)
router.post('/verify-otp/:email', verifyOTP)
router.post("/logout", logout)
router.get("/", VerifyToken, VerifyAdmin, getUser)
router.post("/recover-email", RecoverEmail);
router.post("/recover-otp/:email", RecoverOtp);
router.post("/recover-password/:email/:otp", RecoverPassword);

// Staff Management (Admin only)
router.post("/staff", VerifyToken, CheckRole(['Admin']), createStaff);
router.put("/staff/:id", VerifyToken, CheckRole(['Admin']), updateStaff);
router.delete("/staff/:id", VerifyToken, CheckRole(['Admin']), deleteStaff);

export default router