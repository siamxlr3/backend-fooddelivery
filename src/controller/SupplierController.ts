import { Request, Response } from 'express';
import { prisma } from "../prisma.js";

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { name, phone, email, address, itemType, status, purchaseDate, totalPurchaseAmount, paymentStatus } = req.body;

        const supplier = await prisma.supplier.create({
            data: {
                name,
                phone,
                email,
                address,
                itemType,
                status: status || 'Active',
                purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                totalPurchaseAmount: totalPurchaseAmount ? Number(totalPurchaseAmount) : null,
                paymentStatus
            }
        });

        res.status(201).json({ message: "Supplier created", supplier });
    } catch (err) {
        console.error("Create Supplier Error:", err);
        res.status(500).json({ message: "Failed to create supplier" });
    }
};

export const getSuppliers = async (req: Request, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: { id: 'desc' }
        });
        res.status(200).json({ data: suppliers });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch suppliers" });
    }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, itemType, status, purchaseDate, totalPurchaseAmount, paymentStatus } = req.body;

        const supplier = await prisma.supplier.update({
            where: { id: Number(id) },
            data: {
                name,
                phone,
                email,
                address,
                itemType,
                status,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                totalPurchaseAmount: totalPurchaseAmount ? Number(totalPurchaseAmount) : null,
                paymentStatus
            }
        });

        res.status(200).json({ message: "Supplier updated", supplier });
    } catch (err) {
        res.status(500).json({ message: "Failed to update supplier" });
    }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.supplier.delete({ where: { id: Number(id) } });
        res.status(200).json({ message: "Supplier deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete supplier" });
    }
};
