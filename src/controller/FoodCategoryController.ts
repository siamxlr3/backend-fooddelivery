import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import cloudinary from "../utilitis/Cloudinary.js";
import { client } from "../utilitis/RedisClient.js";

declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

export const createCategory = async (req: Request, res: Response) => {
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
        await prisma.foodCategory.create({
            data: {
                name,
                status: boolStatus,
                image: imageURL
            }
        });

        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0) await client.del(keys);
        }

        res.status(201).json({ message: "Category created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const getAll = async (req: Request, res: Response) => {
    try {
        const { page = 1, take = 10, keyword = '' } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;

        const where: any = keyword ? {
            name: {
                contains: keyword as string,
                mode: "insensitive"
            }
        } : {};

        // Unique cache key for pagination (only if no search keyword)
        const cacheKey = keyword ? null : `allCategory_p${pageNum}_t${takeNum}`;

        if (cacheKey && client.isOpen) {
            const cached = await client.get(cacheKey);
            if (cached) {
                return res.status(200).json(JSON.parse(cached));
            }
        }

        const count = await prisma.foodCategory.count({ where });
        const data = await prisma.foodCategory.findMany({
            where,
            skip: skip,
            take: takeNum,
            orderBy: { id: 'desc' }
        });

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
    } catch (err) {
        console.error("Error in getAll categories:", err);
        res.status(500).json({ message: "Something went wrong" });
    }
}



export const getOneCategory = async (req: Request, res: Response) => {
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

        const data = await prisma.foodCategory.findFirst({
            where: { id },
            include: { foods: true }
        });

        if (!data) return res.status(404).json({ message: "Category not found" });

        if (client.isOpen) {
            await client.setEx(`singleCategory:${id}`, 600, JSON.stringify(data));
        }

        res.status(200).json({ message: "Category found", data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const updateCategory = async (req: Request, res: Response) => {
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

        await prisma.foodCategory.update({
            where: { id },
            data: {
                name,
                status: boolStatus,
                ...(imageURL && { image: imageURL })
            }
        });

        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0) await client.del(keys);
            await client.del(`singleCategory:${id}`);
        }

        res.status(200).json({ message: "Category updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const data = await prisma.foodCategory.delete({ where: { id } });

        if (!data) return res.status(404).json({ message: "Not found" });

        if (client.isOpen) {
            const keys = await client.keys("allCategory*");
            if (keys.length > 0) await client.del(keys);
            await client.del(`singleCategory:${id}`);
        }

        res.status(200).json({ message: "Category deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const searchCategory = async (req: Request, res: Response) => {
    try {
        const keyword = req.query.keyword as string;

        const data = await prisma.foodCategory.findMany({
            where: {
                name: {
                    contains: keyword,
                    mode: "insensitive"
                }
            }
        });

        res.status(200).json({ message: "Category search successful", data });
    } catch (err) {
        res.status(500).json({ message: "Something went wrong" });
    }
};


export const getFoodCountByCategory = async (req: Request, res: Response) => {
    try {
        const categoryId = Number(req.params.id);

        const count = await prisma.food.findMany({
            where: { categoryId: categoryId },
        });

        return res.json({
            categoryID: categoryId,
            totalFoods: count,
        });
    } catch (error) {
        return res.status(500).json({ message: "Something went wrong" });
    }
};

