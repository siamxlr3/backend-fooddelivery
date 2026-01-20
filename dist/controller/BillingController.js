import { prisma } from "../prisma.js";
import { io } from "../socket.js";
export const generateBill = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });
        if (!order)
            return res.status(404).json({ message: "Order not found" });
        // Fetch tax and discount from Settings table
        const settings = await prisma.setting.findMany({
            where: {
                key: { in: ['tax_rate', 'discount_rate'] }
            }
        });
        const settingsMap = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, { tax_rate: "0", discount_rate: "0" });
        const subtotal = Number(order.totalAmount);
        const taxRate = parseFloat(settingsMap.tax_rate) / 100;
        const discountPercentage = parseFloat(settingsMap.discount_rate) / 100;
        const tax = subtotal * taxRate;
        const discount = subtotal * discountPercentage;
        const grandTotal = subtotal + tax - discount;
        // Generate Invoice Number (Simple timestamp/random for now)
        const invoiceNumber = `INV-${Date.now()}`;
        const bill = await prisma.bill.create({
            data: {
                orderId,
                invoiceNumber,
                subtotal,
                tax,
                discount,
                grandTotal,
                isPaid: false
            }
        });
        res.status(201).json(bill);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to generate bill" });
    }
};
export const processPayment = async (req, res) => {
    try {
        const { billId, amount, method, reference } = req.body;
        const bill = await prisma.bill.findUnique({ where: { id: billId } });
        if (!bill)
            return res.status(404).json({ message: "Bill not found" });
        const transaction = await prisma.transaction.create({
            data: {
                billId,
                amount,
                method,
                reference
            }
        });
        // Update bill status if fully paid (simple logic: amount >= grandTotal)
        // In real app, you sum up all transactions
        if (Number(amount) >= Number(bill.grandTotal)) {
            await prisma.bill.update({
                where: { id: billId },
                data: { isPaid: true, paymentMethod: method }
            });
            // Link to session if exists
            const userId = req.userID;
            let currentSessionId = undefined;
            if (userId) {
                const currentSession = await prisma.session.findFirst({
                    where: { userId, status: 'OPEN' }
                });
                if (currentSession)
                    currentSessionId = currentSession.id;
            }
            const updatedOrder = await prisma.order.update({
                where: { id: bill.orderId },
                data: {
                    status: 'Paid',
                    sessionId: currentSessionId
                },
                include: {
                    items: { include: { food: true } },
                    waiter: true
                }
            });
            io.emit('order_status_update', updatedOrder);
        }
        res.status(200).json({ message: "Payment recorded", transaction });
    }
    catch (err) {
        console.error('Payment Error:', err);
        res.status(500).json({ message: "Payment failed" });
    }
};
export const getPaymentHistory = async (req, res) => {
    try {
        const transactions = await prisma.transaction.findMany({
            include: {
                bill: {
                    include: {
                        order: {
                            select: { orderNumber: true, type: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.status(200).json(transactions);
    }
    catch (err) {
        res.status(500).json({ message: "Failed to fetch payment history" });
    }
};
