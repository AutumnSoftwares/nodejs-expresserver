// server.js
import express from 'express';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors'; // ✅ Import CORS

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ------------------------
// CORS Setup
// ------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL, // Base44 frontend URL
  methods: ['GET', 'POST'],
}));

// Parse JSON bodies
app.use(express.json());

// Parse raw body for webhook verification
app.use('/webhook', bodyParser.raw({ type: 'application/json' }));

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

// ------------------------
// 1️⃣ Create Checkout Session
// ------------------------
app.post('/create-checkout-session', async (req, res) => {
  const { priceId } = req.body;

  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        { price: priceId, quantity: 1 }
      ],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ------------------------
// 2️⃣ Webhook Endpoint
// ------------------------
app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      console.log('✅ Checkout session completed', event.data.object);
      break;
    case 'invoice.payment_succeeded':
      console.log('✅ Payment succeeded', event.data.object);
      break;
    case 'customer.subscription.deleted':
      console.log('❌ Subscription canceled', event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// Start server
app.listen(port, () => {
  console.log(`Stripe server listening on port ${port}`);
});
