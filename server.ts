import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// API routes
app.post("/api/razorpay/create-order", async (req, res) => {
  const { booking_id, shop_id, amount } = req.body;
  // TODO: Validate user
  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // INR in paise
      currency: "INR",
      receipt: `receipt_${booking_id}`,
    });

    // Save order in db
    await supabase.from("razorpay_orders").insert({
      booking_id,
      shop_id,
      razorpay_order_id: order.id,
      amount,
      status: "created",
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.post("/api/razorpay/webhook", async (req, res) => {
    // Handle webhook
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest === req.headers["x-razorpay-signature"]) {
        const event = req.body.event;
        if (event === "payment.captured") {
            const payment = req.body.payload.payment.entity;
            // Record payment and update booking
            await supabase.rpc("record_captured_razorpay_payment", {
                payment_id: payment.id,
                order_id: payment.order_id,
                amount: payment.amount / 100,
            });
        }
        res.json({ status: "ok" });
    } else {
        res.status(400).send("Invalid signature");
    }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
