import { query } from "../config/db.js";
import { io } from "../socket.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const getSettings = async (req, res) => {
    try {
        const settingsResult = await query('SELECT * FROM "Setting"');
        const settingsMap = settingsResult.rows.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.status(200).json(settingsMap);
    }
    catch (err) {
        console.error("Error fetching settings:", err);
        res.status(500).json({ message: "Failed to fetch settings" });
    }
};
export const updateSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        const result = await query(`
            INSERT INTO "Setting" (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            RETURNING *
        `, [key, String(value)]);
        const allSettingsResult = await query('SELECT * FROM "Setting"');
        const settingsMap = allSettingsResult.rows.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        io.emit('settings_updated', settingsMap);
        res.status(200).json(result.rows[0]);
    }
    catch (err) {
        console.error("updateSetting error:", err);
        res.status(500).json({ message: "Failed to update setting" });
    }
};
export const updateMultipleSettings = async (req, res) => {
    try {
        const { settings } = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await query(`
                INSERT INTO "Setting" (key, value)
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            `, [key, String(value)]);
        }
        const allSettingsResult = await query('SELECT * FROM "Setting"');
        const settingsMap = allSettingsResult.rows.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        io.emit('settings_updated', settingsMap);
        res.status(200).json({ message: "Settings updated successfully", settings: settingsMap });
    }
    catch (err) {
        console.error("updateMultipleSettings error:", err);
        res.status(500).json({ message: "Failed to update settings" });
    }
};
export const uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        const tempPath = req.file.path;
        const targetDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const targetFilename = `logo_${Date.now()}${path.extname(req.file.originalname)}`;
        const targetPath = path.join(targetDir, targetFilename);
        fs.copyFileSync(tempPath, targetPath);
        fs.unlinkSync(tempPath);
        const logoUrl = `/uploads/${targetFilename}`;
        await query(`
            INSERT INTO "Setting" (key, value)
            VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, ['restaurant_logo', logoUrl]);
        const allSettingsResult = await query('SELECT * FROM "Setting"');
        const settingsMap = allSettingsResult.rows.reduce((acc, curr) => {
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
    }
    catch (err) {
        console.error("Critical error during logo upload:", err);
        if (!res.headersSent) {
            res.status(500).json({
                message: "Failed to upload logo",
                error: err.message || "Internal Server Error"
            });
        }
    }
};
