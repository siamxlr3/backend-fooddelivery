import { prisma } from "../prisma.js";
import { io } from "../socket.js";
export const getSettings = async (req, res) => {
    try {
        const settings = await prisma.setting.findMany();
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.status(200).json(settingsMap);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to fetch settings" });
    }
};
export const updateSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        const setting = await prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        });
        // Fetch all settings to broadcast
        const allSettings = await prisma.setting.findMany();
        const settingsMap = allSettings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        // Broadcast settings update via Socket.IO
        io.emit('settings_updated', settingsMap);
        res.status(200).json(setting);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to update setting" });
    }
};
export const updateMultipleSettings = async (req, res) => {
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
        const settingsMap = allSettings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        // Broadcast settings update via Socket.IO
        io.emit('settings_updated', settingsMap);
        res.status(200).json({ message: "Settings updated successfully", settings: settingsMap });
    }
    catch (err) {
        res.status(500).json({ message: "Failed to update settings" });
    }
};
