import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, User as SelectUser } from "@shared/schema";
import admin from "firebase-admin";
import { TokenService, UserTokens } from "./lib/tokens";

// Extend the session type to include gmailToken
declare module 'express-session' {
  interface SessionData {
    gmailToken?: string;
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Firebase token verification middleware
async function verifyFirebaseToken(req: Request): Promise<SelectUser | null> {
  // Try to get token from various sources
  let token: string | null = null;
  
  // 1. Check Authorization header (traditional method)
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
    tokenSource: token ? (authHeader ? 'header' : (req.cookies?.authToken ? 'cookie' : 'custom-header')) : 'none',
    hasFirebaseAdmin: !!admin.apps.length,
    timestamp: new Date().toISOString()
  });

  if (!token || !admin.apps.length) {
    console.warn('Token verification failed:', {
      reason: !token ? 'no token found' : 'firebase admin not initialized',
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  try {
    console.log('Verifying ID token with Firebase Admin');
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Log the token scopes and claims
    console.log('Token verified successfully:', {
      email: decodedToken.email?.split('@')[0] + '@...',
      timestamp: new Date().toISOString()
    });

    if (!decodedToken.email) {
      console.warn('Token missing email claim');
      return null;
    }

    // Get or create user in our database
    let user = await storage.getUserByEmail(decodedToken.email);

    if (!user) {
      console.log('Creating new user in backend:', {
        email: decodedToken.email?.split('@')[0] + '@...',
        timestamp: new Date().toISOString()
      });

      user = await storage.createUser({
        email: decodedToken.email,
        username: decodedToken.name || decodedToken.email.split('@')[0],
        password: '',  // Not used for Firebase auth
      });
    }

    return user;
  } catch (error) {
    console.error('Firebase token verification error:', {
      error,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

// Add requireAuth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'temporary-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Update local strategy to use email
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email', // Change this to use email field
        passwordField: 'password'
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Initialize Firebase Admin
  if (process.env.VITE_FIREBASE_PROJECT_ID) {
    try {
      if (!admin.apps.length) {
        console.log('Initializing Firebase Admin with config:', {
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });

        admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        });
        console.log('Firebase Admin initialized successfully');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', {
        error,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    }
  } else {
    console.warn('Firebase Admin not initialized: missing project ID', {
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  }


  // Add Firebase token verification to all authenticated routes
  app.use(async (req, res, next) => {
    if (!req.isAuthenticated()) {
      const firebaseUser = await verifyFirebaseToken(req);
      if (firebaseUser) {
        // Attach the Firebase user to the request for other middleware to access
        (req as any).firebaseUser = firebaseUser;
        
        // Also log the user in to create a session - WAIT for completion
        req.login(firebaseUser, (err) => {
          if (err) return next(err);
          console.log('Firebase user logged in:', {
            id: firebaseUser.id,
            email: firebaseUser.email?.split('@')[0] + '@...',
            timestamp: new Date().toISOString()
          });
          next(); // Only call next() after login completes
        });
        // Remove the return here - wait for req.login to complete
      } else {
        // No Firebase user found, continue without authentication
        next();
      }
    } else {
      // Already authenticated via session
      next();
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password } = req.body;

      console.log('Registration request received:', {
        hasEmail: !!email,
        hasPassword: !!password,
        timestamp: new Date().toISOString()
      });

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Check for existing email
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      try {
        const user = await storage.createUser({
          email,
          password: hashedPassword,
        });

        console.log('User created successfully:', {
          id: user.id,
          email: email.split('@')[0] + '@...',
          timestamp: new Date().toISOString()
        });

        // Login the user
        req.login(user, (err) => {
          if (err) {
            console.error('Login error after registration:', err);
            return next(err);
          }
          
          // Return success response with user data
          console.log('User logged in after registration');
          return res.status(201).json(user);
        });
      } catch (createError) {
        console.error('User creation error:', createError);
        return res.status(500).json({ error: "Failed to create user account" });
      }
    } catch (err) {
      console.error('Registration error:', err);
      // Send proper JSON response instead of passing to generic error handler
      return res.status(500).json({ error: "Registration failed", details: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (err: Error | null) => {
        if (err) return next(err);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    // Store the logout time in the session before logout
    // This will help us prevent showing previous user data to a new user
    if (req.session) {
      (req.session as any).logoutTime = Date.now();
      console.log('Set logout timestamp:', { time: new Date().toISOString() });
    }
    
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  app.get("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.put("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const { username } = req.body;
      const userId = (req.user as any).id;
      
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: "Username is required" });
      }
      
      if (username.length < 1) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      if (username.length > 50) {
        return res.status(400).json({ error: "Name must be less than 50 characters" });
      }
      
      const updatedUser = await storage.updateUser(userId, { username });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        createdAt: updatedUser.createdAt
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ error: "Failed to update user profile" });
    }
  });

  app.get("/api/user/subscription-status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const userId = (req.user as any).id;
      const { CreditService } = await import("./lib/credits");
      const credits = await CreditService.getUserCredits(userId);
      
      const planMap = {
        'ugly-duckling': 'The Duckling',
        'duckin-awesome': 'Mama Duck'
      };
      
      const currentPlan = credits.currentPlan || null;
      const isSubscribed = credits.subscriptionStatus === 'active';
      
      res.json({
        isSubscribed,
        currentPlan,
        planDisplayName: currentPlan ? planMap[currentPlan as keyof typeof planMap] : null
      });
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  // Add to the Google auth route
  app.post("/api/google-auth", async (req, res, next) => {
    try {
      const { email, username, firebaseUid } = req.body;

      console.log('Google auth endpoint received request:', { 
        hasEmail: !!email, 
        hasUsername: !!username,
        hasFirebaseUid: !!firebaseUid
      });

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Try to find user by email
      let user = await storage.getUserByEmail(email);

      if (!user) {
        // Create new user if doesn't exist
        try {
          user = await storage.createUser({
            email,
            username: username || email.split('@')[0],
            password: '',  // Not used for Google auth
          });
          console.log('Created new user:', { id: user.id, email: email.split('@')[0] + '@...' });
        } catch (createError) {
          console.error('Failed to create user:', createError);
          return res.status(500).json({ error: "Failed to create user account" });
        }
      }

      // Optional: Store Firebase UID mapping for fast lookup
      if (firebaseUid) {
        try {
          await TokenService.storeFirebaseUidMapping(firebaseUid, user.id);
        } catch (tokenError) {
          console.error('Failed to store Firebase UID mapping:', tokenError);
          // Don't fail the authentication if mapping storage fails
        }
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.json(user);
      });
    } catch (err) {
      console.error('Google auth endpoint error:', err);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Add new route to check Gmail authorization status
  app.get("/api/gmail/auth-status", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const hasValidAuth = await TokenService.hasValidGmailAuth(userId);
      
      console.log('Checking Gmail auth status:', {
        userId,
        hasValidAuth,
        timestamp: new Date().toISOString()
      });
      
      res.json({ 
        authorized: hasValidAuth,
        hasValidToken: hasValidAuth
      });
    } catch (error) {
      console.error('Error checking Gmail auth status:', error);
      res.json({ 
        authorized: false,
        hasValidToken: false
      });
    }
  });

  // Add route to revoke Gmail access (delete tokens)
  app.delete("/api/gmail/tokens", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      await TokenService.deleteUserTokens(userId);
      
      console.log('Revoked Gmail tokens:', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true, message: "Gmail access revoked" });
    } catch (error) {
      console.error('Error revoking Gmail tokens:', error);
      res.status(500).json({ error: "Failed to revoke Gmail access" });
    }
  });

  // Add route to get Gmail user info
  app.get("/api/gmail/user", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userInfo = await TokenService.getGmailUserInfo(userId);
      
      console.log('Retrieved Gmail user info:', {
        userId,
        hasEmail: !!userInfo.email,
        hasName: !!userInfo.name,
        timestamp: new Date().toISOString()
      });
      
      res.json(userInfo);
    } catch (error) {
      console.error('Error retrieving Gmail user info:', error);
      res.status(500).json({ error: "Failed to retrieve Gmail user info" });
    }
  });

  // Add route to trigger Gmail re-authorization
  app.post("/api/gmail/reauthorize", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      console.log('Gmail re-authorization requested:', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Delete existing tokens to force fresh authorization
      await TokenService.deleteUserTokens(userId);
      
      res.json({ 
        success: true, 
        message: "Please complete Google OAuth flow again to re-authorize Gmail access",
        requiresOAuth: true
      });
    } catch (error) {
      console.error('Error preparing Gmail re-authorization:', error);
      res.status(500).json({ error: "Failed to prepare re-authorization" });
    }
  });
}