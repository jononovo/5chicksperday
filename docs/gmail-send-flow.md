# Gmail Send Button Flow Documentation

## Complete Flow Analysis

This document explains the complete journey from clicking the "Send Email" button to successfully sending an email through Gmail API.

## Overview

The send functionality requires **two separate authentications** that must both be valid:

1. **User Authentication** (Firebase/Passport.js session)
2. **Gmail API Authorization** (Direct Google OAuth with Gmail scopes)

## Step-by-Step Flow

### Pre-requisites Check

Before the send button becomes clickable:

```javascript
// Frontend validation
disabled={sendEmailMutation.isPending || !gmailStatus?.connected}
```

**Requirements**:
- User must be authenticated (`user` object exists)
- Gmail must be connected (`gmailStatus.connected === true`)

### 1. Button Click Event

**Location**: `client/src/pages/outreach.tsx`

```javascript
const handleSendEmail = () => {
  sendEmailMutation.mutate();
};
```

### 2. Send Email Mutation

**Frontend Process**:

```javascript
const sendEmailMutation = useMutation({
  mutationFn: async () => {
    // Step A: Verify Gmail authorization
    const authResponse = await apiRequest("GET", "/api/gmail/status");
    const authStatus = await authResponse.json();
    
    if (!authStatus.connected) {
      throw new Error("Gmail authorization required");
    }
    
    // Step B: Send email request
    const payload = { to: toEmail, subject: emailSubject, content: emailContent };
    const response = await apiRequest("POST", "/api/send-email", payload);
    
    return response.json();
  }
});
```

### 3. Gmail Status Verification

**Endpoint**: `GET /api/gmail/status`

**Backend Process**:
```javascript
app.get('/api/gmail/status', requireAuth, async (req, res) => {
  const userId = getUserId(req); // Get user from session/Firebase
  
  // Check database for Gmail tokens (primary)
  const user = await storage.getUserById(userId);
  const hasToken = !!(user?.gmailAccessToken || req.session?.gmailToken);
  
  res.json({ connected: hasToken });
});
```

**Authentication Chain**:
1. `requireAuth` middleware validates session
2. `getUserId()` extracts user ID from session or Firebase token
3. Database lookup for Gmail access token
4. Session fallback for backward compatibility

### 4. Email Sending Request

**Endpoint**: `POST /api/send-email`

**Backend Process**:
```javascript
app.post("/api/send-email", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  
  // Get Gmail token (database first, session fallback)
  const user = await storage.getUserById(userId);
  const gmailToken = user?.gmailAccessToken || req.session?.gmailToken;
  
  if (!gmailToken) {
    return res.status(401).json({ message: "Gmail authorization required" });
  }
  
  // Create Gmail API client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: gmailToken });
  
  // Send email via Gmail API
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage }
  });
});
```

## Authentication Validation Points

### Point 1: Session Authentication

**Middleware**: `requireAuth`

```javascript
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); // Passport.js session valid
  }
  
  // Check Firebase token as fallback
  const firebaseUser = await verifyFirebaseToken(req);
  if (firebaseUser) {
    req.user = firebaseUser;
    return next();
  }
  
  return res.status(401).json({ error: "Authentication required" });
}
```

### Point 2: Gmail Token Validation

**Database Storage Check**:
```javascript
const user = await storage.getUserById(userId);
const gmailToken = user?.gmailAccessToken;
```

**Session Fallback**:
```javascript
const sessionToken = req.session?.gmailToken;
```

## Token Storage Architecture

### Database Storage (Primary)

**Table**: `users`
**Fields**: 
- `gmail_access_token`: Gmail API access token
- `gmail_refresh_token`: Gmail API refresh token (for future use)

**Advantages**:
- Persists across server restarts
- Works in load-balanced environments
- Reliable in production

### Session Storage (Fallback)

**Session Data**:
```javascript
req.session.gmailToken = accessToken;
req.session.gmailRefreshToken = refreshToken;
```

**Advantages**:
- Immediate availability after OAuth
- Works in development environment
- Backward compatibility

## Gmail OAuth Flow (Prerequisites)

Before sending emails, user must complete Gmail authorization:

### 1. Gmail Connection Button Click

```javascript
const handleGmailAuth = () => {
  const authWindow = window.open(`/api/gmail/auth`, 'gmailAuth', 'width=500,height=600');
  // Poll for completion
};
```

### 2. Gmail OAuth Initiation

**Endpoint**: `GET /api/gmail/auth`

```javascript
app.get('/api/gmail/auth', requireAuth, (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    redirectUri
  );
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  res.redirect(authUrl);
});
```

### 3. OAuth Callback Processing

**Endpoint**: `GET /api/gmail/callback`

```javascript
app.get('/api/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  const userId = parseInt(state);
  
  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  
  // Store in database (primary)
  await storage.updateUserGmailTokens(userId, tokens.access_token, tokens.refresh_token);
  
  // Store in session (fallback)
  req.session.gmailToken = tokens.access_token;
  
  res.redirect('/replies'); // Close popup
});
```

## Error Handling

### Common Error Cases

**1. User Not Authenticated**
```
Status: 401
Message: "Authentication required"
Cause: Session expired or Firebase token invalid
```

**2. Gmail Not Connected**
```
Status: 401  
Message: "Gmail authorization required"
Cause: No Gmail tokens in database or session
```

**3. Gmail Token Expired**
```
Status: 401
Message: "Gmail token expired" 
Solution: Re-authorize Gmail connection
```

### Error Recovery

**Frontend Error Handling**:
```javascript
sendEmailMutation.onError = (error) => {
  if (error.message.includes("Gmail authorization")) {
    // Prompt user to reconnect Gmail
    toast({
      title: "Gmail Authorization Required",
      description: "Please reconnect your Gmail account",
      action: <Button onClick={handleGmailAuth}>Connect Gmail</Button>
    });
  }
};
```

## Security Considerations

### Token Protection
- Gmail tokens never exposed to frontend
- Database storage with proper access controls
- Token refresh handled server-side only

### Scope Limitation
- Only necessary Gmail scopes requested
- Separate from user authentication scopes
- Granular permission model

### Request Validation
- User ownership validation via session
- Email content sanitization
- Rate limiting on send endpoint

## Debugging Tools

### Status Check
```javascript
// Check current authentication state
GET /api/gmail/status

Response:
{
  "connected": true/false,
  "debug": {
    "userId": 123,
    "hasDbToken": true/false,
    "hasSessionToken": true/false,
    "timestamp": "2025-06-24T19:00:00.000Z"
  }
}
```

### Version Check
```javascript
// Check deployed version
GET /api/version

Response:
{
  "version": "2025-06-24-gmail-database-storage",
  "hasDatabaseStorage": true,
  "hasUserIdFix": true
}
```

## Production vs Development

### Development Environment
- Session storage works reliably
- Single server instance
- Immediate token availability

### Production Environment  
- Database storage required
- Load balancer/CDN environment
- Token persistence across instances

## Summary

The send button requires a complex authentication chain:

1. **User Session** (Passport.js/Firebase)
2. **Gmail Authorization** (Direct OAuth)
3. **Token Retrieval** (Database + Session fallback)
4. **Gmail API Call** (Google OAuth2 client)

This dual authentication ensures security while providing granular control over email permissions. The database-backed token storage ensures reliability in production environments while maintaining session fallback for development compatibility.