import { Request, Response } from 'express';
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import { GenerateToken } from "../middleware/GenerateToken.js";
import { EmailSend } from "../utilitis/EmailHelper.js";
import { client } from "../utilitis/RedisClient.js";

export const Register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role } = req.body;

        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            return res.status(400).send({ message: "User already exists" });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        await prisma.user.create({
            data: {
                name,
                email,
                password: hashPassword,
                role,
            },
        });

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
        const User = await prisma.user.findFirst({ where: { email: email } });
        if (!User) {
            return res.status(400).send({ message: "User does not exist" });
        }
        const validPassword = await bcrypt.compare(password, User.password);
        if (!validPassword) {
            return res.status(400).send({ message: "Invalid password" });
        }

        const generateOTP = () => {
            return Math.floor(100000 + Math.random() * 900000).toString()
        }

        const otpCode = generateOTP();

        await prisma.otp.create({
            data: {
                email,
                otp: otpCode,
                status: false
            }
        })

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
        const record = await prisma.otp.findFirst({ where: { email, otp, status: false } })

        if (!record) {
            return res.status(400).send({ message: "Invalid Otp" });
        }

        await prisma.otp.update({
            where: { id: record.id },
            data: { otp: "0", status: true },
        })

        const user = await prisma.user.findFirst({ where: { email } })
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

        const where: any = keyword ? {
            OR: [
                { name: { contains: keyword as string } },
                { email: { contains: keyword as string } },
                { role: { contains: keyword as string } }
            ]
        } : {};

        const count = await prisma.user.count({ where });
        const data = await prisma.user.findMany({
            where,
            skip: skip,
            take: takeNum,
            orderBy: { id: 'desc' }
        });

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

        const data = await prisma.user.findUnique({ where: { email: email } });
        if (data) {
            const createOTP = generateOTP()

            await prisma.otp.create({
                data: {
                    email,
                    otp: createOTP,
                    status: false
                }
            })

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

        const otpRecord = await prisma.otp.findFirst({
            where: {
                email,
                otp
            }
        });
        if (!otpRecord) {
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }
        // await prisma.otp.update({
        //     where:{id:otpRecord.id},
        //     data:{
        //         otp:"0",
        //         status:true
        //     }
        // })
        res.status(200).json({ message: "OTP verified successfully" });
    } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
}


export const RecoverPassword = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.params;
        const { password } = req.body;

        const otpRecord = await prisma.otp.findFirst({
            where: {
                email,
                otp
            }
        });

        if (!otpRecord) {
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }


        const hashedPassword = await bcrypt.hash(password, 10);


        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });


        await prisma.otp.update({
            where: { id: otpRecord.id },
            data: { status: true, otp: "0" }
        });

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
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { 
                name, 
                email, 
                password: hashPassword, 
                role: role as any,
                salary: salary ? Number(salary) : null
            }
        });
        res.status(201).json({ message: "Staff created successfully", user: { id: newUser.id, name: newUser.name, role: newUser.role } });
    } catch (err) {
        console.error("Create Staff Error:", err);
        res.status(500).json({ message: "Failed to create staff" });
    }
};

export const updateStaff = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, role, password, salary } = req.body;
        const updateData: any = { 
            name, 
            role,
            salary: salary !== undefined ? Number(salary) : undefined
        };
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData
        });
        res.status(200).json({ message: "Staff updated", user: updatedUser });
    } catch (err) {
        res.status(500).json({ message: "Failed to update staff" });
    }
};

export const deleteStaff = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id: Number(id) } });
        res.status(200).json({ message: "Staff deleted" });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete staff" });
    }
};
