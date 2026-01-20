import { Request, Response } from 'express';
import { prisma } from "../prisma.js";

export const startSession = async (req: Request, res: Response) => {
    try {
        const { terminalId, openingCash } = req.body;
        const userId = req.userID; // from VerifyToken

        // Check if user has open session?
        const openSession = await prisma.session.findFirst({
            where: { userId, status: 'OPEN' }
        });
        if (openSession) return res.status(400).json({ message: "Session already active" });

        const session = await prisma.session.create({
            data: {
                userId,
                terminalId,
                openingCash,
                status: "OPEN"
            }
        });
        res.status(201).json(session);
    } catch (err) {
        res.status(500).json({ message: "Failed to start session" });
    }
};

export const closeSession = async (req: Request, res: Response) => {
    try {
        const { sessionId, closingCash } = req.body;

        // Calculate total sales from orders in this session
        const orders = await prisma.order.findMany({
            where: { sessionId: Number(sessionId), status: 'Paid' } // Only paid orders
        });

        const totalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

        const session = await prisma.session.update({
            where: { id: Number(sessionId) },
            data: {
                status: 'CLOSED',
                closingCash,
                closedAt: new Date(),
                totalSales
            }
        });

        res.status(200).json({ message: "Session closed", session });
    } catch (err) {
        res.status(500).json({ message: "Failed to close session" });
    }
};

export const getCurrentSession = async (req: Request, res: Response) => {
    try {
        const userId = req.userID;
        const session = await prisma.session.findFirst({
            where: { userId, status: 'OPEN' }
        });

        if (session) {
            // Check if session is older than 24 hours
            const now = new Date();
            const sessionStart = new Date(session.openedAt);
            const hoursDiff = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);

            if (hoursDiff >= 24) {
                // Auto-close the session
                const orders = await prisma.order.findMany({
                    where: { sessionId: session.id, status: 'Paid' }
                });
                const totalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

                await prisma.session.update({
                    where: { id: session.id },
                    data: {
                        status: 'CLOSED',
                        closingCash: Number(session.openingCash) + totalSales, // Auto-calculate expected
                        closedAt: now,
                        totalSales
                    }
                });

                // Return null as session is now closed
                return res.status(200).json(null);
            }

            // Calculate current total sales on the fly
            const orders = await prisma.order.findMany({
                where: { sessionId: session.id, status: 'Paid' }
            });
            const currentTotalSales = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);

            // Return session with updated sales figure
            return res.status(200).json({ ...session, totalSales: currentTotalSales });
        }

        res.status(200).json(null);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch current session" });
    }
};

export const getSessionHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.userID;
        const { page = '1', take = '10' } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;

        const total = await prisma.session.count({
            where: { userId, status: 'CLOSED' }
        });

        const sessions = await prisma.session.findMany({
            where: { userId, status: 'CLOSED' },
            orderBy: { closedAt: 'desc' },
            skip,
            take: takeNum
        });

        res.status(200).json({
            data: sessions,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / takeNum)
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch session history" });
    }
};

