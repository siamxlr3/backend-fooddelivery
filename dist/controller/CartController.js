import { prisma } from "../prisma.js";
import { client } from "../utilitis/RedisClient.js";
export const createCart = async (req, res) => {
    try {
        const { userId, foodId, quantity, totalPrice } = req.body;
        const cartItem = await prisma.cart.create({
            data: {
                userId,
                foodId,
                quantity,
                totalPrice,
                status: "Pending"
            }
        });
        await client.del("allCart");
        res.status(200).json({ message: "success" });
    }
    catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const getAll = async (req, res) => {
    try {
        const count = await prisma.cart.count();
        const data = await prisma.cart.findMany({
            skip: 0,
            take: req.query.take ? Number(req.query.take) : 10,
        });
        if (!data || !count) {
            return res.status(404).json({ message: "Not Found" });
        }
        await client.setEx("allCart", 600, JSON.stringify({ data, count }));
        const cached = await client.get("allCart");
        if (cached) {
            return res.status(200).json({ message: "success", data: cached });
        }
        res.status(200).json({ message: "success", data, count });
    }
    catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const getOne = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await prisma.cart.findUnique({ where: { id } });
        if (!data) {
            res.status(404).send({ message: "Not Found" });
        }
        await client.setEx("allCart", 600, JSON.stringify(data));
        const cached = await client.get("allCart");
        if (cached) {
            return res.status(200).json({ message: "success", data: cached });
        }
        res.status(200).json({ message: "success", data });
    }
    catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.cart.delete({ where: { id } });
        await client.del("allCart");
        await client.del(`removed:${id}`);
        res.status(200).send({ message: "Cart deleted successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const update = async (req, res) => {
    try {
        const { status } = req.body;
        const id = parseInt(req.params.id);
        await prisma.cart.update({
            where: { id },
            data: { status },
        });
        await client.del("allCart");
        await client.del(`updated:${id}`);
        res.status(200).send({ message: "success" });
    }
    catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};
