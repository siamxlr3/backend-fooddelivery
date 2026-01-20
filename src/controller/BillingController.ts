import { Request, Response } from 'express';
import { query, pool } from "../config/db.js";
import { io } from "../socket.js";

export const generateBill = async (req: Request, res: Response) => {
    try {
        const { orderId, tax: manualTax, discount: manualDiscount } = req.body;

        const orderResult = await query('SELECT * FROM "Order" WHERE id = $1', [orderId]);
        const order = orderResult.rows[0];

        if (!order) return res.status(404).json({ message: "Order not found" });

        // Check if bill already exists for this order
        const billResult = await query('SELECT * FROM "Bill" WHERE "orderId" = $1', [orderId]);
        const existingBill = billResult.rows[0];

        // If manual tax/discount are provided, we should update the bill or create a new one
        if (existingBill && existingBill.isPaid) {
            return res.status(200).json(existingBill);
        }

        const subtotal = Number(order.totalAmount);
        let tax: number;
        let discount: number;

        if (manualTax !== undefined && manualDiscount !== undefined) {
            tax = Number(manualTax);
            discount = Number(manualDiscount);
        } else {
            // Fetch tax and discount from Setting table if not provided
            const settingsResult = await query(
                'SELECT key, value FROM "Setting" WHERE key IN (\'tax_rate\', \'discount_rate\')'
            );
            const settingsMap = settingsResult.rows.reduce((acc: any, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, { tax_rate: "0", discount_rate: "0" });

            const taxRate = parseFloat(settingsMap.tax_rate) / 100;
            const discountPercentage = parseFloat(settingsMap.discount_rate) / 100;

            tax = subtotal * taxRate;
            discount = subtotal * discountPercentage;
        }

        const grandTotal = subtotal + tax - discount;

        // Generate Invoice Number
        const invoiceNumber = existingBill?.invoiceNumber || `INV-${Date.now()}`;

        let bill;
        if (existingBill) {
            const updateResult = await query(
                'UPDATE "Bill" SET subtotal = $1, tax = $2, discount = $3, "grandTotal" = $4 WHERE id = $5 RETURNING *',
                [subtotal, tax, discount, grandTotal, existingBill.id]
            );
            bill = updateResult.rows[0];
        } else {
            const createResult = await query(
                'INSERT INTO "Bill" ("orderId", "invoiceNumber", subtotal, tax, discount, "grandTotal", "isPaid") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [orderId, invoiceNumber, subtotal, tax, discount, grandTotal, false]
            );
            bill = createResult.rows[0];
        }

        res.status(201).json(bill);
    } catch (err) {
        console.error('Generate Bill Error:', err);
        res.status(500).json({ message: "Failed to generate bill" });
    }
};

export const processPayment = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { billId, amount, method, reference } = req.body;
        const userID = req.userID;

        await client.query('BEGIN');

        const billResult = await client.query('SELECT * FROM "Bill" WHERE id = $1', [billId]);
        const bill = billResult.rows[0];

        if (!bill) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Bill not found" });
        }

        const transactionResult = await client.query(
            'INSERT INTO "Transaction" ("billId", amount, method, reference, "createdAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
            [billId, amount, method, reference]
        );
        const transaction = transactionResult.rows[0];

        // Update bill status if fully paid
        if (Number(amount) >= Number(bill.grandTotal)) {
            await client.query(
                'UPDATE "Bill" SET "isPaid" = true, "paymentMethod" = $1 WHERE id = $2',
                [method, billId]
            );

            // Link to session if exists
            let currentSessionId = null;
            if (userID) {
                const sessionResult = await client.query(
                    'SELECT id FROM "Session" WHERE "userId" = $1 AND status = \'OPEN\' LIMIT 1',
                    [userID]
                );
                if (sessionResult.rows[0]) currentSessionId = sessionResult.rows[0].id;
            }

            const updatedOrderResult = await client.query(
                'UPDATE "Order" SET status = \'Paid\', "sessionId" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *',
                [currentSessionId, bill.orderId]
            );
            const updatedOrder = updatedOrderResult.rows[0];

            // Fetch order details for socket emit
            const orderItemsResult = await client.query(`
                SELECT oi.*, row_to_json(f.*) as food
                FROM "OrderItem" oi
                JOIN "Food" f ON oi."foodId" = f.id
                WHERE oi."orderId" = $1
            `, [bill.orderId]);
            updatedOrder.items = orderItemsResult.rows;

            const waiterResult = await client.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [updatedOrder.waiterId]);
            updatedOrder.waiter = waiterResult.rows[0];

            io.emit('order_status_update', updatedOrder);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Payment recorded", transaction });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Payment Error:', err);
        res.status(500).json({ message: "Payment failed" });
    } finally {
        client.release();
    }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
    try {
        const transactionsResult = await query(`
            SELECT t.*, 
                row_to_json(b.*) as bill,
                (
                    SELECT row_to_json(o_sub.*)
                    FROM "Order" o_sub
                    WHERE o_sub.id = b."orderId"
                ) as order_details
            FROM "Transaction" t
            JOIN "Bill" b ON t."billId" = b.id
            ORDER BY t."createdAt" DESC
            LIMIT 50
        `);

        // Match the complex structure Prisma provided
        const transactions = transactionsResult.rows.map(t => {
            const bill = t.bill;
            if (bill && t.order_details) {
                bill.order = {
                    orderNumber: t.order_details.orderNumber,
                    type: t.order_details.type
                };
            }
            delete t.order_details;
            return t;
        });

        res.status(200).json(transactions);
    } catch (err) {
        console.error('getPaymentHistory error:', err);
        res.status(500).json({ message: "Failed to fetch payment history" });
    }
};

export const deleteBill = async (req: Request, res: Response) => {
    try {
        const { invoiceNumber, id } = req.query;

        if (invoiceNumber) {
            const result = await query('DELETE FROM "Bill" WHERE "invoiceNumber" = $1 RETURNING *', [invoiceNumber as string]);
            if (result.rows.length > 0) {
                return res.status(200).json({
                    message: `Successfully deleted bill`,
                    deletedCount: result.rows.length
                });
            } else {
                return res.status(404).json({ message: "Bill not found" });
            }
        } else if (id) {
            const billId = parseInt(id as string);
            const result = await query('DELETE FROM "Bill" WHERE id = $1 RETURNING *', [billId]);
            const bill = result.rows[0];

            if (!bill) return res.status(404).json({ message: "Bill not found" });

            return res.status(200).json({
                message: "Bill deleted successfully",
                deletedBill: bill
            });
        } else {
            return res.status(400).json({ message: "Please provide either invoiceNumber or id" });
        }
    } catch (err) {
        console.error('Delete Bill Error:', err);
        res.status(500).json({ message: "Failed to delete bill" });
    }
};
