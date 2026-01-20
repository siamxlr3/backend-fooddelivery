import express from "express";
import { VerifyToken } from "../middleware/VerifyToken.js";
import { getBookings, createBooking, updateBookingStatus, deleteBooking } from "../controller/BookingController.js";

const router = express.Router();

router.get("/", VerifyToken, getBookings);
router.post("/", VerifyToken, createBooking);
router.put("/:id/status", VerifyToken, updateBookingStatus);
router.delete("/:id", VerifyToken, deleteBooking);

export default router;
