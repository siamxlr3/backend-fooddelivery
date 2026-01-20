import { Request, Response } from 'express';
import { prisma } from "../prisma.js";
import { io } from "../socket.js";
import cloudinary from "../utilitis/Cloudinary.js";

export const getSettings = async (req: Request, res: Response) => {
    try {
        console.log("Fetching all settings from database...");
        const settings = await prisma.setting.findMany();
        const settingsMap = settings.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.status(200).json(settingsMap);
    } catch (err) {
        console.error("Error fetching settings:", err);
        res.status(500).json({ message: "Failed to fetch settings" });
    }
};


export const updateSetting = async (req: Request, res: Response) => {
    try {
        const { key, value } = req.body;
        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        });

        // Fetch all settings to broadcast
        const allSettings = await prisma.setting.findMany();
        const settingsMap = allSettings.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        // Broadcast settings update via Socket.IO
        io.emit('settings_updated', settingsMap);

        res.status(200).json(setting);
    } catch (err) {
        res.status(500).json({ message: "Failed to update setting" });
    }
};

export const updateMultipleSettings = async (req: Request, res: Response) => {
    try {
        const { settings } = req.body; // Expecting { tax_rate: "10", discount_rate: "5" }

        const updates = Object.entries(settings).map(([key, value]) => {
            return prisma.setting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) }
            });
        });

        await Promise.all(updates);

        // Fetch all settings to broadcast
        const allSettings = await prisma.setting.findMany();
        const settingsMap = allSettings.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        // Broadcast settings update via Socket.IO
        io.emit('settings_updated', settingsMap);

        res.status(200).json({ message: "Settings updated successfully", settings: settingsMap });
    } catch (err) {
        res.status(500).json({ message: "Failed to update settings" });
    }
};

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadLogo = async (req: Request, res: Response) => {
    try {
        console.log("Receiving logo upload request (Local Storage)...");
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const tempPath = req.file.path;
        const targetDir = path.join(__dirname, '../../uploads'); // Go up from src/controller to root/uploads

        // Ensure uploads directory exists
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const targetFilename = `logo_${Date.now()}${path.extname(req.file.originalname)}`;
        const targetPath = path.join(targetDir, targetFilename);

        // Move file from temp to uploads (copy then delete to handle cross-device issues)
        fs.copyFileSync(tempPath, targetPath);
        fs.unlinkSync(tempPath);

        const logoUrl = `http://localhost:5000/uploads/${targetFilename}`;
        console.log("File saved locally at:", targetPath);
        console.log("Public URL:", logoUrl);

        // Save to settings table
        await prisma.setting.upsert({
            where: { key: 'restaurant_logo' },
            update: { value: logoUrl },
            create: { key: 'restaurant_logo', value: logoUrl }
        });

        // Broadcast update
        const allSettings = await prisma.setting.findMany();
        const settingsMap = allSettings.reduce((acc: any, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        if (io) {
            io.emit('settings_updated', settingsMap);
        }

        res.status(200).json({
            message: "Logo uploaded successfully",
            logoUrl: logoUrl,
            settings: settingsMap
        });
    } catch (err: any) {
        console.error("Critical error during logo upload:", err);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Failed to upload logo",
                error: err.message || "Internal Server Error"
            });
        }
    }
};




