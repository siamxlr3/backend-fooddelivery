import { prisma } from "../prisma.js";
export const getTables = async (req, res) => {
    try {
        const tables = await prisma.diningTable.findMany({
            orderBy: { number: 'asc' }
        });
        res.status(200).json(tables);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to fetch tables" });
    }
};
export const addTable = async (req, res) => {
    try {
        const { number, capacity } = req.body;
        const table = await prisma.diningTable.create({
            data: {
                number: number.toString(),
                capacity: Number(capacity) || 4
            }
        });
        res.status(201).json(table);
    }
    catch (err) {
        if (err.code === 'P2002') {
            return res.status(400).json({ message: "Table number already exists" });
        }
        res.status(500).json({ message: "Failed to add table" });
    }
};
export const removeTable = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.diningTable.delete({
            where: { id: Number(id) }
        });
        res.status(200).json({ message: "Table removed" });
    }
    catch (err) {
        res.status(500).json({ message: "Failed to remove table" });
    }
};
export const updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { number, capacity } = req.body;
        const table = await prisma.diningTable.update({
            where: { id: Number(id) },
            data: {
                number: number?.toString(),
                capacity: capacity ? Number(capacity) : undefined
            }
        });
        res.status(200).json(table);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to update table" });
    }
};
