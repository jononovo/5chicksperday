# Deployment Configuration

## Required Environment Variables

### Core Application
- `DATABASE_URL` - Automatically provided by Replit Database
- `OPENAI_API_KEY` - Required for AI features
- `APOLLO_API_KEY` - Required for contact search

### Stripe Payment Integration (Optional)
The application will run without Stripe keys but payment features will be disabled:

- `STRIPE_SECRET_KEY` - Stripe secret key (starts with `sk_`)
- `VITE_STRIPE_PUBLIC_KEY` - Stripe publishable key (starts with `pk_`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (optional, for webhook verification)

### Firebase Authentication
- Firebase keys are automatically configured for the environment

## Port Configuration

The application automatically binds to:
- Development: Port 5000 on localhost
- Production: PORT environment variable (Cloud Run compatible) on 0.0.0.0

## Deployment Steps

1. **Add Required Secrets**: Go to Replit Secrets tab and add the environment variables listed above
2. **Deploy**: Click the Deploy button in Replit
3. **Verify**: Check deployment logs for any missing configuration warnings

## Troubleshooting

### Production Deployment Failures ("signal: terminated")
If the deployment fails with "signal: terminated" error:

1. **Check Environment Variables**: Ensure all required environment variables are set in Replit Secrets:
   - `OPENAI_API_KEY` (required)
   - `APOLLO_API_KEY` (required)
   - `VITE_FIREBASE_API_KEY` (required)
   - `DATABASE_URL` (auto-provided by Replit)

2. **Check Build Process**: Verify the build completes successfully:
   ```bash
   npm run build
   ```

3. **Check Memory Usage**: The application might be exceeding memory limits. Consider:
   - Reducing bundle size
   - Optimizing dependencies
   - Using production-optimized builds

4. **Check Database Access**: Ensure Replit Database is accessible in production environment

5. **Check Logs**: Look for specific error messages in deployment logs before the "signal: terminated" message

### Payment Features Disabled
If you see "Payment service unavailable" errors, add the Stripe environment variables to your Replit Secrets.

### Connection Refused Errors
Ensure the application is binding to the correct port. The app automatically uses the PORT environment variable in production.

### Webhook Verification Warnings
Add STRIPE_WEBHOOK_SECRET to enable webhook signature verification in production. The app will process webhooks without verification as a fallback.