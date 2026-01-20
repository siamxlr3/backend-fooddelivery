import { query } from "../config/db.js";
import { client } from "../utilitis/RedisClient.js";
export const createCart = async (req, res) => {
    try {
        const { userId, foodId, quantity, totalPrice } = req.body;
        await query('INSERT INTO cart ("userId", "foodId", quantity, "totalPrice", status, "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW())', [userId, foodId, quantity, totalPrice, "Pending"]);
        if (client.isOpen) {
            await client.del("allCart");
        }
        res.status(200).json({ message: "success" });
    }
    catch (err) {
        console.error("createCart error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const getAll = async (req, res) => {
    try {
        const take = req.query.take ? Number(req.query.take) : 10;
        const countResult = await query('SELECT COUNT(*) FROM cart');
        const count = parseInt(countResult.rows[0].count);
        const result = await query('SELECT * FROM cart LIMIT $1 OFFSET 0', [take]);
        const data = result.rows;
        if (!data) {
            return res.status(404).json({ message: "Not Found" });
        }
        if (client.isOpen) {
            await client.setEx("allCart", 600, JSON.stringify({ data, count }));
        }
        res.status(200).json({ message: "success", data, count });
    }
    catch (err) {
        console.error("getAll cart error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const getOne = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await query('SELECT * FROM cart WHERE id = $1 LIMIT 1', [id]);
        const data = result.rows[0];
        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }
        res.status(200).json({ message: "success", data });
    }
    catch (err) {
        console.error("getOne cart error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await query('DELETE FROM cart WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).send({ message: "Not Found" });
        }
        if (client.isOpen) {
            await client.del("allCart");
            await client.del(`removed:${id}`);
        }
        res.status(200).send({ message: "Cart deleted successfully" });
    }
    catch (err) {
        console.error("remove cart error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const update = async (req, res) => {
    try {
        const { status } = req.body;
        const id = parseInt(req.params.id);
        const result = await query('UPDATE cart SET status = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *', [status, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Not Found" });
        }
        if (client.isOpen) {
            await client.del("allCart");
            await client.del(`updated:${id}`);
        }
        res.status(200).send({ message: "success" });
    }
    catch (err) {
        console.error("update cart error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
