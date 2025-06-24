# Production Gmail OAuth Setup

## Required Google Cloud Console Configuration

### 1. OAuth 2.0 Client IDs Configuration
Go to Google Cloud Console > APIs & Services > Credentials

### 2. Authorized Redirect URIs
Add BOTH of these URIs to your OAuth client:

**Development (Replit):**
```
https://8f42adf3-8f4f-49ae-bc9d-3e88aa3a6761-00-36354h91hba2b.worf.replit.dev/api/gmail/callback
```

**Production (5ducks.ai):**
```
https://5ducks.ai/api/gmail/callback
```

### 3. Authorized JavaScript Origins
Add these domains:
```
https://5ducks.ai
https://8f42adf3-8f4f-49ae-bc9d-3e88aa3a6761-00-36354h91hba2b.worf.replit.dev
```

### 4. Test URLs
- Development: `https://8f42adf3-8f4f-49ae-bc9d-3e88aa3a6761-00-36354h91hba2b.worf.replit.dev/api/version`
- Production: `https://5ducks.ai/api/version`

## Common Issues
- Missing production redirect URI in Google Cloud Console
- Deployment lag (production running old code)
- Environment variables not set in production