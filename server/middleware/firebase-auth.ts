import { Request, Response, NextFunction } from "express";
import admin from "firebase-admin";

// Extend Express Request to include Firebase user
declare global {
  namespace Express {
    interface Request {
      firebaseUser?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

/**
 * Middleware to verify Firebase JWT tokens
 */
export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No valid authorization header found' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Add user info to request object
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name
    };

    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(403).json({ error: 'Token expired' });
        return;
      }
      if (error.message.includes('invalid')) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    }
    
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional middleware - doesn't fail if no token provided
 */
export async function optionalFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.firebaseUser = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name
        };
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth - just continue without user
    console.warn('Optional Firebase auth failed:', error);
    next();
  }
}