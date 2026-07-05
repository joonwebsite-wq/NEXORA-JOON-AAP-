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
  const { booking_id, reward_redeemed_amount } = req.body;
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
    if (booking.payment_status === 'paid') return res.status(400).send("Booking already paid");

    // 1. Ensure membership
    await supabase.rpc("ensure_customer_membership", { customer_id: user.id });

    // 2. Apply membership discount
    const { data: membershipData, error: membershipError } = await supabase.rpc("apply_customer_membership_discount", {
        customer_id: user.id,
        shop_id: booking.shop_id,
        booking_id: booking_id,
        gross_amount: booking.total_amount
    });
    
    if (membershipError) {
        console.error(membershipError);
        return res.status(400).json({ error: "Failed to apply membership discount" });
    }

    let amount_after_membership = membershipData.final_amount;
    let final_payable_amount = amount_after_membership;
    let reward_to_redeem = 0;

    if (reward_redeemed_amount && reward_redeemed_amount > 0) {
        // Validate and apply reward on amount_after_membership
        const { data, error } = await supabase.rpc("apply_customer_reward_redemption", {
            customer_id: user.id,
            shop_id: booking.shop_id,
            booking_id: booking_id,
            redemption_amount: reward_redeemed_amount
        });

        if (error) {
            console.error(error);
            return res.status(400).json({ error: "Failed to apply reward" });
        }
        
        reward_to_redeem = reward_redeemed_amount;
        final_payable_amount = Math.max(1, amount_after_membership - reward_to_redeem);
    }

    const order = await razorpay.orders.create({
      amount: final_payable_amount * 100, // INR in paise
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
      amount: final_payable_amount,
      gross_service_amount: booking.total_amount,
      membership_id: membershipData.membership_id,
      membership_discount_percent: membershipData.discount_percent,
      membership_discount_amount: membershipData.discount_amount,
      reward_redeemed_amount: reward_to_redeem,
      final_payable_amount: final_payable_amount,
      status: "created",
    });

    await supabase.from("customer_bookings").update({
      payment_status: "order_created",
      razorpay_order_id: order.id,
      payment_amount: final_payable_amount,
      payable_amount: final_payable_amount,
      reward_redeemed_amount: reward_to_redeem,
      membership_discount_amount: membershipData.discount_amount
    }).eq("id", booking_id);

    res.json({ order_id: order.id, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.post("/api/razorpay/remove-reward", async (req, res) => {
    const { booking_id } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) return res.status(401).send("Unauthorized");

    try {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return res.status(401).send("Unauthorized");

        await supabase.rpc("reverse_customer_reward_redemption", {
            booking_id: booking_id,
            reason: 'Customer removed reward before payment.'
        });

        await supabase.from("customer_bookings").update({
            reward_redeemed_amount: 0,
            payable_amount: null // Will be reset on UI or need fetch total_amount again
        }).eq("id", booking_id);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to remove reward" });
    }
});

app.post("/api/razorpay/webhook", async (req, res) => {
    // Verify signature
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

            // Credit customer reward
            await supabase.rpc("credit_customer_reward_for_razorpay_payment", {
                razorpay_payment_id: payment.id
            });

            // Process referral
            await supabase.rpc("process_referral_after_razorpay_payment", {
                razorpay_payment_id: payment.id
            });
        }
        res.json({ status: "ok" });
    } else {
        res.status(400).send("Invalid signature");
    }
});

app.post("/api/razorpay/process-refund", async (req, res) => {
    const { refund_request_id } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader) return res.status(401).send("Unauthorized");

    try {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (!user) return res.status(401).send("Unauthorized");

        // Verify admin
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (profile?.role !== 'super_admin') return res.status(403).send("Forbidden");

        // Fetch refund request
        const { data: refundRequest } = await supabase
            .from("payment_refund_requests")
            .select("*, booking:customer_bookings(*)")
            .eq("id", refund_request_id)
            .single();

        if (!refundRequest || refundRequest.status !== 'approved') return res.status(400).send("Invalid refund request");

        // Razorpay refund
        const razorpay_payment_id = refundRequest.booking.razorpay_payment_id;
        const refund = await razorpay.payments.refund(razorpay_payment_id, {
            amount: refundRequest.approved_amount * 100, // paise
            notes: {
                refund_request_id,
                booking_id: refundRequest.booking_id,
            }
        });

        // Mark processing
        await supabase.rpc("service_mark_refund_processing", {
            p_refund_request_id: refund_request_id,
            p_razorpay_refund_id: refund.id,
            p_raw_payload: refund
        });

        res.json({ success: true, refund_id: refund.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to process refund" });
    }
});

// ... existing routes ...

app.post("/api/owner/payout-account", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send("Unauthorized");
    
    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return res.status(401).send("Unauthorized");
    
    // Find shop for owner
    const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).single();
    if (!shop) return res.status(404).send("Shop not found");

    const { destination_type, account_holder_name, bank_account_number, bank_ifsc, upi_id } = req.body;
    
    // Check if account exists
    const { data: existing } = await supabase.from("owner_payout_accounts").select("id").eq("shop_id", shop.id).maybeSingle();
    
    const accountData = {
        shop_id: shop.id,
        owner_id: user.id,
        destination_type,
        account_holder_name,
        bank_account_number: bank_account_number || null,
        bank_ifsc: bank_ifsc || null,
        upi_id: upi_id || null,
        is_verified: false,
        is_active: true
    };

    if (existing) {
        await supabase.from("owner_payout_accounts").update(accountData).eq("id", existing.id);
    } else {
        await supabase.from("owner_payout_accounts").insert(accountData);
    }
    
    res.json({ success: true });
});

app.post("/api/razorpayx/payout-webhook", async (req, res) => {
    // Verify signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const shasum = crypto.createHmac("sha256", secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest === req.headers["x-razorpay-signature"]) {
        const event = req.body.event;
        const payout = req.body.payload.payout.entity;
        
        if (event === "payout.processed") {
             // Handle success
             const { data: settlement } = await supabase.from("owner_daily_settlements")
                .select("*")
                .eq("razorpay_payout_id", payout.id)
                .single();
            
            if (settlement && settlement.status !== 'paid') {
                await supabase.from("owner_daily_settlements").update({
                    status: 'paid',
                    processed_at: new Date().toISOString(),
                    razorpay_utr: payout.utr
                }).eq("id", settlement.id);

                // Debit wallet
                await supabase.from("owner_wallets").update({
                    pending_balance: supabase.rpc("decrement", { amount: settlement.payout_amount }), // Simplified
                    total_paid_out: supabase.rpc("increment", { amount: settlement.payout_amount })
                }).eq("id", settlement.wallet_id);
            }
        }
        res.json({ status: "ok" });
    } else {
        res.status(400).send("Invalid signature");
    }
});

app.post("/api/jobs/daily-owner-payout", async (req, res) => {
    // This would be triggered by a cron job or scheduled task
    // Placeholder logic as requested
    res.json({ message: "Payout job checked. RazorpayX payout API will be connected next.", status: "eligible" });
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
