import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import dotenv from "dotenv";
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
export const GenerateToken = async (userID) => {
    try {
        const result = await query('SELECT id, role FROM "User" WHERE id = $1 LIMIT 1', [userID]);
        const user = result.rows[0];
        if (!user) {
            throw new Error("User not found");
        }
        const token = jwt.sign({ userID: user.id, role: user.role }, JWT_SECRET, { expiresIn: "72h" });
        return token;
    }
    catch (err) {
        console.error("GenerateToken error:", err);
        throw new Error("Unable to login");
    }
};
