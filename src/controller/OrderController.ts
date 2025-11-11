import {Request, Response} from "express";
import Stripe from "stripe";
import {prisma} from "../prisma.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);



const makePaymentRequest = async (req:Request, res:Response) => {
    const { userID, address } = req.body;
    try {
        // Find all cart items for this user
        const carts = await prisma.cart.findMany({
            where: { userID, status: "Pending" },
            include: { food: true },
        });

        if (!carts || carts.length === 0) {
            return res.status(400).json({ message: "No items found in cart" });
        }

        // Stripe line items
        const lineItems = carts.map((item) => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: item.food.name,
                    images: [item.food.image],
                },
                unit_amount: Math.round(Number(item.food.price) * 100),
            },
            quantity: item.quantity,
        }));

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            payment_method_types: ["card"],
            mode: "payment",
            // success_url: `${baseURL}/success?session_id={CHECKOUT_SESSION_ID}`,
            // cancel_url: `${baseURL}/cancel`,
            metadata: {
                userID: userID.toString(),
                address: address || "N/A",
            },
        });

        res.status(200).json({
            message: "Payment session created successfully",
            id: session.id,
        });
    } catch (err) {
        console.error("Stripe error:", err);
        res.status(500).json({ message: "Payment initialization failed" });
    }
};


const confirmPayment = async (req:Request, res:Response) => {
    const { session_id } = req.body;
    try {
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ["line_items", "payment_intent"],
        });

        if (!session.metadata || !session.metadata.userID) {
            return res.status(400).json({ message: "Missing metadata in session" });
        }

        const userID = Number(session.metadata.userID);
        const address = session.metadata.address || "N/A";
        const amount = session.amount_total ? session.amount_total / 100 : 0;

        const carts = await prisma.cart.findMany({
            where: { userID, status: "Pending" },
            include: { food: true },
        });

        const items = carts.map((item) => ({
            name: item.food.name,
            quantity: item.quantity,
            total: item.totalPrice,
        }));

        // Save Payment
        const payment = await prisma.payment.create({
            data: {
                userID,
                item: JSON.stringify(items),
                amount,
                address,
                status: session.payment_status === "paid",
            },
        });

        // Update cart status to Paid
        await prisma.cart.updateMany({
            where: { userID, status: "Pending" },
            data: { status: "Success", updatedAt: new Date() },
        });

        res.status(200).json({
            message: "Payment confirmed successfully",
            payment,
        });
    } catch (err) {
        console.error("Payment confirmation error:", err);
        res.status(400).json({ message: "Failed to confirm payment" });
    }
};