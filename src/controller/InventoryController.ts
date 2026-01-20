import { Request, Response } from 'express';
import { query } from "../config/db.js";

export const getInventory = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM "StockItem"');
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("getInventory error:", err);
        res.status(500).json({ message: "Error fetching inventory" });
    }
};

export const createStockItem = async (req: Request, res: Response) => {
    try {
        const { name, quantity, unit, threshold } = req.body;
        const result = await query(
            'INSERT INTO "StockItem" (name, quantity, unit, threshold, "updatedAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [name, quantity, unit, threshold]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("createStockItem error:", err);
        res.status(500).json({ message: "Error creating stock item" });
    }
};

export const updateStockItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { quantity, threshold, unit } = req.body;
        const result = await query(
            'UPDATE "StockItem" SET quantity = $1, threshold = $2, unit = $3, "updatedAt" = NOW() WHERE id = $4 RETURNING *',
            [quantity, threshold, unit, Number(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Stock item not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("updateStockItem error:", err);
        res.status(500).json({ message: "Error updating stock item" });
    }
};
