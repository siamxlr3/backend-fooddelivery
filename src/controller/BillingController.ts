import { Request, Response } from 'express';
import { prisma } from "../prisma.js";
import { io } from "../socket.js";

export const generateBill = async (req: Request, res: Response) => {
    try {
        const { orderId, tax: manualTax, discount: manualDiscount } = req.body;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order) return res.status(404).json({ message: "Order not found" });

        // Check if bill already exists for this order
        const existingBill = await prisma.bill.findUnique({
            where: { orderId }
        });

        // If manual tax/discount are provided, we should update the bill or create a new one
        // For now, let's allow updating if it exists and hasn't been paid
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
            // Fetch tax and discount from Settings table if not provided
            const settings = await prisma.setting.findMany({
                where: {
                    key: { in: ['tax_rate', 'discount_rate'] }
                }
            });

            const settingsMap = settings.reduce((acc: any, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, { tax_rate: "0", discount_rate: "0" });

            const taxRate = parseFloat(settingsMap.tax_rate) / 100;
            const discountPercentage = parseFloat(settingsMap.discount_rate) / 100;

            tax = subtotal * taxRate;
            discount = subtotal * discountPercentage;
        }

        const grandTotal = subtotal + tax - discount;

        // Generate Invoice Number (Simple timestamp/random for now)
        const invoiceNumber = existingBill?.invoiceNumber || `INV-${Date.now()}`;

        let bill;
        if (existingBill) {
            bill = await prisma.bill.update({
                where: { id: existingBill.id },
                data: {
                    subtotal,
                    tax,
                    discount,
                    grandTotal,
                }
            });
        } else {
            bill = await prisma.bill.create({
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
        }

        res.status(201).json(bill);
    } catch (err) {
        console.error('Generate Bill Error:', err);
        res.status(500).json({ message: "Failed to generate bill" });
    }
};

export const processPayment = async (req: Request, res: Response) => {
    try {
        const { billId, amount, method, reference } = req.body;
        const bill = await prisma.bill.findUnique({ where: { id: billId } });

        if (!bill) return res.status(404).json({ message: "Bill not found" });

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
                if (currentSession) currentSessionId = currentSession.id;
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
    } catch (err) {
        console.error('Payment Error:', err);
        res.status(500).json({ message: "Payment failed" });
    }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
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
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch payment history" });
    }
};

export const deleteBill = async (req: Request, res: Response) => {
    try {
        const { invoiceNumber, id } = req.query;

        if (invoiceNumber) {
            const result = await prisma.bill.deleteMany({
                where: { invoiceNumber: invoiceNumber as string }
            });

            if (result.count > 0) {
                return res.status(200).json({
                    message: `Successfully deleted ${result.count} bill(s)`,
                    deletedCount: result.count
                });
            } else {
                return res.status(404).json({ message: "Bill not found" });
            }
        } else if (id) {
            const billId = parseInt(id as string);
            const bill = await prisma.bill.delete({
                where: { id: billId }
            });

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
