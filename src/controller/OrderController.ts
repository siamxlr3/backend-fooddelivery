import { Request, Response } from 'express';
import { query, pool } from "../config/db.js";
import { io } from "../socket.js";

export const createOrder = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { type, tableNumber, customerName, customerPhone, items, sessionId } = req.body;
        const userID = req.userID;

        // Check user role
        const userResult = await client.query('SELECT role FROM "User" WHERE id = $1', [userID]);
        const user = userResult.rows[0];

        let finalSessionId = sessionId;

        if (user?.role === 'Cashier' || user?.role === 'Admin') {
            const sessionResult = await client.query(
                'SELECT id FROM "Session" WHERE "userId" = $1 AND status = \'OPEN\' LIMIT 1',
                [userID]
            );
            const activeSession = sessionResult.rows[0];

            if (!activeSession) {
                return res.status(403).json({
                    message: "No active session. Please start a session before creating orders.",
                    requireSession: true
                });
            }

            if (!finalSessionId) {
                finalSessionId = activeSession.id;
            }
        }

        // VALIDATION: Check if table is reserved
        if (type === 'DineIn' && tableNumber) {
            const reservedResult = await client.query(`
                SELECT dt.id 
                FROM "DiningTable" dt 
                JOIN "Booking" b ON b."tableId" = dt.id 
                WHERE dt.number = $1 AND b.status = 'Reserved'
                LIMIT 1
            `, [tableNumber.toString()]);

            if (reservedResult.rows.length > 0) {
                return res.status(400).json({
                    message: `Table ${tableNumber} is currently reserved. Please seat the customer or choose another table.`
                });
            }
        }

        await client.query('BEGIN');

        // Create Order
        const orderResult = await client.query(`
            INSERT INTO "Order" (type, "tableNumber", "customerName", "customerPhone", "totalAmount", "sessionId", status, "waiterId", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            RETURNING *
        `, [type, tableNumber, customerName, customerPhone, 0, finalSessionId, 'New', userID]);
        const newOrder = orderResult.rows[0];

        let totalAmount = 0;
        const itemsWithFoodDetails = [];

        // Create Order Items
        for (const item of items) {
            const foodResult = await client.query('SELECT * FROM "Food" WHERE id = $1', [item.foodId]);
            const food = foodResult.rows[0];
            if (!food) continue;

            const itemOriginalPrice = Number(food.price);
            const discountPercent = Number(food.discountPercentage || 0);
            const discountedUnitPrice = itemOriginalPrice - (itemOriginalPrice * discountPercent / 100);
            const subtotal = discountedUnitPrice * item.quantity;

            totalAmount += subtotal;

            const orderItemResult = await client.query(`
                INSERT INTO "OrderItem" ("orderId", "foodId", quantity, "unitPrice", subtotal, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [newOrder.id, item.foodId, item.quantity, discountedUnitPrice, subtotal, item.notes]);

            itemsWithFoodDetails.push({
                ...orderItemResult.rows[0],
                food: food
            });
        }

        // Update totalAmount in Order
        await client.query('UPDATE "Order" SET "totalAmount" = $1 WHERE id = $2', [totalAmount, newOrder.id]);
        newOrder.totalAmount = totalAmount;
        newOrder.items = itemsWithFoodDetails;

        // Fetch waiter details
        const waiterResult = await client.query('SELECT id, name, email, role FROM "User" WHERE id = $1', [userID]);
        newOrder.waiter = waiterResult.rows[0];

        await client.query('COMMIT');

        // Emit to Kitchen
        io.emit('new_order', newOrder);

        res.status(201).json({ message: "Order placed", order: newOrder });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Create Order Error:", err);
        res.status(500).json({ message: "Failed to create order" });
    } finally {
        client.release();
    }
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const { status, page = 1, take = 10 } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;

        let statusFilterSql = '';
        const params: any[] = [];
        if (status) {
            const allowedStatuses = ['New', 'InProgress', 'Ready', 'Served', 'Paid', 'Cancelled'];
            const requestedStatuses = typeof status === 'string' ? status.split(',') : [String(status)];
            const validRequestedStatuses = requestedStatuses.filter(s => allowedStatuses.includes(s));

            if (validRequestedStatuses.length > 0) {
                statusFilterSql = `WHERE o.status::text IN (${validRequestedStatuses.map((_, i) => `$${i + 1}`).join(',')})`;
                params.push(...validRequestedStatuses);
            }
        }

        const countResult = await query(`SELECT COUNT(*) FROM "Order" o ${statusFilterSql}`, params);
        const total = parseInt(countResult.rows[0].count);

        const ordersResult = await query(`
            SELECT o.*, 
                row_to_json(u.*) as waiter,
                row_to_json(cust.*) as customer,
                (
                    SELECT json_agg(json_build_object(
                        'id', oi.id,
                        'orderId', oi."orderId",
                        'foodId', oi."foodId",
                        'quantity', oi.quantity,
                        'unitPrice', oi."unitPrice",
                        'subtotal', oi.subtotal,
                        'notes', oi.notes,
                        'food', row_to_json(f.*)
                    ))
                    FROM "OrderItem" oi
                    JOIN "Food" f ON oi."foodId" = f.id
                    WHERE oi."orderId" = o.id
                ) as items
            FROM "Order" o
            LEFT JOIN "User" u ON o."waiterId" = u.id
            LEFT JOIN "Customer" cust ON o."customerId" = cust.id
            ${statusFilterSql}
            ORDER BY 
                CASE 
                    WHEN o.status::text = 'Served' THEN 1
                    WHEN o.status::text = 'Ready' THEN 2
                    WHEN o.status::text = 'New' THEN 3
                    WHEN o.status::text = 'InProgress' THEN 4
                    ELSE 5
                END ASC,
                o."createdAt" DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, takeNum, skip]);

        res.status(200).json({
            data: ordersResult.rows,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / takeNum)
        });
    } catch (err) {
        console.error("Get Orders Error:", err);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await query(`
            UPDATE "Order" 
            SET status = $1, "updatedAt" = NOW() 
            WHERE id = $2 
            RETURNING *
        `, [status, Number(id)]);
        const updatedOrder = result.rows[0];

        if (!updatedOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Fetch items and food details
        const itemsResult = await query(`
            SELECT oi.*, row_to_json(f.*) as food
            FROM "OrderItem" oi
            JOIN "Food" f ON oi."foodId" = f.id
            WHERE oi."orderId" = $1
        `, [updatedOrder.id]);
        updatedOrder.items = itemsResult.rows;

        io.emit('order_status_update', updatedOrder);

        res.status(200).json(updatedOrder);
    } catch (err) {
        console.error("updateOrderStatus error:", err);
        res.status(500).json({ message: "Failed to update order status" });
    }
};

export const deleteOrder = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { orderNumber, id } = req.query;
        let orderId: number | null = null;

        if (orderNumber) {
            const result = await client.query('SELECT id FROM "Order" WHERE "orderNumber" = $1', [orderNumber as string]);
            if (result.rows[0]) orderId = result.rows[0].id;
        } else if (id) {
            orderId = parseInt(id as string);
        }

        if (!orderId) {
            return res.status(404).json({ message: "Order not found" });
        }

        await client.query('BEGIN');

        // 1. Transaction handling (bill and transactions)
        const billResult = await client.query('SELECT id FROM "Bill" WHERE "orderId" = $1', [orderId]);
        const bill = billResult.rows[0];

        if (bill) {
            await client.query('DELETE FROM "Transaction" WHERE "billId" = $1', [bill.id]);
            await client.query('DELETE FROM "Bill" WHERE id = $1', [bill.id]);
        }

        // 2. Delete order items
        await client.query('DELETE FROM "OrderItem" WHERE "orderId" = $1', [orderId]);

        // 3. Finally delete the order
        const deletedOrderResult = await client.query('DELETE FROM "Order" WHERE id = $1 RETURNING *', [orderId]);
        const deletedOrder = deletedOrderResult.rows[0];

        await client.query('COMMIT');

        io.emit('order_deleted', { orderId });

        res.status(200).json({
            message: "Order and all related data deleted successfully",
            deletedOrder
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Order Error:', err);
        res.status(500).json({ message: "Failed to delete order" });
    } finally {
        client.release();
    }
};