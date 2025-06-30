import express, { Request, Response } from "express";
import Stripe from "stripe";
import { CreditService } from "../lib/credits";
import { STRIPE_CONFIG } from "../lib/credits/types";

// Environment detection logic - temporarily forcing production mode for real payment testing
const isTestMode = false; // Temporarily disabled to test real payments in development

// Lazy initialization to prevent crashes during module loading in production
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      throw new Error(`Missing required Stripe secret key for ${isTestMode ? 'test' : 'production'} mode. Please add STRIPE_SECRET_KEY to your deployment secrets.`);
    }
    
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-03-31.basil",
    });
  }
  
  return stripe;
}

async function requireAuth(req: Request, res: Response, next: express.NextFunction) {
  const { verifyUser } = await import('../auth');
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // Set user on request for compatibility
  (req as any).user = user;
  next();
}

export function registerStripeRoutes(app: express.Express) {
  // Only register Stripe routes if the secret key is available
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  
  if (!hasStripeKey) {
    console.warn('STRIPE_SECRET_KEY not found - Stripe routes will return errors. Add STRIPE_SECRET_KEY to deployment secrets to enable payments.');
    
    // Return error responses for all Stripe endpoints when key is missing
    app.post("/api/stripe/create-checkout-session", (req: Request, res: Response) => {
      res.status(503).json({ 
        message: "Payment service unavailable. STRIPE_SECRET_KEY not configured.",
        requiresConfiguration: true 
      });
    });
    
    app.get("/api/stripe/subscription-status", (req: Request, res: Response) => {
      res.status(503).json({ 
        message: "Payment service unavailable. STRIPE_SECRET_KEY not configured.",
        requiresConfiguration: true 
      });
    });
    
    app.post("/api/stripe/webhook", (req: Request, res: Response) => {
      res.status(503).json({ 
        message: "Webhook service unavailable. STRIPE_SECRET_KEY not configured.",
        requiresConfiguration: true 
      });
    });
    
    return;
  }

  // Create checkout session for subscription
  app.post("/api/stripe/create-checkout-session", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { planId } = req.body;

      if (planId !== 'ugly-duckling') {
        return res.status(400).json({ message: "Invalid plan ID" });
      }

      const user = req.user as any;
      if (!user.email) {
        return res.status(400).json({ message: "User email required" });
      }

      // Get or create Stripe customer
      let customer;
      const credits = await CreditService.getUserCredits(userId);
      
      if (credits.stripeCustomerId) {
        customer = await getStripe().customers.retrieve(credits.stripeCustomerId);
      } else {
        customer = await getStripe().customers.create({
          email: user.email,
          metadata: {
            userId: userId.toString(),
            plan: planId
          }
        });

        // Update user credits with customer ID
        await CreditService.updateStripeCustomerId(userId, customer.id);
      }

      // Use the same price ID for both test and production
      const priceId = STRIPE_CONFIG.UGLY_DUCKLING_PRICE_ID;

      const successUrl = `${req.get('origin')}/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${req.get('origin')}`;

      // Create checkout session
      const session = await getStripe().checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId: userId.toString(),
          planId: planId
        },
        subscription_data: {
          metadata: {
            userId: userId.toString(),
            planId: planId
          }
        }
      });

      console.log(`Created checkout session for user ${userId}, plan ${planId}: ${session.id}`);

      res.json({ 
        checkoutUrl: session.url,
        sessionId: session.id 
      });

    } catch (error: any) {
      console.error('Stripe checkout session creation error:', error);
      res.status(500).json({ 
        message: "Failed to create checkout session",
        error: error.message 
      });
    }
  });

  // Debug endpoint to find customer's subscription data
  app.get("/api/stripe/debug-customer/:customerId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      
      // Get customer details
      const customer = await getStripe().customers.retrieve(customerId);
      
      // Get customer's subscriptions
      const subscriptions = await getStripe().subscriptions.list({
        customer: customerId,
        limit: 10
      });
      
      res.json({
        customer: {
          id: customer.id,
          email: customer.email,
          created: customer.created
        },
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          created: sub.created,
          current_period_end: sub.current_period_end,
          metadata: sub.metadata
        }))
      });
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get subscription status
  app.get("/api/stripe/subscription-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const credits = await CreditService.getUserCredits(userId);

      if (!credits.stripeSubscriptionId) {
        return res.json({ 
          hasSubscription: false,
          status: null,
          currentPlan: null 
        });
      }

      const subscription = await getStripe().subscriptions.retrieve(credits.stripeSubscriptionId);

      res.json({
        hasSubscription: true,
        status: subscription.status,
        currentPlan: credits.currentPlan,
        subscriptionId: subscription.id,
        currentPeriodEnd: subscription.current_period_end * 1000, // Convert to milliseconds
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });

    } catch (error: any) {
      console.error('Stripe subscription status error:', error);
      res.status(500).json({ 
        message: "Failed to get subscription status",
        error: error.message 
      });
    }
  });

  // Stripe webhook endpoint (raw body parsing handled by middleware)
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    
    let event;

    try {
      // Parse and verify the webhook payload
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      console.log(`Webhook received - Secret length: ${webhookSecret?.length || 0}, Has signature: ${!!sig}`);
      
      if (webhookSecret && sig && webhookSecret.length > 50) {
        // Production: Verify webhook signature (only if secret looks valid)
        event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log(`✅ Verified Stripe webhook: ${event.type}`);
      } else {
        // Development or invalid secret: Parse without verification but warn
        const body = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
        event = JSON.parse(body);
        if (webhookSecret && webhookSecret.length <= 50) {
          console.log(`⚠️ Webhook secret appears truncated (${webhookSecret.length} chars) - processing unverified`);
        } else {
          console.log(`⚠️ Unverified Stripe webhook: ${event.type} - Add webhook secret for production`);
        }
      }

    } catch (err: any) {
      console.error('Webhook parsing failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          const subscription = event.data.object;
          const userId = parseInt(subscription.metadata.userId);
          const planId = subscription.metadata.planId;

          if (userId && planId === 'ugly-duckling') {
            console.log(`Processing subscription ${event.type} for user ${userId}`);
            
            await CreditService.updateSubscription(userId, {
              stripeSubscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
              currentPlan: planId,
              subscriptionStartDate: subscription.created * 1000,
              subscriptionEndDate: subscription.current_period_end * 1000
            });

            // Award subscription credits if active
            if (subscription.status === 'active') {
              await CreditService.awardSubscriptionCredits(userId, planId as 'ugly-duckling');
              console.log(`Awarded subscription credits to user ${userId} for plan ${planId}`);
            }
          }
          break;

        case 'customer.subscription.deleted':
          const deletedSub = event.data.object;
          const deletedUserId = parseInt(deletedSub.metadata.userId);

          if (deletedUserId) {
            console.log(`Processing subscription cancellation for user ${deletedUserId}`);
            
            await CreditService.updateSubscription(deletedUserId, {
              subscriptionStatus: 'canceled',
              currentPlan: undefined,
              subscriptionEndDate: Date.now()
            });
          }
          break;

        case 'invoice.payment_failed':
          const failedInvoice = event.data.object;
          if (failedInvoice.subscription) {
            const failedSub = await getStripe().subscriptions.retrieve(failedInvoice.subscription);
            const failedUserId = parseInt(failedSub.metadata.userId);
            
            if (failedUserId) {
              console.log(`Payment failed for user ${failedUserId}`);
              
              await CreditService.updateSubscription(failedUserId, {
                subscriptionStatus: 'past_due'
              });
            }
          }
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });

    } catch (error: any) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}