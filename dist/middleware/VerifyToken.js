import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
export const VerifyToken = (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized access!" });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.userID) {
            return res.status(401).json({ message: "Unauthorized access!" });
        }
        req.userID = decoded.userID;
        req.role = decoded.role;
        next();
    }
    catch (e) {
        res.status(401).json({ message: "Unauthorized access!" });
    }
};
