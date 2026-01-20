import { Request, Response } from 'express';
import { prisma } from "../prisma.js";

export const getBookings = async (req: Request, res: Response) => {
    try {
        const bookings = await prisma.booking.findMany({
            include: { table: true },
            orderBy: { bookingTime: 'asc' }
        });
        res.status(200).json(bookings);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch bookings" });
    }
};

export const createBooking = async (req: Request, res: Response) => {
    try {
        const { customerName, phone, guests, bookingTime, tableId } = req.body;

        const booking = await prisma.booking.create({
            data: {
                customerName,
                phone,
                guests: Number(guests),
                bookingTime: new Date(bookingTime),
                tableId: Number(tableId),
                status: 'Reserved'
            }
        });

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

        const booking = await prisma.booking.update({
            where: { id: Number(id) },
            data: { status }
        });

        res.status(200).json({ message: "Booking status updated", booking });
    } catch (err) {
        res.status(500).json({ message: "Failed to update booking" });
    }
};

export const deleteBooking = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.booking.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Booking cancelled" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete booking" });
    }
};
