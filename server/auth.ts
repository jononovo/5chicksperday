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
  console.log('=== SIMPLIFIED AUTH START ===');
  
  // Check for user data in request body (sent from frontend after Firebase verification)
  const { email, username } = req.body;
  
  console.log('Auth request data:', {
    hasEmail: !!email,
    hasUsername: !!username,
    timestamp: new Date().toISOString()
  });

  if (!email) {
    console.log('No email provided in request');
    return null;
  }

  try {
    // Get or create user in database based on email from verified frontend
    let user = await (storage as any).getUserByEmail(email);
    
    if (!user) {
      console.log('Creating new user for email:', email);
      user = await (storage as any).createUser({
        email: email,
        password: '', // Not used for Firebase auth
        username: username || email.split('@')[0]
      });
      console.log('New user created:', { id: user.id, email: user.email });
    } else {
      console.log('Existing user found:', { id: user.id, email: user.email });
    }

    return user;
  } catch (error) {
    console.error('User verification/creation failed:', error);
    return null;
  }
}

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  verifyUser(req).then(user => {
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