import {Request, Response,NextFunction} from "express";

export const VerifyAdmin=(req: Request, res: Response, next: NextFunction) => {
    if(req.role !== "Admin"){
        return res.status(401).send("Not authorized");
    }
    next()
}