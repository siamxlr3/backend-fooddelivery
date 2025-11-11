import {Request, Response} from 'express';
import {prisma} from "../prisma.js";
import bcrypt from "bcrypt";
import {GenerateToken} from "../middleware/GenerateToken.js";
import {EmailSend} from "../utilitis/EmailHelper.js";
import {client} from "../utilitis/RedisClient.js";

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

        await client.del("allUser")

        res.status(200).send({ message: "User created" });
    } catch (err) {
        res.status(500).send({ message: "Something went wrong" });
    }
};



export const login =async (req:Request, res:Response) => {
    try {
        const {email,password}=req.body;
        const User=await prisma.user.findFirst({where:{email:email}});
        if(!User){
            return res.status(400).send({message:"User does not exist"});
        }
        const validPassword=await bcrypt.compare(password,User.password);
        if(!validPassword){
            return res.status(400).send({message:"Invalid password"});
        }

        const generateOTP=()=>{
            return Math.floor(100000 + Math.random() * 900000).toString()
        }

        const otpCode=generateOTP();

        await prisma.otp.create({
            data:{
                email,
                otp: otpCode,
                status:false
            }
        })

        await EmailSend(email,`Your OTP is ${otpCode}`,"Login OTP")

        res.status(200).send({ message: "OTP sent to your email" });
    }catch (e){
        res.status(500).send({message:"Something went wrong"});
    }
}


export const verifyOTP=async (req:Request, res:Response) => {
    try {
        const email=req.params.email;
     const {otp}=req.body;
    const record=await prisma.otp.findFirst({where:{email,otp,status:false}})

    if(!record){
        return res.status(400).send({message:"Invalid Otp"});
    }

    await prisma.otp.update({
        where:{id:record.id},
        data:{otp:"0",status:true},
    })

    const user=await prisma.user.findFirst({where:{email}})
    if(!user){
        return res.status(400).send({message:"User does not exist"});
    }

    const token=await GenerateToken(user.id)
        res.cookie('token',token,{
            httpOnly: true,
            secure: true,
            sameSite: 'none'
        })

     res.status(200).send({message:"Login Successful", token,user:{
         id:user.id,
         email:user.email,
         name:user.name,
         role:user.role
         }});
    }catch(err){
        res.status(500).send({message:"Something went wrong"});
    }
}


export const logout =async (req:Request, res:Response) => {
    try {
        res.clearCookie("token");
        res.status(200).send({message:"User logged out"});
    }catch(err){
        res.status(500).send({message:"Something went wrong"});
    }
}



export const getUser=async(req:Request, res:Response) => {
    try {
       const count=await prisma.user.count()
        const data=await prisma.user.findMany({
                skip:0,
                take:req.query.take ? Number(req.query.take):10,
        })

        if(!data || !count){
            return res.status(404).send({message:"User does not exist"});
        }

        await client.setEx("allUser",600,JSON.stringify({data,count}))
        const cached=await client.get(("allUser"))
        if(cached){
            return res.status(200).send({message:"User Get Successfully",data:cached});
        }
        res.status(200).json({message:"User found",data,count})
    }catch(err){
        res.status(500).send({message:"Something went wrong"});
    }
}


export const RecoverEmail=async (req:Request,res:Response)=>{
    try {
        const {email}=req.body;
        const generateOTP=()=>{
            return Math.floor(100000 + Math.random() * 900000).toString()
        }

        const data=await prisma.user.findUnique({where:{email:email}});
        if(data){
            const createOTP=generateOTP()

            await prisma.otp.create({
                data:{
                    email,
                    otp: createOTP,
                    status:false
                }
            })

            await EmailSend(email,`Your OTP is ${createOTP}`,"Login OTP")

            res.status(200).send({message:"OTP sent to your email"});
        }else {
            return res.status(400).send({message:"User does not exist"});
        }
    }catch(err){
     res.status(500).send({message:"Something went wrong"});
    }
}


export const RecoverOtp=async (req:Request,res:Response)=>{
    try {
        const email=req.params.email;
        const {otp}=req.body;

        const otpRecord = await prisma.otp.findFirst({
            where: {
                email,
                otp
            }
        });
        if(!otpRecord){
            return res.status(400).send({ message: "Invalid or expired OTP" });
        }
       // await prisma.otp.update({
       //     where:{id:otpRecord.id},
       //     data:{
       //         otp:"0",
       //         status:true
       //     }
       // })
        res.status(200).json({message:"OTP verified successfully"});
    }catch(err){
        res.status(500).send({message:"Something went wrong"});
    }
}


export const RecoverPassword = async (req: Request, res: Response) => {
    try {
        const {email,otp} = req.params;
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
