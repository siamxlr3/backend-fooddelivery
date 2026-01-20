import { Request, Response, NextFunction } from "express";

export const CheckRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.role || !allowedRoles.includes(req.role)) {
            return res.status(403).json({ message: "Forbidden: You do not have access to this resource." });
        }
        next();
    };
};
