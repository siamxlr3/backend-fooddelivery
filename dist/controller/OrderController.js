import { prisma } from "../prisma.js";
import { io } from "../socket.js"; // Import socket instance
export const createOrder = async (req, res) => {
    try {
        const { type, tableNumber, customerName, customerPhone, items, sessionId } = req.body;
        // items: [{ foodId, quantity, notes }]
        // Check if user has an active session (for Cashier role)
        const user = await prisma.user.findUnique({ where: { id: req.userID } });
        if (user?.role === 'Cashier' || user?.role === 'Admin') {
            const activeSession = await prisma.session.findFirst({
                where: { userId: req.userID, status: 'OPEN' }
            });
            if (!activeSession) {
                return res.status(403).json({
                    message: "No active session. Please start a session before creating orders.",
                    requireSession: true
                });
            }
            // Auto-assign session ID if not provided
            if (!sessionId) {
                req.body.sessionId = activeSession.id;
            }
        }
        // Calculate total
        let totalAmount = 0;
        const orderItemsData = [];
        for (const item of items) {
            const food = await prisma.food.findUnique({ where: { id: item.foodId } });
            if (!food)
                continue;
            const itemOriginalPrice = Number(food.price);
            const discountPercent = Number(food.discountPercentage || 0);
            const discountedUnitPrice = itemOriginalPrice - (itemOriginalPrice * discountPercent / 100);
            const subtotal = discountedUnitPrice * item.quantity;
            totalAmount += subtotal;
            orderItemsData.push({
                foodId: item.foodId,
                quantity: item.quantity,
                unitPrice: discountedUnitPrice,
                subtotal: subtotal,
                notes: item.notes
            });
        }
        const newOrder = await prisma.order.create({
            data: {
                type,
                tableNumber,
                customerName,
                customerPhone,
                totalAmount,
                sessionId: req.body.sessionId,
                status: 'New',
                waiterId: req.userID, // Assumes VerifyToken populates this
                items: {
                    create: orderItemsData
                }
            },
            include: {
                items: { include: { food: true } },
                waiter: true
            }
        });
        // Emit to Kitchen
        io.emit('new_order', newOrder);
        res.status(201).json({ message: "Order placed", order: newOrder });
    }
    catch (err) {
        console.error("Create Order Error:", err);
        res.status(500).json({ message: "Failed to create order" });
    }
};
export const getOrders = async (req, res) => {
    try {
        const { status, page = 1, take = 10 } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;
        const whereClause = {};
        if (status) {
            if (typeof status === 'string' && status.includes(',')) {
                whereClause.status = { in: status.split(',') };
            }
            else {
                whereClause.status = status;
            }
        }
        const total = await prisma.order.count({ where: whereClause });
        // Prepare status filter for raw query safely
        let statusFilterSql = '';
        if (status) {
            const allowedStatuses = ['New', 'InProgress', 'Ready', 'Served', 'Paid', 'Cancelled'];
            const requestedStatuses = typeof status === 'string' ? status.split(',') : [String(status)];
            const validRequestedStatuses = requestedStatuses.filter(s => allowedStatuses.includes(s));
            if (validRequestedStatuses.length > 0) {
                statusFilterSql = `WHERE o.status::text IN (${validRequestedStatuses.map(s => `'${s}'`).join(',')})`;
            }
        }
        // Use raw query for custom status priority sorting + pagination
        // Priority: Served (1) > Ready (2) > New (3) > InProgress (4) > others (5)
        const orders = await prisma.$queryRawUnsafe(`
            SELECT o.*
            FROM "Order" o
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
            LIMIT ${takeNum} OFFSET ${skip}
        `);
        // Fetch full relations for these IDs to maintain typed consistency
        const orderIds = orders.map(o => o.id);
        const fullOrders = await prisma.order.findMany({
            where: { id: { in: orderIds } },
            include: {
                items: { include: { food: true } },
                waiter: true,
                customer: true
            },
        });
        // Maintain the custom priority order from the raw query
        const sortedOrders = orderIds.map(id => fullOrders.find(o => o.id === id)).filter(Boolean);
        res.status(200).json({
            data: sortedOrders,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / takeNum)
        });
    }
    catch (err) {
        console.error("Get Orders Error:", err);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
};
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updatedOrder = await prisma.order.update({
            where: { id: Number(id) },
            data: { status },
            include: { items: { include: { food: true } } }
        });
        io.emit('order_status_update', updatedOrder);
        // TODO: Handle stock reduction if status passes a certain point (e.g. InProgress or Served)
        res.status(200).json(updatedOrder);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to update order status" });
    }
};
