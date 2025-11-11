import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

declare global {
    namespace Express {
        interface Request {
            userID: number;
            role: string;
        }
    }
}

export const VerifyToken = (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized access!" });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        if (!decoded || !decoded.userID) {
            return res.status(401).json({ message: "Unauthorized access!" });
        }

        req.userID = decoded.userID;
        req.role = decoded.role;

        next();
    }catch (e){
        res.status(401).json({ message: "Unauthorized access!" });
    }
}