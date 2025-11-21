import express from 'express'
import {
    getUser,
    login,
    logout,
    RecoverEmail, RecoverOtp,
    RecoverPassword,
    Register,
    verifyOTP
} from "../controller/UserController.js";
import {VerifyToken} from "../middleware/VerifyToken.js";
import {VerifyAdmin} from "../middleware/VerifyAdmin.js";

const router = express.Router()

router.post("/create",Register)
router.post("/login",login)
router.post('/verify-otp/:email',verifyOTP)
router.post("/logout",logout)
router.get("/",VerifyToken,VerifyAdmin,getUser)
router.post("/recover-email", RecoverEmail);
router.post("/recover-otp/:email", RecoverOtp);
router.post("/recover-password/:email/:otp", RecoverPassword);

export default router