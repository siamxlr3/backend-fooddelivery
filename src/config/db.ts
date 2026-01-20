import pg from 'pg';
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

export const query = (text: string, params?: any[]) => pool.query(text, params);
