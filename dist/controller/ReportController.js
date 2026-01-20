import { prisma } from "../prisma.js";
export const getDailyReport = async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, waiterId, status, page = 1, take = 10 } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;
        const where = {};
        // ... (rest of filtering logic remains same)
        where.status = status ? status : 'Paid';
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                where.createdAt.lt = end;
            }
        }
        if (paymentMethod) {
            where.bill = { paymentMethod: paymentMethod };
        }
        if (waiterId) {
            where.waiterId = Number(waiterId);
        }
        // Fetch ALL orders for summary and chart (efficient way without redundant DB hits is hard with current structure)
        // For now, let's fetch summary first
        const stats = await prisma.order.aggregate({
            where,
            _sum: { totalAmount: true },
            _count: { id: true }
        });
        // Fetch grouped sales for chart (still needs full range)
        const allOrdersForChart = await prisma.order.findMany({
            where,
            select: { createdAt: true, totalAmount: true }
        });
        const groupedSales = allOrdersForChart.reduce((acc, order) => {
            const date = new Date(order.createdAt).toISOString().split('T')[0];
            if (!acc[date])
                acc[date] = 0;
            acc[date] += Number(order.totalAmount);
            return acc;
        }, {});
        // Fetch paginated orders for the table
        const paginatedOrders = await prisma.order.findMany({
            where,
            include: {
                waiter: { select: { name: true } },
                bill: true,
                items: { include: { food: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: takeNum
        });
        res.status(200).json({
            summary: {
                totalSales: stats._sum.totalAmount || 0,
                orderCount: stats._count.id,
            },
            orders: paginatedOrders,
            totalOrders: stats._count.id,
            page: pageNum,
            totalPages: Math.ceil(stats._count.id / takeNum),
            chartData: Object.entries(groupedSales).map(([date, amount]) => ({ date, amount }))
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch report" });
    }
};
export const getTopSellingItems = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const where = {
            order: {
                status: 'Paid'
            }
        };
        if (startDate || endDate) {
            where.order.createdAt = {};
            if (startDate) {
                where.order.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setDate(end.getDate() + 1);
                where.order.createdAt.lt = end;
            }
        }
        const topSelling = await prisma.orderItem.groupBy({
            by: ['foodId'],
            _sum: {
                quantity: true,
            },
            where,
            orderBy: {
                _sum: {
                    quantity: 'desc'
                }
            },
            take: 10
        });
        const foodIds = topSelling.map(item => item.foodId);
        const foods = await prisma.food.findMany({
            where: {
                id: { in: foodIds }
            }
        });
        const result = topSelling.map(item => {
            const food = foods.find(f => f.id === item.foodId);
            return {
                foodName: food?.name || 'Unknown',
                category: food?.categoryId || 'N/A',
                totalQuantity: item._sum.quantity || 0,
                price: food?.price || 0
            };
        });
        res.status(200).json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch top selling items" });
    }
};
