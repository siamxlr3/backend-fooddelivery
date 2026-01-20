import { Request, Response } from 'express';
import { prisma } from "../prisma.js";

export const getInventory = async (req: Request, res: Response) => {
    try {
        const items = await prisma.stockItem.findMany();
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ message: "Error fetching inventory" });
    }
};

export const createStockItem = async (req: Request, res: Response) => {
    try {
        const { name, quantity, unit, threshold } = req.body;
        const newItem = await prisma.stockItem.create({
            data: { name, quantity, unit, threshold }
        });
        res.status(201).json(newItem);
    } catch (err) {
        res.status(500).json({ message: "Error creating stock item" });
    }
};

export const updateStockItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { quantity, threshold, unit } = req.body;
        const updatedItem = await prisma.stockItem.update({
            where: { id: Number(id) },
            data: { quantity, threshold, unit }
        });
        res.status(200).json(updatedItem);
    } catch (err) {
        res.status(500).json({ message: "Error updating stock item" });
    }
};
