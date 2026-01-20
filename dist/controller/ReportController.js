import { query } from "../config/db.js";
export const getDailyReport = async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, waiterId, status, page = 1, take = 10 } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;
        let whereClauses = [];
        const params = [];
        whereClauses.push(`o.status = $${params.length + 1}`);
        params.push(status ? status : 'Paid');
        if (startDate) {
            whereClauses.push(`o."createdAt" >= $${params.length + 1}`);
            params.push(new Date(startDate));
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);
            whereClauses.push(`o."createdAt" < $${params.length + 1}`);
            params.push(end);
        }
        if (paymentMethod) {
            whereClauses.push(`b."paymentMethod" = $${params.length + 1}`);
            params.push(paymentMethod);
        }
        if (waiterId) {
            whereClauses.push(`o."waiterId" = $${params.length + 1}`);
            params.push(Number(waiterId));
        }
        const whereSql = ' WHERE ' + whereClauses.join(' AND ');
        // Summary Statistics
        const statsQuery = `
            SELECT SUM(o."totalAmount") as "totalSales", COUNT(o.id) as "orderCount"
            FROM "Order" o
            LEFT JOIN "Bill" b ON o.id = b."orderId"
            ${whereSql}
        `;
        const statsResult = await query(statsQuery, params);
        const stats = statsResult.rows[0];
        // Chart Data (Grouped by Day)
        const chartQuery = `
            SELECT DATE(o."createdAt") as date, SUM(o."totalAmount") as amount
            FROM "Order" o
            LEFT JOIN "Bill" b ON o.id = b."orderId"
            ${whereSql}
            GROUP BY DATE(o."createdAt")
            ORDER BY date ASC
        `;
        const chartResult = await query(chartQuery, params);
        // Paginated Orders for Table
        const ordersQuery = `
            SELECT o.*, 
                row_to_json(u.*) as waiter,
                row_to_json(b.*) as bill,
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
            LEFT JOIN "Bill" b ON o.id = b."orderId"
            ${whereSql}
            ORDER BY o."createdAt" DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        const paginatedResult = await query(ordersQuery, [...params, takeNum, skip]);
        res.status(200).json({
            summary: {
                totalSales: Number(stats.totalSales || 0),
                orderCount: parseInt(stats.orderCount || 0),
            },
            orders: paginatedResult.rows,
            totalOrders: parseInt(stats.orderCount || 0),
            page: pageNum,
            totalPages: Math.ceil(parseInt(stats.orderCount || 0) / takeNum),
            chartData: chartResult.rows.map(row => ({
                date: row.date.toISOString().split('T')[0],
                amount: Number(row.amount)
            }))
        });
    }
    catch (err) {
        console.error("getDailyReport error:", err);
        res.status(500).json({ message: "Failed to fetch report" });
    }
};
export const getTopSellingItems = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let whereClauses = ["o.status = 'Paid'"];
        const params = [];
        if (startDate) {
            whereClauses.push(`o."createdAt" >= $${params.length + 1}`);
            params.push(new Date(startDate));
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);
            whereClauses.push(`o."createdAt" < $${params.length + 1}`);
            params.push(end);
        }
        const whereSql = ' WHERE ' + whereClauses.join(' AND ');
        const topSellingQuery = `
            SELECT oi."foodId", SUM(oi.quantity) as "totalQuantity", row_to_json(f.*) as food
            FROM "OrderItem" oi
            JOIN "Order" o ON oi."orderId" = o.id
            JOIN "Food" f ON oi."foodId" = f.id
            ${whereSql}
            GROUP BY oi."foodId", f.id
            ORDER BY "totalQuantity" DESC
            LIMIT 10
        `;
        const result = await query(topSellingQuery, params);
        const data = result.rows.map(row => ({
            foodName: row.food.name,
            category: row.food.categoryId,
            totalQuantity: parseInt(row.totalQuantity),
            price: Number(row.food.price)
        }));
        res.status(200).json(data);
    }
    catch (err) {
        console.error("getTopSellingItems error:", err);
        res.status(500).json({ message: "Failed to fetch top selling items" });
    }
};
export const getMonthlyFinancialReport = async (req, res) => {
    try {
        const { year, month } = req.query;
        const currentYear = year ? Number(year) : new Date().getFullYear();
        const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);
        // INCOME
        const incomeResult = await query('SELECT SUM("totalAmount") as "totalIncome", COUNT(id) as "orderCount" FROM "Order" WHERE status = \'Paid\' AND "createdAt" >= $1 AND "createdAt" <= $2', [startDate, endDate]);
        const totalIncome = Number(incomeResult.rows[0].totalIncome || 0);
        const orderCount = parseInt(incomeResult.rows[0].orderCount || 0);
        // EXPENSE: Salaries
        const staffResult = await query('SELECT name, role, salary FROM "User" WHERE role IN (\'Cashier\', \'Waiter\', \'KitchenStaff\', \'Admin\') AND salary IS NOT NULL');
        const totalSalaries = staffResult.rows.reduce((acc, user) => acc + Number(user.salary || 0), 0);
        // EXPENSE: Supplier Purchases
        const supplierResult = await query('SELECT name, "itemType", "totalPurchaseAmount", "purchaseDate" FROM suppliers WHERE "purchaseDate" >= $1 AND "purchaseDate" <= $2', [startDate, endDate]);
        const totalSupplierExp = supplierResult.rows.reduce((acc, s) => acc + Number(s.totalPurchaseAmount || 0), 0);
        const totalExpense = totalSalaries + totalSupplierExp;
        const netProfit = totalIncome - totalExpense;
        res.status(200).json({
            summary: {
                totalIncome,
                totalExpense,
                netProfit,
                staffCost: totalSalaries,
                supplierCost: totalSupplierExp,
                orderCount
            },
            details: {
                staff: staffResult.rows,
                supplierPurchases: supplierResult.rows
            },
            period: {
                year: currentYear,
                month: currentMonth
            }
        });
    }
    catch (err) {
        console.error("getMonthlyFinancialReport error:", err);
        res.status(500).json({ message: "Failed to fetch financial report" });
    }
};
