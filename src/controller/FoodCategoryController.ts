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

        let imageURL = "";

        // 🔹 Upload image to cloudinary if exists
        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "categoryImage"
            });
            imageURL = result.secure_url;
        }

        // 🔹 Create category
        await prisma.foodcategory.create({
            data: {
                name,
                status,
                image: imageURL
            }
        });

        // 🔹 Clear Redis Cache
        await client.del("allCategory");

        res.status(201).json({ message: "Category created successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const getAll=async (req:Request, res:Response) => {
    try {
        const cached=await client.get('allFood');
        if(cached){
            return res.status(200).json({message:"All food find",data:JSON.parse(cached)});
        }
        const count=await prisma.foodcategory.count()
        const data=await prisma.foodcategory.findMany({
            skip:0,
            take:req.query.take ? Number(req.query.take):10
        })
        if(!data){
            return res.status(404).send({message:"Not Found"});
        }

        await client.setEx('allFood',600,JSON.stringify({data, count}))
        res.status(201).json({message:"All food find",data:data})
    }catch(err){
        res.status(500).send({message:"Something went wrong"});
    }
}



export const getOneCategory = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const cached = await client.get(`singleCategory:${id}`);
        if (cached) {
            return res.status(200).json({
                message: "Category found successfully",
                data: JSON.parse(cached),
            });
        }

        const data = await prisma.foodcategory.findFirst({
            where: { id },
            include: { food: true }
        });

        if (!data) return res.status(404).json({ message: "Category not found" });

        await client.setEx(`singleCategory:${id}`, 600, JSON.stringify(data));

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

        let imageURL = "";

        if (req.file) {
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "categoryImage"
            });
            imageURL = result.secure_url;
        }

        await prisma.foodcategory.update({
            where: { id },
            data: {
                name,
                status,
                ...(imageURL && { image: imageURL })
            }
        });

        await client.del("allCategory");
        await client.del(`singleCategory:${id}`);

        res.status(200).json({ message: "Category updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const data = await prisma.foodcategory.delete({ where: { id } });

        if (!data) return res.status(404).json({ message: "Not found" });

        await client.del("allCategory");
        await client.del(`singleCategory:${id}`);

        res.status(200).json({ message: "Category deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Something went wrong" });
    }
};



export const searchCategory = async (req: Request, res: Response) => {
    try {
        const keyword = req.query.keyword as string;

        const data = await prisma.foodcategory.findMany({
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

        const count = await prisma.food.count({
            where: { categoryID: categoryId },
        });

        return res.json({
            categoryID: categoryId,
            totalFoods: count,
        });
    } catch (error) {
        return res.status(500).json({ message:"Something went wrong" });
    }
};

