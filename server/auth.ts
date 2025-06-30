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

// Firebase token verification middleware
async function verifyFirebaseToken(req: Request): Promise<SelectUser | null> {
  // Try to get token from various sources
  let token: string | null = null;
  
  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
  }
  
  // 2. Check cookies if header not available
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
  }
  
  // 3. Check custom header as fallback
  if (!token && req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'] as string;
  }

  console.log('Verifying Firebase token:', {
    hasAuthHeader: !!authHeader,
    headerFormat: authHeader?.startsWith('Bearer ') ? 'valid' : 'invalid',
    hasToken: !!token,
    tokenSource: authHeader?.startsWith('Bearer ') ? 'header' : 
                 req.cookies?.authToken ? 'cookie' : 
                 req.headers['x-auth-token'] ? 'custom-header' : 'none',
    hasFirebaseAdmin: !!admin.auth,
    timestamp: new Date().toISOString()
  });

  if (!token) {
    console.log('Token verification failed:', { 
      reason: 'no token found', 
      timestamp: new Date().toISOString() 
    });
    return null;
  }

  try {
    console.log('Verifying ID token with Firebase Admin');
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('Token verified successfully:', { 
      email: decodedToken.email?.substring(0, 6) + '...', 
      timestamp: new Date().toISOString() 
    });

    // Get or create user in database
    let user = await storage.getUserByEmail(decodedToken.email!);
    
    if (!user) {
      console.log('Creating new user for email:', decodedToken.email);
      user = await storage.createUser({
        email: decodedToken.email!,
        password: '', // Not used for Firebase auth
        username: decodedToken.name || decodedToken.email!.split('@')[0]
      });
    }

    return user;
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  verifyFirebaseToken(req).then(user => {
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    req.user = user;
    next();
  }).catch(error => {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: "Authentication error" });
  });
}

// Middleware to optionally get user (doesn't require auth)
function optionalAuth(req: Request, res: Response, next: NextFunction) {
  verifyFirebaseToken(req).then(user => {
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
  console.log('Setting up stateless Firebase authentication (no sessions)');
  
  // No session or passport setup needed - pure stateless authentication
  
  // Add auth middleware to Express request type
  app.use((req, res, next) => {
    // Add helper methods to request
    req.requireAuth = () => requireAuth(req, res, next);
    req.optionalAuth = () => optionalAuth(req, res, next);
    next();
  });
}

export { requireAuth, optionalAuth, verifyFirebaseToken };