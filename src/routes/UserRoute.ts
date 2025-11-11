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

const router = express.Router()

router.post("/create",Register)
router.post("/login",login)
router.post('/verify-otp/:email',verifyOTP)
router.post("/logout",logout)
router.get("/",getUser)
router.post("/recover-email", RecoverEmail);
router.post("/recover-otp/:email", RecoverOtp);
router.post("/recover-password/:email/:otp", RecoverPassword);

export default router