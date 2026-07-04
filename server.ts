import express from "express";
import "dotenv/config";
import path from "path";
import { createServer as createViteServer } from "vite";
import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Supabase Admin Client
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("Missing Razorpay environment variables");
}
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// API routes
app.post("/api/razorpay/create-order", async (req, res) => {
  const { booking_id } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).send("Unauthorized");

  try {
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).send("Unauthorized");

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
        .from("customer_bookings")
        .select("*, shop:shops(*)")
        .eq("id", booking_id)
        .single();

    if (bookingError || booking.customer_id !== user.id) return res.status(403).send("Forbidden");

    // Fetch amount
    const amount = booking.total_amount; 

    const order = await razorpay.orders.create({
      amount: amount * 100, // INR in paise
      currency: "INR",
      receipt: `receipt_${booking_id}`,
    });

    // Update booking and insert order
    await supabase.from("razorpay_orders").insert({
      booking_id,
      customer_id: user.id,
      shop_id: booking.shop_id,
      owner_id: booking.shop.owner_id,
      razorpay_order_id: order.id,
      amount,
      status: "created",
    });

    await supabase.from("customer_bookings").update({
      payment_status: "order_created",
      razorpay_order_id: order.id
    }).eq("id", booking_id);

    res.json({ order_id: order.id, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.post("/api/razorpay/verify-payment", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    // Validate signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");
    
    if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid signature" });
    }
    
    res.json({ payment_verified: true });
});

app.post("/api/owner/payout-account", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send("Unauthorized");
    
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).send("Unauthorized");
    
    const { account_holder_name, bank_account_number, ifsc, upi_id } = req.body;
    
    // Check if account exists
    const { data: existing } = await supabase.from("owner_payout_accounts").select("id").eq("owner_id", user.id).maybeSingle();
    
    if (existing) {
        await supabase.from("owner_payout_accounts").update({ account_holder_name, bank_account_number, ifsc, upi_id }).eq("id", existing.id);
    } else {
        await supabase.from("owner_payout_accounts").insert({ owner_id: user.id, account_holder_name, bank_account_number, ifsc, upi_id });
    }
    
    res.json({ success: true });
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
                p_payment_id: payment.id,
                p_order_id: payment.order_id,
                p_amount: payment.amount / 100,
                p_method: payment.method,
                p_payload: req.body.payload
            });
            
            await supabase.from("customer_bookings")
                .update({ 
                    payment_status: "paid",
                    payment_method: payment.method,
                    razorpay_payment_id: payment.id,
                    paid_at: new Date().toISOString()
                })
                .eq("razorpay_order_id", payment.order_id);
        }
        res.json({ status: "ok" });
    } else {
        res.status(400).send("Invalid signature");
    }
});

app.post("/api/jobs/daily-owner-payout", async (req, res) => {
    // Placeholder
    res.json({ message: "Payout job triggered", status: "processing" });
});
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
