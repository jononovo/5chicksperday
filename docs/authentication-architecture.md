# Authentication Architecture Documentation

## Overview

5Ducks implements a sophisticated dual authentication system that separates user identity management from Gmail API permissions. This architecture ensures secure user authentication while providing granular control over email sending capabilities.

## Dual Authentication System

### Level 1: User Identity Authentication (Firebase + Passport.js)

**Purpose**: Establishes user identity and session management

**Components**:
- **Firebase Authentication**: Handles Google OAuth for user login/registration
- **Passport.js**: Manages session-based authentication on the backend
- **Express Session**: Maintains user sessions with database backing

**Flow**:
1. User clicks "Sign in with Google" 
2. Firebase handles Google OAuth popup with basic profile scopes
3. Frontend receives Firebase user credentials
4. Backend syncs Firebase user with local database via `/api/google-auth`
5. Passport.js creates authenticated session
6. User can access protected routes

**Scopes Requested**: Basic profile information (email, name, profile)

### Level 2: Gmail API Authentication (Direct Google OAuth)

**Purpose**: Grants specific Gmail API permissions for email sending

**Components**:
- **Google OAuth2 Client**: Direct OAuth flow bypassing Firebase
- **Database Token Storage**: Persistent Gmail tokens in Replit Database
- **Session Fallback**: Backward compatibility with session-based storage

**Flow**:
1. User clicks Gmail connection button (red Gmail icon)
2. Opens `/api/gmail/auth` in popup window
3. Google OAuth requests Gmail-specific scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
4. OAuth callback stores tokens in database via `updateUserGmailTokens()`
5. Frontend polls Gmail status via `/api/gmail/status`
6. Send button becomes enabled when `connected: true`

## Why Dual Authentication?

### Security Separation
- **User Identity**: Basic profile access for app functionality
- **Gmail Permissions**: Sensitive email access only when explicitly granted

### Scope Granularity
- Firebase: Minimal scopes for user identification
- Gmail OAuth: Specific email API permissions

### Independent Lifecycles
- Users can be authenticated without Gmail access
- Gmail permissions can be revoked independently
- Different refresh token management strategies

## Technical Implementation

### Database Schema
```sql
-- User table with Gmail token storage
users (
  id serial PRIMARY KEY,
  email text NOT NULL,
  gmail_access_token text,     -- Gmail API access token
  gmail_refresh_token text,    -- Gmail API refresh token
  created_at timestamp
)
```

### Authentication Middleware

**Firebase Token Verification**:
```javascript
async function verifyFirebaseToken(req) {
  // Check Authorization header for Firebase JWT
  // Verify with Firebase Admin SDK
  // Return user object or null
}
```

**Session-based Authentication** (Passport.js):
```javascript
function requireAuth(req, res, next) {
  // Check if user is authenticated via session
  // Allow access to protected routes
}
```

### Gmail Token Management

**Storage Strategy**:
- **Primary**: Database storage (production-reliable)
- **Fallback**: Session storage (development compatibility)

**Token Retrieval**:
```javascript
const user = await storage.getUserById(userId);
const gmailToken = user?.gmailAccessToken || req.session?.gmailToken;
```

## API Endpoints

### Authentication Endpoints

| Endpoint | Purpose | Authentication Level |
|----------|---------|---------------------|
| `/api/google-auth` | Sync Firebase user with backend | Firebase JWT |
| `/api/gmail/auth` | Initiate Gmail OAuth | Session-based |
| `/api/gmail/callback` | Handle Gmail OAuth callback | OAuth state |
| `/api/gmail/status` | Check Gmail connection status | Session-based |
| `/api/gmail/disconnect` | Revoke Gmail permissions | Session-based |

### Email Endpoints

| Endpoint | Purpose | Requirements |
|----------|---------|-------------|
| `/api/send-email` | Send email via Gmail API | Gmail token + session |

## Frontend Integration

### Authentication Status Tracking
```javascript
// Firebase authentication status
const { user } = useAuth();

// Gmail connection status  
const { data: gmailStatus } = useQuery({
  queryKey: ["/api/gmail/status"],
  enabled: !!user
});
```

### Send Button Logic
```javascript
// Button disabled until both authentications complete
disabled={!user || !gmailStatus?.connected}
```

### Gmail Connection Flow
```javascript
const handleGmailAuth = () => {
  // Open popup to /api/gmail/auth
  // Poll for completion
  // Refresh Gmail status
};
```

## Production vs Development Differences

### Session Persistence
- **Development**: Single-server, reliable session storage
- **Production**: Load balancer/CDN, requires database storage

### OAuth Redirect URIs
- **Development**: `http://localhost:5000/api/gmail/callback`
- **Production**: `https://5ducks.ai/api/gmail/callback`

### Token Storage Strategy
- **Development**: Session storage works reliably
- **Production**: Database storage required for persistence

## Security Considerations

### Token Security
- Gmail tokens stored securely in database
- No token exposure in frontend
- Automatic token refresh handled server-side

### Scope Minimization
- Firebase: Only profile scopes
- Gmail: Only necessary email API scopes
- No excessive permissions requested

### Session Management
- Express sessions with secure configuration
- Session data stored server-side
- CSRF protection via session validation

## Troubleshooting

### Common Issues

**"Send button disabled"**:
1. Check Firebase authentication: `user` object present
2. Check Gmail status: `/api/gmail/status` returns `connected: true`
3. Verify database has Gmail tokens for user

**"Gmail authorization required"**:
1. User needs to complete Gmail OAuth flow
2. Check OAuth redirect URI configuration
3. Verify Gmail API credentials in environment

**Production session issues**:
1. Database storage implemented for Gmail tokens
2. Session fallback maintained for compatibility
3. Load balancer doesn't affect database persistence

### Debug Endpoints

**Version Check**: `/api/version`
- Returns current authentication architecture version
- Indicates which fixes are deployed

**Gmail Status Debug**: `/api/gmail/status`
- Shows both database and session token status
- Useful for diagnosing storage issues

## Architecture Benefits

### Scalability
- Database storage scales across server instances
- Independent authentication systems
- Granular permission management

### User Experience
- Progressive authentication (basic → Gmail)
- Clear separation of concerns
- Intuitive permission flow

### Maintainability
- Modular authentication components
- Clear separation of responsibilities
- Comprehensive error handling

## Future Considerations

### OAuth 2.0 Improvements
- Implement PKCE for enhanced security
- Add token refresh automation
- Consider OAuth device flow for mobile

### Authentication Extensions
- Support additional email providers
- Implement SSO for enterprise customers
- Add two-factor authentication

### Monitoring
- Authentication event logging
- Token usage analytics
- Permission audit trails