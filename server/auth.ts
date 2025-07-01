import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage-switching/storage-switcher";
import { User as SelectUser } from "@shared/schema";
import admin from "firebase-admin";

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user?: SelectUser;
      requireAuth?: () => void;
      optionalAuth?: () => void;
    }
  }
}

// Simplified authentication - trust frontend Firebase verification
async function verifyUser(req: Request): Promise<SelectUser | null> {
  const timestamp = new Date().toISOString();
  console.log('=== SIMPLIFIED AUTH START ===', { timestamp, path: req.path, method: req.method });
  
  // First check if user is already authenticated and stored in request
  if ((req as any).user) {
    console.log('✓ User found from previous authentication:', { 
      id: (req as any).user.id, 
      email: (req as any).user.email?.substring(0, 10) + '...', 
      timestamp 
    });
    return (req as any).user;
  }
  
  // Check for authorization header (email-based or Firebase token)
  const authHeader = req.headers.authorization;
  console.log('Auth header check:', { 
    hasAuthHeader: !!authHeader, 
    startsWithBearer: authHeader?.startsWith('Bearer '),
    headerLength: authHeader?.length || 0,
    timestamp 
  });
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    
    // Check if it looks like an email (simple validation)
    const isEmail = token.includes('@') && token.includes('.') && token.length < 100;
    
    console.log('🔍 Token analysis:', { 
      tokenStart: token?.substring(0, 10) + '...', 
      fullLength: token?.length || 0,
      looksLikeEmail: isEmail,
      timestamp 
    });
    
    if (isEmail) {
      // Handle email-based authentication (normal API calls)
      console.log('📧 Processing email-based authentication');
      try {
        const user = await (storage as any).getUserByEmail(token);
        
        if (user) {
          console.log('✅ User authenticated via email header:', { 
            id: user.id, 
            email: user.email?.substring(0, 10) + '...',
            hasGmailToken: !!user.gmailAccessToken,
            timestamp 
          });
          (req as any).user = user;
          return user;
        } else {
          console.log('❌ No user found for email:', { 
            email: token?.substring(0, 10) + '...',
            timestamp 
          });
          // For GET/PUT/DELETE requests, if email header auth fails, don't continue
          if (req.method !== 'POST') {
            console.log('❌ Header authentication failed for non-POST request - aborting', { timestamp });
            return null;
          }
        }
      } catch (error) {
        console.error('💥 Email header authentication failed:', { 
          error: error instanceof Error ? error.message : String(error), 
          email: token?.substring(0, 10) + '...',
          timestamp 
        });
      }
    } else {
      // Assume it's a Firebase ID token (for initial sync)
      console.log('🔥 Processing Firebase token authentication');
      try {
        // For now, we'll skip Firebase token verification and rely on email in body
        // This handles the initial sync case where Firebase token is sent
        console.log('🔄 Firebase token detected, checking request body for email...');
      } catch (error) {
        console.error('💥 Firebase token processing failed:', { 
          error: error instanceof Error ? error.message : String(error),
          timestamp 
        });
      }
    }
  } else {
    console.log('❌ Invalid or missing authorization header');
  }
  
  // Check for user data in request body (sent from frontend after Firebase verification)
  const { email, username } = req.body || {};
  
  console.log('🔍 Auth request body check:', {
    hasEmail: !!email,
    hasUsername: !!username,
    hasAuthHeader: !!authHeader,
    bodyEmail: email?.substring(0, 10) + '...' || 'none',
    requestMethod: req.method,
    timestamp
  });

  // Only require email in body for POST requests (user creation/sync)
  // For GET requests, we should have already authenticated via header
  if (!email && req.method === 'POST') {
    console.log('❌ AUTHENTICATION FAILED: No email provided for POST request', { timestamp });
    return null;
  } else if (!email && req.method !== 'POST') {
    console.log('❌ AUTHENTICATION FAILED: No valid authorization header for GET request', { timestamp });
    return null;
  }

  try {
    // Get or create user in database based on email from verified frontend
    let user = await (storage as any).getUserByEmail(email);
    
    // Check if user exists (handle Replit DB error format)
    const userExists = user && typeof user === 'object' && !('ok' in user);
    
    if (!userExists) {
      console.log('Creating new user for email:', email);
      user = await (storage as any).createUser({
        email: email,
        password: '', // Not used for Firebase auth
        username: username || email.split('@')[0]
      });
      console.log('New user created with ID:', user.id);
    } else {
      console.log('Existing user found with ID:', user.id);
    }
    return user;
  } catch (error) {
    console.error('User verification/creation failed:', error);
    return null;
  }
}

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const timestamp = new Date().toISOString();
  console.log('🛡️ RequireAuth middleware triggered:', { 
    path: req.path, 
    method: req.method,
    hasAuthHeader: !!req.headers.authorization,
    timestamp 
  });
  
  verifyUser(req).then(user => {
    if (!user) {
      console.log('❌ AUTHENTICATION REQUIRED: No user found for protected route:', { 
        path: req.path, 
        method: req.method,
        hasAuthHeader: !!req.headers.authorization,
        headerValue: req.headers.authorization?.substring(0, 20) + '...' || 'none',
        timestamp 
      });
      return res.status(401).json({ 
        error: "Not authenticated",
        path: req.path,
        timestamp 
      });
    }
    
    console.log('✅ Authentication successful for protected route:', { 
      path: req.path, 
      userId: user.id,
      email: user.email?.substring(0, 10) + '...',
      timestamp 
    });
    req.user = user;
    next();
  }).catch(error => {
    console.error('💥 Auth middleware error:', { 
      error: error.message, 
      path: req.path,
      stack: error.stack?.substring(0, 200) + '...',
      timestamp 
    });
    res.status(500).json({ 
      error: "Authentication error",
      path: req.path,
      timestamp 
    });
  });
}

// Middleware to optionally get user (doesn't require auth)
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  verifyUser(req).then(user => {
    if (user) {
      req.user = user;
    }
    next();
  }).catch(error => {
    console.error('Optional auth middleware error:', error);
    next(); // Continue without user
  });
}

export function setupAuth(app: Express) {
  console.log('Setting up simplified authentication (no Firebase Admin required)');
  
  // No session, passport, or Firebase Admin setup needed - trust frontend verification
  
  // Add auth middleware to Express request type
  app.use((req, res, next) => {
    // Add helper methods to request
    req.requireAuth = () => requireAuth(req, res, next);
    req.optionalAuth = () => optionalAuth(req, res, next);
    next();
  });
}

export { requireAuth, optionalAuth, verifyUser };