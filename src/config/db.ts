import pg from 'pg';
const { Pool } = pg;

// Use the same environment variable Prisma uses
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
    connectionString,
    // On Render, we often need SSL enabled for external databases
    ssl: connectionString?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
