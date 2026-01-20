import { query } from "../config/db.js";
import cloudinary from "../utilitis/Cloudinary.js";
import { client } from "../utilitis/RedisClient.js";
export const createCategory = async (req, res) => {
    try {
        const { name, status } = req.body;
        const boolStatus = status === 'true' || status === true;
        let imageURL = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "categoryImage"
            });
            imageURL = result.secure_url;
        }
        await query('INSERT INTO foodcategory (name, status, image, "updatedAt") VALUES ($1, $2, $3, NOW())', [name, boolStatus, imageURL]);
        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0)
                await client.del(keys);
        }
        res.status(201).json({ message: "Category created successfully." });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const getAll = async (req, res) => {
    try {
        const { page = 1, take = 10, keyword = '' } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;
        let sql = 'SELECT * FROM foodcategory';
        let countSql = 'SELECT COUNT(*) FROM foodcategory';
        const params = [];
        const whereClauses = [];
        if (keyword) {
            params.push(`%${keyword}%`);
            whereClauses.push(`name ILIKE $${params.length}`);
        }
        if (whereClauses.length > 0) {
            const clause = ' WHERE ' + whereClauses.join(' AND ');
            sql += clause;
            countSql += clause;
        }
        // Unique cache key for pagination (only if no search keyword)
        const cacheKey = keyword ? null : `allCategory_p${pageNum}_t${takeNum}`;
        if (cacheKey && client.isOpen) {
            const cached = await client.get(cacheKey);
            if (cached) {
                return res.status(200).json(JSON.parse(cached));
            }
        }
        const countResult = await query(countSql, params);
        const count = parseInt(countResult.rows[0].count);
        sql += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(takeNum, skip);
        const result = await query(sql, params);
        const data = result.rows;
        if (!data) {
            return res.status(404).send({ message: "Not Found" });
        }
        const responseData = {
            data: data,
            total: count,
            page: pageNum,
            totalPages: Math.ceil(count / takeNum)
        };
        if (cacheKey && client.isOpen) {
            await client.setEx(cacheKey, 600, JSON.stringify(responseData));
        }
        res.status(200).json({
            message: "Categories found successfully",
            data: responseData
        });
    }
    catch (err) {
        console.error("Error in getAll categories:", err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const getOneCategory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (client.isOpen) {
            const cached = await client.get(`singleCategory:${id}`);
            if (cached) {
                return res.status(200).json({
                    message: "Category found successfully",
                    data: JSON.parse(cached),
                });
            }
        }
        const result = await query('SELECT * FROM foodcategory WHERE id = $1 LIMIT 1', [id]);
        const data = result.rows[0];
        if (!data)
            return res.status(404).json({ message: "Category not found" });
        // Include foods relation
        const foodsResult = await query('SELECT * FROM "Food" WHERE "categoryId" = $1', [id]);
        data.foods = foodsResult.rows;
        if (client.isOpen) {
            await client.setEx(`singleCategory:${id}`, 600, JSON.stringify(data));
        }
        res.status(200).json({ message: "Category found", data });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const updateCategory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, status } = req.body;
        const boolStatus = status === 'true' || status === true;
        let imageURL = "";
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "categoryImage"
            });
            imageURL = result.secure_url;
        }
        let sql = 'UPDATE foodcategory SET name = $1, status = $2, "updatedAt" = NOW()';
        const params = [name, boolStatus];
        if (imageURL) {
            params.push(imageURL);
            sql += `, image = $${params.length}`;
        }
        sql += ` WHERE id = $${params.length + 1}`;
        params.push(id);
        await query(sql, params);
        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0)
                await client.del(keys);
            await client.del(`singleCategory:${id}`);
        }
        res.status(200).json({ message: "Category updated successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const deleteCategory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const result = await query('DELETE FROM foodcategory WHERE id = $1 RETURNING *', [id]);
        const data = result.rows[0];
        if (!data)
            return res.status(404).json({ message: "Not found" });
        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0)
                await client.del(keys);
            await client.del(`singleCategory:${id}`);
        }
        res.status(200).json({ message: "Category deleted successfully" });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const searchCategory = async (req, res) => {
    try {
        const keyword = req.query.keyword;
        const result = await query('SELECT * FROM foodcategory WHERE name ILIKE $1', [`%${keyword}%`]);
        res.status(200).json({ message: "Category search successful", data: result.rows });
    }
    catch (err) {
        res.status(500).json({ message: "Something went wrong" });
    }
};
export const getFoodCountByCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        const result = await query('SELECT * FROM "Food" WHERE "categoryId" = $1', [categoryId]);
        return res.json({
            categoryID: categoryId,
            totalFoods: result.rows,
        });
    }
    catch (error) {
        return res.status(500).json({ message: "Something went wrong" });
    }
};
