import { Request, Response } from 'express';
import { query } from "../config/db.js";

export const getBookings = async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT b.*, row_to_json(dt.*) as table
            FROM "Booking" b
            LEFT JOIN "DiningTable" dt ON b."tableId" = dt.id
            ORDER BY b."bookingTime" ASC
        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("getBookings error:", err);
        res.status(500).json({ message: "Failed to fetch bookings" });
    }
};

export const createBooking = async (req: Request, res: Response) => {
    try {
        const { customerName, phone, guests, bookingTime, tableId } = req.body;

        const result = await query(
            'INSERT INTO "Booking" ("customerName", phone, guests, "bookingTime", "tableId", status, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *',
            [customerName, phone, Number(guests), new Date(bookingTime), Number(tableId), 'Reserved']
        );
        const booking = result.rows[0];

        res.status(201).json({ message: "Table booked successfully", booking });
    } catch (err) {
        console.error("Create Booking Error:", err);
        res.status(500).json({ message: "Failed to create booking" });
    }
};

export const updateBookingStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await query(
            'UPDATE "Booking" SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
            [status, Number(id)]
        );
        const booking = result.rows[0];

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        res.status(200).json({ message: "Booking status updated", booking });
    } catch (err) {
        console.error("updateBookingStatus error:", err);
        res.status(500).json({ message: "Failed to update booking" });
    }
};

export const deleteBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM "Booking" WHERE id = $1 RETURNING *', [Number(id)]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Booking not found" });
        }

        res.status(200).json({ message: "Booking cancelled" });
    } catch (err) {
        console.error("deleteBooking error:", err);
        res.status(500).json({ message: "Failed to delete booking" });
    }
};
