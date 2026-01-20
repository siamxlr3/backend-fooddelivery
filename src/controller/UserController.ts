import { Request, Response } from 'express';
import { query } from "../config/db.js";
import bcrypt from "bcrypt";
import { GenerateToken } from "../middleware/GenerateToken.js";
import { EmailSend } from "../utilitis/EmailHelper.js";
import { client } from "../utilitis/RedisClient.js";

export const Register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUserResult = await query('SELECT * FROM "User" WHERE email = $1', [email]);
        if (existingUserResult.rows.length > 0) {
            return res.status(400).send({ message: "User already exists" });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        await query(
            'INSERT INTO "User" (name, email, password, role, "updatedAt") VALUES ($1, $2, $3, $4, NOW())',
            [name, email, hashPassword, role || 'Cashier']
        );

        try {
            if (client.isOpen) {
                await client.del("allUser")
            }
        } catch (redisErr) {
            console.error("Redis del error:", redisErr);
        }

        res.status(200).send({ message: "User created" });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const result = await query('SELECT * FROM "User" WHERE email = $1 LIMIT 1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).send({ message: "User does not exist" });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).send({ message: "Invalid password" });
        }

        const generateOTP = () => {
            return Math.floor(100000 + Math.random() * 900000).toString()
        }

        const otpCode = generateOTP();

        await query(
            'INSERT INTO "Otp" (email, otp, status, "updatedAt") VALUES ($1, $2, $3, NOW())',
            [email, otpCode, false]
        );

        try {
            await EmailSend(email, `Your OTP is ${otpCode}`, "Login OTP")
        } catch (emailErr) {
            console.error("Email send error:", emailErr);
            return res.status(500).send({ message: "Failed to send OTP email. Please try again later." });
        }

        res.status(200).send({ message: "OTP sent to your email" });
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const email = req.params.email;
        const { otp } = req.body;

        const otpResult = await query(
            'SELECT * FROM "Otp" WHERE email = $1 AND otp = $2 AND status = false LIMIT 1',
            [email, otp]
        );
        const record = otpResult.rows[0];

        if (!record) {
            return res.status(400).send({ message: "Invalid Otp" });
        }

        await query(
            'UPDATE "Otp" SET otp = $1, status = $2, "updatedAt" = NOW() WHERE id = $3',
            ["0", true, record.id]
        );

        const userResult = await query('SELECT * FROM "User" WHERE email = $1 LIMIT 1', [email]);
        const user = userResult.rows[0];

        if (!user) {
            return res.status(400).send({ message: "User does not exist" });
        }

        const token = await GenerateToken(user.id)
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        })

        res.status(200).send({
            message: "Login Successful", token, user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (err) {
        console.error("verifyOTP error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const logout = async (req: Request, res: Response) => {
    try {
        res.clearCookie("token");
        res.status(200).send({ message: "User logged out" });
    } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const getUser = async (req: Request, res: Response) => {
    try {
        const { page = 1, take = 10, keyword = '' } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;

        let sql = 'SELECT * FROM "User"';
        let countSql = 'SELECT COUNT(*) FROM "User"';
        const params: any[] = [];

        if (keyword) {
            const searchPattern = `%${keyword}%`;
            sql += ' WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1';
            countSql += ' WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1';
            params.push(searchPattern);
        }

        const countResult = await query(countSql, params);
        const count = parseInt(countResult.rows[0].count);

        sql += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(takeNum, skip);

        const userResult = await query(sql, params);
        const data = userResult.rows;

        if (!data) {
            return res.status(404).send({ message: "Users not found" });
        }

        // Cache results if no search is active
        if (!keyword) {
            try {
                if (client.isOpen) {
                    await client.setEx(`allUser_p${page}_t${take}`, 600, JSON.stringify({ data, count }));
                }
            } catch (redisErr) {
                console.error("Redis setEx error:", redisErr);
            }
        }

        res.status(200).json({
            message: "Users retrieved",
            data,
            total: count,
            page: pageNum,
            totalPages: Math.ceil(count / takeNum)
        });
    } catch (err) {
        console.error("getUser error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const RecoverEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const generateOTP = () => {
            return Math.floor(100000 + Math.random() * 900000).toString()
        }

        const userResult = await query('SELECT * FROM "User" WHERE email = $1 LIMIT 1', [email]);
        const user = userResult.rows[0];

        if (user) {
            const createOTP = generateOTP()

            await query(
                'INSERT INTO "Otp" (email, otp, status, "updatedAt") VALUES ($1, $2, $3, NOW())',
                [email, createOTP, false]
            );

            try {
                await EmailSend(email, `Your OTP is ${createOTP}`, "Password Recovery OTP")
            } catch (emailErr) {
                console.error("Recovery Email send error:", emailErr);
                return res.status(500).send({ message: "Failed to send recovery email. Please try again later." });
            }

            res.status(200).send({ message: "OTP sent to your email" });
        } else {
            return res.status(400).send({ message: "User does not exist" });
        }
    } catch (err) {
        console.error("RecoverEmail Error:", err);
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const RecoverOtp = async (req: Request, res: Response) => {
    try {
        const email = req.params.email;
        const { otp } = req.body;

        const otpResult = await query(
            'SELECT * FROM "Otp" WHERE email = $1 AND otp = $2 LIMIT 1',
            [email, otp]
        );
        const otpRecord = otpResult.rows[0];

        if (!otpRecord) {
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }
        res.status(200).json({ message: "OTP verified successfully" });
    } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
}

export const RecoverPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.params;
        const { password } = req.body;

        const otpResult = await query(
            'SELECT * FROM "Otp" WHERE email = $1 AND otp = $2 LIMIT 1',
            [email, otp]
        );
        const otpRecord = otpResult.rows[0];

        if (!otpRecord) {
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await query(
            'UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE email = $2',
            [hashedPassword, email]
        );

        await query(
            'UPDATE "Otp" SET status = $1, otp = $2, "updatedAt" = NOW() WHERE id = $3',
            [true, "0", otpRecord.id]
        );

        res.status(200).send({ message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
    }
};

export const createStaff = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, salary } = req.body;
        // Basic validation
        if (!['Cashier', 'Waiter', 'KitchenStaff', 'Admin'].includes(role)) {
            return res.status(400).json({ message: "Invalid role specified" });
        }

        const existingUserResult = await query('SELECT * FROM "User" WHERE email = $1 LIMIT 1', [email]);
        if (existingUserResult.rows.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const newUserResult = await query(
            'INSERT INTO "User" (name, email, password, role, salary, "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
            [name, email, hashPassword, role, salary ? Number(salary) : null]
        );
        const newUser = newUserResult.rows[0];

        res.status(201).json({
            message: "Staff created successfully",
            user: { id: newUser.id, name: newUser.name, role: newUser.role }
        });
    } catch (err) {
        console.error("Create Staff Error:", err);
        res.status(500).json({ message: "Failed to create staff" });
    }
};

export const updateStaff = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, role, password, salary } = req.body;

        let sql = 'UPDATE "User" SET name = $1, role = $2, salary = $3, "updatedAt" = NOW()';
        const params: any[] = [name, role, salary !== undefined ? Number(salary) : null];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql += ', password = $4';
            params.push(hashedPassword);
        }

        sql += ` WHERE id = $${params.length + 1} RETURNING *`;
        params.push(Number(id));

        const updatedUserResult = await query(sql, params);
        const updatedUser = updatedUserResult.rows[0];

        res.status(200).json({ message: "Staff updated", user: updatedUser });
    } catch (err) {
        console.error("updateStaff error:", err);
        res.status(500).json({ message: "Failed to update staff" });
    }
};

export const deleteStaff = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM "User" WHERE id = $1', [Number(id)]);
        res.status(200).json({ message: "Staff deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete staff" });
    }
};
