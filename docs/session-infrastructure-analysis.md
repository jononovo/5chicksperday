# 5Ducks Authentication & Session Infrastructure Analysis

## Executive Summary

This document provides a comprehensive technical analysis of the 5Ducks authentication system evolution, focusing on the transition from Passport.js + Express sessions to simplified Firebase authentication, and the remaining session infrastructure traces that would facilitate future Express session rollouts.

## Current Authentication Architecture (Post-Simplification)

### System Overview
- **Authentication Method**: Simplified email-based authentication trusting frontend Firebase verification
- **User Identification**: Sequential database IDs (1, 2, 3...) rather than Firebase UIDs
- **Token Storage**: Gmail tokens stored directly in user records in Replit Database
- **Session Management**: No Express sessions (removed June 30, 2025)

### Critical Security Considerations

#### Authentication Vulnerability
The current system has a critical security flaw:
```typescript
// Current simplified auth in server/auth.ts
const authHeader = req.headers.authorization;
if (authHeader && authHeader.startsWith('Bearer ')) {
  const email = authHeader.replace('Bearer ', '');
  // Trusts email without Firebase token verification
  const user = await storage.getUserByEmail(email);
}
```

**Risk**: Any client can impersonate users by setting `Authorization: Bearer user@email.com` header without Firebase token validation.

#### UID Mismatch Issue
- Firebase generates cryptographic UIDs (e.g., `xYz7aB9cD8eF1gH2`)
- Database stores sequential IDs (1, 2, 3...)
- No mapping between Firebase UID and database user ID
- Creates potential for authentication bypass scenarios

## Previous Session Infrastructure (Pre-June 30, 2025)

### Express Session Dependencies
Based on package.json analysis, the system previously included:

```json
"dependencies": {
  "express-session": "^1.18.1",
  "passport": "^0.7.0", 
  "passport-local": "^1.0.0",
  "memorystore": "^1.6.7"
}

"devDependencies": {
  "@types/connect-pg-simple": "^7.0.3",
  "@types/express-session": "^1.18.1", 
  "@types/passport": "^1.0.17",
  "@types/passport-local": "^1.0.38"
}
```

### Session Infrastructure Traces

#### 1. Logout Tracking (server/routes.ts:91-92)
```typescript
// Check for recent logout by looking at the logout timestamp in the session
const recentlyLoggedOut = (req.session as any)?.logoutTime && 
  (Date.now() - (req.session as any).logoutTime < 60000); // Within last minute
```

**Purpose**: Prevents data leakage between user sessions by tracking recent logouts
**Implementation**: Session-based timestamp tracking with 60-second window

#### 2. Gmail Token Session Storage (server/routes.ts:562, 591, 612)
```typescript
// Multiple endpoints still reference session-based Gmail tokens
const gmailToken = (req.session as any)?.gmailToken || null;
```

**Current State**: Dead code - these references fail silently
**Previous Purpose**: Stored Gmail OAuth tokens in Express sessions
**Migration**: Tokens now stored in database via `getUserGmailTokens()`

### Session Store Architecture

#### PostgreSQL Session Store Configuration
The presence of `@types/connect-pg-simple` indicates previous PostgreSQL session storage:

```typescript
// Previous configuration (inferred from dependencies)
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    pool: pgPool, // PostgreSQL connection
    tableName: 'session' // Custom session table
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));
```

#### Memory Store Fallback
The `memorystore` dependency suggests development/fallback configuration:

```typescript
// Development fallback (inferred)
import MemoryStore from 'memorystore';

const memoryStore = MemoryStore(session);

app.use(session({
  store: new memoryStore({
    checkPeriod: 86400000 // Prune expired entries every 24h
  }),
  // ... other config
}));
```

## Current Gmail Token Management

### Database Storage Implementation
Gmail tokens are now stored directly in user records:

```typescript
// storage-switching/simplified-storage-replit.ts
async updateUserGmailTokens(userId: number, accessToken: string, refreshToken?: string, expiryDate?: Date) {
  const updates = {
    gmailAccessToken: accessToken,
    gmailTokenExpiry: expiryDate || new Date(Date.now() + 3600000),
    gmailRefreshToken: refreshToken
  };
  return this.updateUser(userId, updates);
}
```

### Token Retrieval
```typescript
async getUserGmailTokens(userId: number) {
  const user = await this.getUser(userId);
  return {
    accessToken: user.gmailAccessToken,
    refreshToken: user.gmailRefreshToken,
    expiry: user.gmailTokenExpiry ? new Date(user.gmailTokenExpiry) : undefined
  };
}
```

## Search Flow Architecture

### Landing Page → App Flow
1. **Entry Point**: `static/landing.html` (static HTML)
2. **Route Transition**: `/` → `/app` (React SPA takeover)
3. **Main Component**: `client/src/pages/home.tsx`
4. **Search Interface**: `client/src/components/prompt-editor.tsx`

### Search Types & Credit System
```typescript
// Three search modes with different credit costs
type SearchType = 'companies' | 'contacts' | 'emails';

const CREDIT_COSTS = {
  companies: 10,    // Company discovery only (~15 seconds)
  contacts: 70,     // + Contact extraction (~28 seconds)  
  emails: 240       // + Email enrichment (~45 seconds)
};
```

### API Endpoints
- `POST /api/quick-search` - Main search orchestrator
- `POST /api/companies/:id/contacts` - Contact discovery
- `POST /api/contacts/:id/emails/*` - Email enrichment (Apollo, Hunter, AeroLeads, Perplexity)

### Database Architecture
Currently uses Replit Database exclusively:

```typescript
// storage-switching/storage-switcher.ts  
const USE_REPLIT_DB = process.env.USE_REPLIT_DB === 'true';
const storage = USE_REPLIT_DB 
  ? new SimplifiedReplitStorage() 
  : new DatabaseStorage();
```

**Note**: PostgreSQL infrastructure exists but is not active (`USE_REPLIT_DB=true`)

## Recommendations for Express Session Rollout

### 1. Session Store Configuration
```typescript
// Recommended production setup
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

const PgSession = connectPgSimple(session);

export function setupSessions(app: Express) {
  app.use(session({
    store: new PgSession({
      pool: db.pool, // Reuse existing PostgreSQL connection
      tableName: 'user_sessions',
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax'
    }
  }));
}
```

### 2. Session Type Extensions
```typescript
// server/types/session.d.ts
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    gmailToken?: string;
    gmailRefreshToken?: string;
    gmailTokenExpiry?: Date;
    logoutTime?: number;
    lastActivity?: number;
  }
}
```

### 3. Authentication Enhancement
```typescript
// Enhanced auth with Firebase + session hybrid
async function enhancedVerifyUser(req: Request): Promise<SelectUser | null> {
  // 1. Check existing session
  if (req.session.userId) {
    const user = await storage.getUserById(req.session.userId);
    if (user) return user;
  }
  
  // 2. Verify Firebase token
  const firebaseToken = req.headers.authorization?.replace('Bearer ', '');
  if (firebaseToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
      const user = await storage.getUserByEmail(decodedToken.email);
      
      if (user) {
        // Store in session for future requests
        req.session.userId = user.id;
        req.session.lastActivity = Date.now();
        return user;
      }
    } catch (error) {
      console.error('Firebase token verification failed:', error);
    }
  }
  
  return null;
}
```

### 4. Migration Strategy
1. **Phase 1**: Add session middleware without breaking existing auth
2. **Phase 2**: Implement hybrid Firebase + session verification  
3. **Phase 3**: Migrate Gmail tokens from database to sessions
4. **Phase 4**: Remove session traces from current code
5. **Phase 5**: Add proper logout endpoint with session destruction

### 5. Gmail Token Session Migration
```typescript
// Move from database storage to session storage
app.post('/api/google-auth', async (req, res) => {
  // ... OAuth flow ...
  
  // Store in session instead of database
  req.session.gmailToken = tokens.access_token;
  req.session.gmailRefreshToken = tokens.refresh_token;
  req.session.gmailTokenExpiry = new Date(tokens.expiry_date);
  
  // Remove from database
  await storage.clearUserGmailTokens(userId);
});
```

## Security Considerations

### Current Risks
1. **Email spoofing**: Any client can set authorization header
2. **No token validation**: Firebase tokens not verified server-side
3. **UID mismatch**: Database IDs don't match Firebase UIDs
4. **Session fixation**: No session management for logout scenarios

### Session Security Benefits
1. **Server-side validation**: Session tokens validated on each request
2. **Automatic expiration**: Built-in session lifecycle management
3. **Secure token storage**: Gmail tokens in encrypted session store
4. **Logout protection**: Proper session destruction prevents data leakage

## Implementation Timeline

### Immediate (Security Fix)
- Add Firebase token verification to existing auth flow
- Map Firebase UIDs to database user IDs

### Short-term (Session Foundation)
- Add session middleware with PostgreSQL store
- Implement hybrid authentication (Firebase + sessions)
- Create session-based logout endpoint

### Medium-term (Full Migration)  
- Migrate Gmail tokens from database to sessions
- Remove dead session references in routes.ts
- Add comprehensive session management

### Long-term (Enhancement)
- Implement session-based user preferences
- Add session activity tracking
- Optimize session store performance

## Conclusion

The current authentication system prioritizes simplicity over security. The existing Express session dependencies and infrastructure traces provide a clear path for implementing robust session management. The recommendations above outline a staged approach to restore secure authentication while preserving the simplified user experience that was achieved during the June 30, 2025 simplification.

The presence of session infrastructure traces (logout tracking, Gmail token references) and the complete dependency set indicates that the previous implementation was comprehensive and production-ready. Re-implementing sessions following the outlined strategy would restore security without sacrificing the streamlined authentication flow.