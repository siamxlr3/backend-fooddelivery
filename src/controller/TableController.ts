import { Request, Response } from 'express';
import { query } from "../config/db.js";

export const getTables = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM "DiningTable" ORDER BY CAST(number AS INTEGER) ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("getTables error:", err);
        // Fallback to simple alpha sort if CAST fails
        try {
            const fallbackResult = await query('SELECT * FROM "DiningTable" ORDER BY number ASC');
            res.status(200).json(fallbackResult.rows);
        } catch (e) {
            res.status(500).json({ message: "Failed to fetch tables" });
        }
    }
};

export const addTable = async (req: Request, res: Response) => {
    try {
        const { number, capacity } = req.body;

        // Check if exists
        const checkResult = await query('SELECT id FROM "DiningTable" WHERE number = $1', [number.toString()]);
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ message: "Table number already exists" });
        }

        const result = await query(
            'INSERT INTO "DiningTable" (number, capacity, "updatedAt") VALUES ($1, $2, NOW()) RETURNING *',
            [number.toString(), Number(capacity) || 4]
        );
        res.status(201).json(result.rows[0]);
    } catch (err: any) {
        console.error("addTable error:", err);
        res.status(500).json({ message: "Failed to add table" });
    }
};

export const removeTable = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM "DiningTable" WHERE id = $1 RETURNING *', [Number(id)]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Table not found" });
        }

        res.status(200).json({ message: "Table removed" });
    } catch (err) {
        console.error("removeTable error:", err);
        res.status(500).json({ message: "Failed to remove table" });
    }
};

export const updateTable = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { number, capacity } = req.body;

        let sql = 'UPDATE "DiningTable" SET "updatedAt" = NOW()';
        const params: any[] = [];

        if (number) {
            params.push(number.toString());
            sql += `, number = $${params.length}`;
        }

        if (capacity) {
            params.push(Number(capacity));
            sql += `, capacity = $${params.length}`;
        }

        sql += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(Number(id));

        const result = await query(sql, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Table not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("updateTable error:", err);
        res.status(500).json({ message: "Failed to update table" });
    }
};
