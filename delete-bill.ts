import { pool } from "./src/config/db.js";

async function deleteBill() {
    const client = await pool.connect();
    try {
        // Try to delete by invoice number first
        const result = await client.query('DELETE FROM "Bill" WHERE "invoiceNumber" = $1 RETURNING *', ['#9c4b7733']);

        if (result.rows.length > 0) {
            console.log(`✅ Successfully deleted ${result.rows.length} bill(s) with invoice number #9c4b7733`);
        } else {
            console.log('❌ No bill found with invoice number #9c4b7733');

            // Try to find and delete by ID if it's a numeric ID
            const billIdStr = '#9c4b7733'.replace('#', '');
            const billId = parseInt(billIdStr, 16);

            if (!isNaN(billId)) {
                console.log(`Trying to delete by ID: ${billId}`);
                const billByIdResult = await client.query('DELETE FROM "Bill" WHERE id = $1 RETURNING *', [billId]);

                if (billByIdResult.rows.length > 0) {
                    console.log(`✅ Successfully deleted bill with ID ${billId}`);
                } else {
                    console.log('❌ No bill found with that ID either');
                }
            }
        }
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteBill();
