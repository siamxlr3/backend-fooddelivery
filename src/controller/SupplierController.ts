import { Request, Response } from 'express';
import { query } from "../config/db.js";

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { name, phone, email, address, itemType, status, purchaseDate, totalPurchaseAmount, paymentStatus } = req.body;

        const result = await query(
            'INSERT INTO suppliers (name, phone, email, address, "itemType", status, "purchaseDate", "totalPurchaseAmount", "paymentStatus", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *',
            [
                name,
                phone,
                email,
                address,
                itemType,
                status || 'Active',
                purchaseDate ? new Date(purchaseDate) : null,
                totalPurchaseAmount ? Number(totalPurchaseAmount) : null,
                paymentStatus
            ]
        );
        const supplier = result.rows[0];

        res.status(201).json({ message: "Supplier created", supplier });
    } catch (err) {
        console.error("Create Supplier Error:", err);
        res.status(500).json({ message: "Failed to create supplier" });
    }
};

export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM suppliers ORDER BY id DESC');
        res.status(200).json({ data: result.rows });
    } catch (err) {
        console.error("getSuppliers error:", err);
        res.status(500).json({ message: "Failed to fetch suppliers" });
    }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, itemType, status, purchaseDate, totalPurchaseAmount, paymentStatus } = req.body;

        const result = await query(
            'UPDATE suppliers SET name = $1, phone = $2, email = $3, address = $4, "itemType" = $5, status = $6, "purchaseDate" = $7, "totalPurchaseAmount" = $8, "paymentStatus" = $9, "updatedAt" = NOW() WHERE id = $10 RETURNING *',
            [
                name,
                phone,
                email,
                address,
                itemType,
                status,
                purchaseDate ? new Date(purchaseDate) : null,
                totalPurchaseAmount ? Number(totalPurchaseAmount) : null,
                paymentStatus,
                Number(id)
            ]
        );
        const supplier = result.rows[0];

        if (!supplier) {
            return res.status(404).json({ message: "Supplier not found" });
        }

        res.status(200).json({ message: "Supplier updated", supplier });
    } catch (err) {
        console.error("updateSupplier error:", err);
        res.status(500).json({ message: "Failed to update supplier" });
    }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [Number(id)]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Supplier not found" });
        }

        res.status(200).json({ message: "Supplier deleted" });
    } catch (err) {
        console.error("deleteSupplier error:", err);
        res.status(500).json({ message: "Failed to delete supplier" });
    }
};
