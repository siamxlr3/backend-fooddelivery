import { Request, Response } from 'express';
import { prisma } from "../prisma.js";

export const getDailyReport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, paymentMethod, waiterId, status, page = 1, take = 10 } = req.query;
        const pageNum = Number(page);
        const takeNum = Number(take);
        const skip = (pageNum - 1) * takeNum;

        const where: any = {};
        // ... (rest of filtering logic remains same)
        where.status = status ? status : 'Paid';

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate as string);
            }
            if (endDate) {
                const end = new Date(endDate as string);
                end.setDate(end.getDate() + 1);
                where.createdAt.lt = end;
            }
        }

        if (paymentMethod) {
            where.bill = { paymentMethod: paymentMethod as any };
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

        const groupedSales = allOrdersForChart.reduce((acc: any, order) => {
            const date = new Date(order.createdAt).toISOString().split('T')[0];
            if (!acc[date]) acc[date] = 0;
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch report" });
    }
};

export const getTopSellingItems = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const where: any = {
            order: {
                status: 'Paid'
            }
        };

        if (startDate || endDate) {
            where.order.createdAt = {};
            if (startDate) {
                where.order.createdAt.gte = new Date(startDate as string);
            }
            if (endDate) {
                const end = new Date(endDate as string);
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
                id: { in: foodIds as number[] }
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
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch top selling items" });
    }
};

export const getMonthlyFinancialReport = async (req: Request, res: Response) => {
    try {
        const { year, month } = req.query;
        const currentYear = year ? Number(year) : new Date().getFullYear();
        const currentMonth = month ? Number(month) : new Date().getMonth() + 1; // 1-12

        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        // INCOME: Total amount from Paid orders
        const income = await prisma.order.aggregate({
            where: {
                status: 'Paid',
                createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { totalAmount: true },
            _count: { id: true }
        });

        const totalIncome = Number(income._sum.totalAmount || 0);

        // EXPENSE 1: Salaries from Staff
        // We assume staff salaries are monthly expenses
        const staff = await prisma.user.findMany({
            where: {
                role: { in: ['Cashier', 'Waiter', 'KitchenStaff', 'Admin'] },
                salary: { not: null }
            },
            select: { name: true, role: true, salary: true }
        });

        const totalSalaries = staff.reduce((acc, user) => acc + Number(user.salary || 0), 0);

        // EXPENSE 2: Supplier Purchases
        const supplierPurchases = await prisma.supplier.findMany({
            where: {
                purchaseDate: { gte: startDate, lte: endDate }
            },
            select: { name: true, itemType: true, totalPurchaseAmount: true, purchaseDate: true }
        });

        const totalSupplierExp = supplierPurchases.reduce((acc, s) => acc + Number(s.totalPurchaseAmount || 0), 0);

        const totalExpense = totalSalaries + totalSupplierExp;
        const netProfit = totalIncome - totalExpense;

        res.status(200).json({
            summary: {
                totalIncome,
                totalExpense,
                netProfit,
                staffCost: totalSalaries,
                supplierCost: totalSupplierExp,
                orderCount: income._count.id
            },
            details: {
                staff,
                supplierPurchases
            },
            period: {
                year: currentYear,
                month: currentMonth
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch financial report" });
    }
};
