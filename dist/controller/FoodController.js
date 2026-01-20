import { prisma } from "../prisma.js";
import cloudinary from "../utilitis/Cloudinary.js";
import { client } from "../utilitis/RedisClient.js";
import { io } from "../socket.js";
export const createFood = async (req, res) => {
    try {
        const { name, description, price, categoryId, status, discountPercentage } = req.body;
        const boolStatus = status === 'true' || status === true;
        const numericCategoryID = parseInt(categoryId);
        const numericPrice = parseFloat(price);
        const numericDiscount = discountPercentage ? parseFloat(discountPercentage) : 0;
        let imageURL = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "foodImage"
            });
            imageURL = result.secure_url;
        }
        await prisma.food.create({
            data: {
                name,
                description,
                price: numericPrice,
                discountPercentage: numericDiscount,
                categoryId: numericCategoryID,
                image: imageURL,
                status: boolStatus
            }
        });
        if (client.isOpen) {
            await client.del("allFood");
        }
        res.status(201).json({ message: "Food created successfully." });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const getAll = async (req, res) => {
    try {
        const take = req.query.take ? Number(req.query.take) : 10;
        const page = req.query.page ? Number(req.query.page) : 1;
        const skip = (page - 1) * take;
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
        const keyword = req.query.keyword;
        const where = {};
        if (categoryId)
            where.categoryId = categoryId;
        if (keyword) {
            where.name = {
                contains: keyword,
                mode: 'insensitive'
            };
        }
        const cachedKey = `allFood:page:${page}:take:${take}:categoryId:${categoryId || 'all'}:keyword:${keyword || 'all'}`;
        if (client.isOpen) {
            const cached = await client.get(cachedKey);
            if (cached) {
                return res.status(200).json({ message: "All food found", data: JSON.parse(cached) });
            }
        }
        const count = await prisma.food.count({
            where: where
        });
        const data = await prisma.food.findMany({
            where: where,
            skip: skip,
            take: take,
            orderBy: { createdAt: 'desc' },
            include: { category: true }
        });
        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }
        const responseData = { data, total: count };
        if (client.isOpen) {
            await client.setEx(cachedKey, 600, JSON.stringify(responseData));
        }
        res.status(200).json({ message: "All food found", data: responseData });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const getOne = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (client.isOpen) {
            const cached = await client.get(`singleFood:${id}`);
            if (cached) {
                return res.status(200).send({ message: "Food Found Successfully", data: JSON.parse(cached) });
            }
        }
        const data = await prisma.food.findFirst({
            where: { id },
            include: { category: true }
        });
        if (!data)
            return res.status(404).send({ message: "Food not found" });
        if (client.isOpen) {
            await client.setEx(`singleFood:${id}`, 600, JSON.stringify(data));
        }
        res.status(200).json({ message: "Food found successfully", data: data });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const update = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, description, price, categoryId, status, discountPercentage } = req.body;
        const boolStatus = status === 'true' || status === true;
        const numericPrice = price ? parseFloat(price) : undefined;
        const numericCategoryID = categoryId ? parseInt(categoryId) : undefined;
        const numericDiscount = discountPercentage !== undefined ? parseFloat(discountPercentage) : undefined;
        let imageURL = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "foodImage"
            });
            imageURL = result.secure_url;
        }
        await prisma.food.update({
            where: { id },
            data: {
                name,
                description,
                price: numericPrice,
                categoryId: numericCategoryID,
                status: boolStatus,
                ...(numericDiscount !== undefined && { discountPercentage: numericDiscount }),
                ...(imageURL && { image: imageURL })
            },
        });
        if (client.isOpen) {
            await client.del("allFood");
            await client.del(`updated:${id}`);
        }
        res.status(200).send({ message: "Food updated successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const remove = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await prisma.food.delete({ where: { id } });
        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }
        if (client.isOpen) {
            await client.del("allFood");
            await client.del(`data:${id}`);
        }
        res.status(200).send({ message: "Food deleted successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const search = async (req, res) => {
    try {
        const keyword = req.query.keyword;
        const data = await prisma.food.findMany({
            where: {
                name: {
                    contains: keyword,
                    mode: 'insensitive'
                }
            }
        });
        res.status(200).json({ message: "Food searching successfully", data });
    }
    catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};
export const updateItemDiscounts = async (req, res) => {
    try {
        const { discounts } = req.body; // Array of { id: number, discountPercentage: number }
        if (!Array.isArray(discounts)) {
            return res.status(400).json({ message: 'Discounts must be an array' });
        }
        // Update all items
        const updates = discounts.map(({ id, discountPercentage }) => {
            return prisma.food.update({
                where: { id: parseInt(id) },
                data: { discountPercentage: parseFloat(discountPercentage) }
            });
        });
        await Promise.all(updates);
        // Clear cache
        if (client.isOpen) {
            await client.del('allFood');
        }
        // Fetch updated foods to broadcast
        const updatedFoods = await prisma.food.findMany({
            include: { category: true }
        });
        // Broadcast via Socket.IO
        io.emit('food_discounts_updated', updatedFoods);
        res.status(200).json({
            message: 'Item discounts updated successfully',
            data: updatedFoods
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update item discounts' });
    }
};
