// server.js
import express from 'express';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ------------------------
// 1️⃣ CORS MUST come BEFORE JSON parsing
// ------------------------
app.use(cors({
  origin: [
    'https://app-forge-d339e5a8.base44.app', // production
    'https://preview--app-forge-d339e5a8.base44.app' // Base44 preview
  ],
  methods: ['GET','POST'],
  credentials: true
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
// 2️⃣ Create Checkout Session
// ------------------------
app.post('/create-checkout-session', async (req, res) => {
  const { tier } = req.body; // Expect 'starter', 'pro', or 'enterprise'

  // Map tier names to Stripe Price IDs from environment variables
  const priceMap = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
  };

  const priceId = priceMap[tier];
  if (!priceId) return res.status(400).json({ error: 'Invalid tier' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
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
// 3️⃣ Webhook Endpoint
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

app.listen(port, () => {
  console.log(`Stripe server listening on port ${port}`);
});
