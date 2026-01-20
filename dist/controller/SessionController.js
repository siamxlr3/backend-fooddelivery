import { query } from "../config/db.js";
export const startSession = async (req, res) => {
    try {
        const { terminalId, openingCash } = req.body;
        const userId = req.userID;
        const openSessionResult = await query('SELECT * FROM "Session" WHERE "userId" = $1 AND status = \'OPEN\' LIMIT 1', [userId]);
        if (openSessionResult.rows.length > 0) {
            return res.status(400).json({ message: "Session already active" });
        }
        const createResult = await query('INSERT INTO "Session" ("userId", "terminalId", "openingCash", status, "openedAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *', [userId, terminalId, openingCash, "OPEN"]);
        res.status(201).json(createResult.rows[0]);
    }
    catch (err) {
        console.error("startSession error:", err);
        res.status(500).json({ message: "Failed to start session" });
    }
};
export const closeSession = async (req, res) => {
    try {
        const { sessionId, closingCash } = req.body;
        const ordersResult = await query('SELECT "totalAmount" FROM "Order" WHERE "sessionId" = $1 AND status = \'Paid\'', [Number(sessionId)]);
        const totalSales = ordersResult.rows.reduce((sum, order) => sum + Number(order.totalAmount), 0);
        const updateResult = await query('UPDATE "Session" SET status = \'CLOSED\', "closingCash" = $1, "closedAt" = NOW(), "totalSales" = $2 WHERE id = $3 RETURNING *', [closingCash, totalSales, Number(sessionId)]);
        res.status(200).json({ message: "Session closed", session: updateResult.rows[0] });
    }
    catch (err) {
        console.error("closeSession error:", err);
        res.status(500).json({ message: "Failed to close session" });
    }
};
export const getCurrentSession = async (req, res) => {
    try {
        const userId = req.userID;
        const result = await query('SELECT * FROM "Session" WHERE "userId" = $1 AND status = \'OPEN\' LIMIT 1', [userId]);
        const session = result.rows[0];
        if (session) {
            const now = new Date();
            const sessionStart = new Date(session.openedAt);
            const hoursDiff = (now.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
            const ordersResult = await query('SELECT "totalAmount" FROM "Order" WHERE "sessionId" = $1 AND status = \'Paid\'', [session.id]);
            const currentTotalSales = ordersResult.rows.reduce((sum, order) => sum + Number(order.totalAmount), 0);
            if (hoursDiff >= 24) {
                // Auto-close the session
                const autoCloseResult = await query('UPDATE "Session" SET status = \'CLOSED\', "closingCash" = $1, "closedAt" = $2, "totalSales" = $3 WHERE id = $4 RETURNING *', [Number(session.openingCash) + currentTotalSales, now, currentTotalSales, session.id]);
                return res.status(200).json(null);
            }
            return res.status(200).json({ ...session, totalSales: currentTotalSales });
        }
        res.status(200).json(null);
    }
    catch (err) {
        console.error("getCurrentSession error:", err);
        res.status(500).json({ message: "Failed to fetch current session" });
    }
};
export const getSessionHistory = async (req, res) => {
    try {
        const userId = req.userID;
        const { page = '1', take = '10' } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;
        const countResult = await query('SELECT COUNT(*) FROM "Session" WHERE "userId" = $1 AND status = \'CLOSED\'', [userId]);
        const total = parseInt(countResult.rows[0].count);
        const sessionsResult = await query('SELECT * FROM "Session" WHERE "userId" = $1 AND status = \'CLOSED\' ORDER BY "closedAt" DESC LIMIT $2 OFFSET $3', [userId, takeNum, skip]);
        res.status(200).json({
            data: sessionsResult.rows,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / takeNum)
        });
    }
    catch (err) {
        console.error("getSessionHistory error:", err);
        res.status(500).json({ message: "Failed to fetch session history" });
    }
};
