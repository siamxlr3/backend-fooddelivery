import {Request, Response} from "express";
import {prisma} from "../prisma.js";
import cloudinary from "../utilitis/Cloudinary.js";
import {client} from "../utilitis/RedisClient.js";


declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
        }
    }
}

export const createFood=async (req:Request, res:Response) => {
    try {
        const {name,description,price,categoryID }=req.body;
        let imageURL=""
        if(req.file){
            const result=await cloudinary.uploader.upload(req.file.path,{
                folder:"foodImage"
            })
            imageURL=result.secure_url
        }
        await prisma.food.create({
            data:{
                name,
                description,
                price,
                categoryID,
                image:imageURL
            }
        })
        await client.del("allFood")
        res.status(201).json({message:"Food created successfully."})
    }catch(err){
     res.status(500).json({message:"Something went wrong"})
    }
}


export const getAll=async (req:Request, res:Response) => {
    try {
        const cached=await client.get('allFood');
        if(cached){
            return res.status(200).json({message:"All food find",data:JSON.parse(cached)});
        }
        const count=await prisma.food.count()
        const data=await prisma.food.findMany({
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

export const getOne = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);

        const cached=await client.get(`singleFood:${id}`)
        if(cached){
            return res.status(200).send({message:"Food Found Successfully ",data:cached})
        }
        const data = await prisma.food.findFirst({ where: { id } });

        if (!data) return res.status(404).send({ message: "Food not found" });

        await client.setEx(`singleFood:${id}`,600,JSON.stringify(data))
        res.status(201).json({message:"All food find",data:data})
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const update = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const { name,description,price,categoryID } = req.body;
        let imageURL=""

        if(req.file){
            const result=await cloudinary.uploader.upload(req.file.path,{
                folder:"foodImage"
            })
            imageURL=result.secure_url
        }

        await prisma.food.update({
            where: { id },
            data: { name,description,price,categoryID, image:imageURL },
        });

        await client.del("allFood")
        await client.del(`updated:${id}`)

        res.status(200).send({ message: "Food updated successfully"});
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const remove = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const data=await prisma.food.delete({ where: { id } });

        if(!data){
            return res.status(404).send({message:"Not Found"});
        }
        await client.del("allFood")
        await client.del(`data:${id}`)
        res.status(200).send({ message: "Food deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};


export const search = async (req: Request, res: Response) => {
    try {
        const keyword=req.query.keyword as string;
        const data=await prisma.food.findMany({
            where:{
                name:{
                    contains: keyword,
                    mode: 'insensitive'
                }
            }
        })
        res.status(200).json({message:"Food searching successfully",data});
    }catch(err){
        res.status(500).send({ message: "Something went wrong" });
    }
}