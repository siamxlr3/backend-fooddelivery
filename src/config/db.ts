import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Use the same environment variable Prisma uses
const connectionString = process.env.DATABASE_URL;

console.log("Database connection attempt...");
if (!connectionString) {
    console.error("CRITICAL ERROR: DATABASE_URL is not defined in process.env!");
} else {
    console.log("DATABASE_URL found. Length:", connectionString.length);
    // Log the start of the string to see if it's localhost or a cloud provider
    console.log("DATABASE_URL type:", connectionString.split(':')[0]);
}

export const pool = new Pool({
    connectionString,
    // On Render, we often need SSL enabled for external databases
    ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export const query = async (text: string, params?: any[]) => {
    try {
        return await pool.query(text, params);
    } catch (err: any) {
        console.error("DATABASE QUERY ERROR DETAILS:", {
            message: err.message,
            code: err.code,
            detail: err.detail,
            hint: err.hint,
            query: text,
            params: params
        });
        throw err;
    }
};
