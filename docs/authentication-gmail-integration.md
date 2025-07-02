# Authentication & Gmail Integration Technical Documentation

## Overview

The 5Ducks platform implements a multi-layered authentication system that integrates Firebase Authentication with persistent Gmail API token storage using Replit's key-value database. This architecture enables secure user authentication, Gmail authorization, and reliable email sending capabilities that persist across server restarts.

## Architecture Components

### 1. Authentication Stack
- **Frontend**: Firebase Auth SDK with Google OAuth
- **Backend**: Firebase Admin SDK for token verification
- **Session Management**: Express sessions with Replit Database storage
- **Token Persistence**: Custom TokenService for Gmail API credentials

### 2. Data Flow Architecture

```
User Login → Firebase Auth → Gmail OAuth → TokenService → Replit DB
     ↓              ↓            ↓            ↓           ↓
  ID Token    Access Token  Gmail Token   Persistent   Email API
```

## Authentication Flow

### Phase 1: User Authentication
1. **Frontend Login**: User clicks "Continue with Google"
2. **Firebase OAuth**: `signInWithPopup()` initiates Google OAuth flow
3. **Token Exchange**: Firebase returns ID token and access token
4. **Backend Sync**: Frontend sends tokens to `/api/google-auth` endpoint
5. **User Creation**: Backend creates/updates user record in database

### Phase 2: Gmail Authorization
1. **Scope Validation**: Firebase OAuth includes Gmail scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send` 
   - `https://www.googleapis.com/auth/gmail.modify`
2. **Token Extraction**: Gmail access token extracted from OAuth credential
3. **Persistent Storage**: TokenService stores Gmail token in Replit DB
4. **Validation**: Backend validates token and confirms Gmail access

## Technical Implementation

### Frontend Authentication (`client/src/lib/firebase.ts`)

```typescript
// Firebase configuration with Gmail scopes
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');

// Sign-in process
const result = await signInWithPopup(auth, provider);
const credential = GoogleAuthProvider.credentialFromResult(result);
const gmailToken = credential?.accessToken;
```

### Backend Token Management (`server/lib/tokens/`)

#### TokenService Class
```typescript
export class TokenService {
  private static readonly TOKEN_KEY_PREFIX = 'user_tokens:';
  
  static async storeGmailToken(userId: number, accessToken: string): Promise<void> {
    const key = `${this.TOKEN_KEY_PREFIX}${userId}`;
    const tokens = await this.getUserTokens(userId) || {};
    tokens.gmailAccessToken = accessToken;
    tokens.gmailTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    await db.set(key, JSON.stringify(tokens));
  }
  
  static async getGmailAccessToken(userId: number): Promise<string | null> {
    const tokens = await this.getUserTokens(userId);
    return tokens?.gmailAccessToken || null;
  }
}
```

### Gmail API Integration (`server/routes.ts`)

#### Send Email Endpoint
```typescript
app.post("/api/send-gmail", requireAuth, async (req, res) => {
  // Get Gmail token from persistent storage
  const userId = (req.user as any).id;
  const gmailToken = await TokenService.getGmailAccessToken(userId);
  
  if (!gmailToken) {
    res.status(401).json({ message: "Gmail authorization required" });
    return;
  }
  
  // Create Gmail API client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: gmailToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Send email
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedEmail }
  });
});
```

## Database Schema

### User Tokens Storage Pattern
```
Key: user_tokens:415
Value: {
  "gmailAccessToken": "ya29.a0ARrdaM9...",
  "gmailTokenExpiry": "2025-07-02T01:26:35.418Z",
  "refreshToken": "1//04xxx...",
  "createdAt": "2025-07-01T23:46:35.335Z"
}
```

### User Records Storage
```
Key: user:415
Value: {
  "id": 415,
  "email": "user@example.com",
  "firebaseUid": "fy9KZJlzTXdkLkOIqoIxPPmfjb82",
  "createdAt": "2025-07-01T23:46:35.335Z"
}
```

## Security Features

### 1. Token Validation
- **Firebase ID Token**: Verified using Firebase Admin SDK
- **Gmail Token**: Validated against Google APIs before storage
- **Expiry Handling**: Tokens include expiration timestamps
- **Scope Verification**: Ensures proper Gmail permissions

### 2. Access Control
- **requireAuth Middleware**: Validates Firebase ID token on protected routes
- **User Isolation**: Tokens stored with user-specific keys
- **Session Security**: Express sessions with secure configuration

### 3. Error Handling
```typescript
// Token validation with fallback
const gmailToken = await TokenService.getGmailAccessToken(userId);
if (!gmailToken) {
  console.log(`No valid Gmail token found for user ${userId}`);
  res.status(401).json({ message: "Gmail authorization required" });
  return;
}
```

## Environment Configuration

### Required Environment Variables
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXX...
VITE_FIREBASE_PROJECT_ID=fire-5-ducks
VITE_FIREBASE_APP_ID=1:XXX:web:XXX

# Google OAuth (if using separate credentials)
GMAIL_CLIENT_ID=xxx.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxx

# Database
DATABASE_URL=<replit-db-url>
```

### Firebase Project Setup
1. **Authentication**: Enable Google provider
2. **OAuth Scopes**: Configure Gmail API scopes
3. **Authorized Domains**: Add Replit domains
4. **Service Account**: Download credentials for Admin SDK

## API Endpoints

### Authentication Endpoints
- `POST /api/google-auth` - Sync Firebase user with backend
- `GET /api/user` - Get current user information
- `GET /api/gmail/auth-status` - Check Gmail authorization status

### Gmail Integration Endpoints
- `POST /api/send-gmail` - Send email via Gmail API
- `GET /api/gmail/auth-status` - Check Gmail token validity

## Troubleshooting

### Common Issues

#### 1. "Gmail authorization required" Error
**Cause**: Gmail token not found in persistent storage
**Solution**: 
- Verify user has completed Google OAuth with Gmail scopes
- Check TokenService storage and retrieval methods
- Validate Firebase OAuth configuration includes Gmail scopes

#### 2. "Invalid To header" Error
**Cause**: Email formatting issues in Gmail API request
**Solution**:
- Verify email address format
- Check MIME message encoding
- Validate email headers structure

#### 3. Token Expiry Issues
**Cause**: Gmail access tokens expire after 1 hour
**Solution**:
- Implement refresh token mechanism
- Add token expiry validation
- Handle re-authorization flow

### Debug Commands

```bash
# Check user tokens in database
curl -X GET "http://localhost:5000/api/gmail/auth-status" \
  -H "Authorization: Bearer <firebase-id-token>"

# Test email sending
curl -X POST "http://localhost:5000/api/send-gmail" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","content":"Hello"}'
```

## Performance Considerations

### 1. Token Caching
- Tokens cached in memory for duration of request
- Database queries minimized through efficient key structure
- Batch operations for multiple token operations

### 2. Connection Pooling
- Reuse Gmail API client instances
- Connection pooling for database operations
- Efficient token validation caching

### 3. Error Recovery
- Graceful degradation when Gmail unavailable
- Retry logic for transient failures
- User feedback for authorization issues

## Migration Notes

### From Session-Based to Persistent Storage
The system was migrated from session-based token storage to persistent TokenService storage:

**Before (Session-based)**:
```typescript
const gmailToken = req.session.gmailToken;
```

**After (Persistent)**:
```typescript
const gmailToken = await TokenService.getGmailAccessToken(userId);
```

This change ensures Gmail functionality works reliably across server restarts and provides better user experience.

## Future Enhancements

### 1. Refresh Token Implementation
- Automatic token refresh before expiry
- Background token renewal service
- Seamless user experience during token refresh

### 2. Multi-Provider Support
- Support for Outlook/Exchange integration
- Generic email provider abstraction
- Provider-specific configuration management

### 3. Enhanced Security
- Token encryption at rest
- Audit logging for token operations
- Rate limiting for authentication endpoints

## Conclusion

The authentication and Gmail integration system provides a robust foundation for secure user authentication and reliable email functionality. The persistent token storage ensures consistent operation across server restarts, while the modular architecture allows for easy extension and maintenance.

The key architectural decision to use TokenService with Replit Database provides the reliability needed for production email operations while maintaining the simplicity required for rapid development and deployment.