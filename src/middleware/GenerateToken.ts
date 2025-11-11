import jwt from "jsonwebtoken";
import {prisma} from "../prisma.js";
import dotenv from "dotenv";
dotenv.config();


const JWT_SECRET = process.env.JWT_SECRET as string;

export const GenerateToken=async (userID:number)=>{
    try {
        const user=await prisma.user.findFirst({where:{id:userID}});
        if(!user){
            throw new Error("User not found");
        }
        const token=jwt.sign({userID:user.id, role:user.role},JWT_SECRET,{expiresIn: "72h"});
        return token;
    }catch(err){
        throw new Error("Unable to login");
    }
}