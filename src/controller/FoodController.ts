import { Request, Response } from "express";
import { query } from "../config/db.js";
import cloudinary from "../utilitis/Cloudinary.js";
import { client } from "../utilitis/RedisClient.js";
import { io } from "../socket.js";

declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

export const createFood = async (req: Request, res: Response) => {
    try {
        const { name, description, price, categoryId, status, discountPercentage } = req.body;
        const boolStatus = status === 'true' || status === true;
        const numericCategoryID = parseInt(categoryId);
        const numericPrice = parseFloat(price);
        const numericDiscount = discountPercentage ? parseFloat(discountPercentage) : 0;

        let imageURL = ""
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "foodImage"
            })
            imageURL = result.secure_url
        }

        await query(
            'INSERT INTO "Food" (name, description, price, "discountPercentage", "categoryId", image, status, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
            [name, description, numericPrice, numericDiscount, numericCategoryID, imageURL, boolStatus]
        );

        if (client.isOpen) {
            await client.del("allFood")
        }
        res.status(201).json({ message: "Food created successfully." })
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" })
    }
}

export const getAll = async (req: Request, res: Response) => {
    try {
        const take = req.query.take ? Number(req.query.take) : 10;
        const page = req.query.page ? Number(req.query.page) : 1;
        const skip = (page - 1) * take;
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
        const keyword = req.query.keyword as string | undefined;

        let sql = 'SELECT f.*, row_to_json(c.*) as category FROM "Food" f LEFT JOIN foodcategory c ON f."categoryId" = c.id';
        let countSql = 'SELECT COUNT(*) FROM "Food" f';
        const params: any[] = [];
        const whereClauses: string[] = [];

        if (categoryId) {
            params.push(categoryId);
            whereClauses.push(`f."categoryId" = $${params.length}`);
        }

        if (keyword) {
            params.push(`%${keyword}%`);
            whereClauses.push(`f.name ILIKE $${params.length}`);
        }

        if (whereClauses.length > 0) {
            const clause = ' WHERE ' + whereClauses.join(' AND ');
            sql += clause;
            countSql += clause;
        }

        const cachedKey = `allFood:page:${page}:take:${take}:categoryId:${categoryId || 'all'}:keyword:${keyword || 'all'}`;

        if (client.isOpen) {
            const cached = await client.get(cachedKey);
            if (cached) {
                return res.status(200).json({ message: "All food found", data: JSON.parse(cached) });
            }
        }

        const countResult = await query(countSql, params);
        const count = parseInt(countResult.rows[0].count);

        sql += ` ORDER BY f."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(take, skip);

        const result = await query(sql, params);
        const data = result.rows;

        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }

        const responseData = { data, total: count };

        if (client.isOpen) {
            await client.setEx(cachedKey, 600, JSON.stringify(responseData));
        }
        res.status(200).json({ message: "All food found", data: responseData });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const getOne = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        if (client.isOpen) {
            const cached = await client.get(`singleFood:${id}`)
            if (cached) {
                return res.status(200).send({ message: "Food Found Successfully", data: JSON.parse(cached) })
            }
        }

        const result = await query(
            'SELECT f.*, row_to_json(c.*) as category FROM "Food" f LEFT JOIN foodcategory c ON f."categoryId" = c.id WHERE f.id = $1 LIMIT 1',
            [id]
        );
        const data = result.rows[0];

        if (!data) return res.status(404).send({ message: "Food not found" });

        if (client.isOpen) {
            await client.setEx(`singleFood:${id}`, 600, JSON.stringify(data))
        }
        res.status(200).json({ message: "Food found successfully", data: data })
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const { name, description, price, categoryId, status, discountPercentage } = req.body;
        const boolStatus = status === 'true' || status === true;
        const numericPrice = price ? parseFloat(price) : undefined;
        const numericCategoryID = categoryId ? parseInt(categoryId) : undefined;
        const numericDiscount = discountPercentage !== undefined ? parseFloat(discountPercentage) : undefined;

        let imageURL = ""
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "foodImage"
            })
            imageURL = result.secure_url
        }

        let sql = 'UPDATE "Food" SET name = $1, description = $2, price = $3, "categoryId" = $4, status = $5, "updatedAt" = NOW()';
        const params: any[] = [name, description, numericPrice, numericCategoryID, boolStatus];

        if (numericDiscount !== undefined) {
            params.push(numericDiscount);
            sql += `, "discountPercentage" = $${params.length}`;
        }

        if (imageURL) {
            params.push(imageURL);
            sql += `, image = $${params.length}`;
        }

        sql += ` WHERE id = $${params.length + 1}`;
        params.push(id);

        await query(sql, params);

        if (client.isOpen) {
            await client.del("allFood")
            await client.del(`updated:${id}`)
        }

        res.status(200).send({ message: "Food updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const result = await query('DELETE FROM "Food" WHERE id = $1 RETURNING *', [id]);
        const data = result.rows[0];

        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }
        if (client.isOpen) {
            await client.del("allFood")
            await client.del(`data:${id}`)
        }
        res.status(200).send({ message: "Food deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const search = async (req: Request, res: Response) => {
    try {
        const keyword = req.query.keyword as string;
        const result = await query(
            'SELECT * FROM "Food" WHERE name ILIKE $1',
            [`%${keyword}%`]
        );
        res.status(200).json({ message: "Food searching successfully", data: result.rows });
    } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const updateItemDiscounts = async (req: Request, res: Response) => {
    try {
        const { discounts } = req.body; // Array of { id: number, discountPercentage: number }

        if (!Array.isArray(discounts)) {
            return res.status(400).json({ message: 'Discounts must be an array' });
        }

        // Update all items sequentially
        for (const { id, discountPercentage } of discounts) {
            await query(
                'UPDATE "Food" SET "discountPercentage" = $1, "updatedAt" = NOW() WHERE id = $2',
                [parseFloat(discountPercentage), parseInt(id)]
            );
        }

        // Clear cache
        if (client.isOpen) {
            await client.del('allFood');
        }

        // Fetch updated foods to broadcast
        const result = await query(
            'SELECT f.*, row_to_json(c.*) as category FROM "Food" f LEFT JOIN foodcategory c ON f."categoryId" = c.id'
        );
        const updatedFoods = result.rows;

        // Broadcast via Socket.IO
        io.emit('food_discounts_updated', updatedFoods);

        res.status(200).json({
            message: 'Item discounts updated successfully',
            data: updatedFoods
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update item discounts' });
    }
};
