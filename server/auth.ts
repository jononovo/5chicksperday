import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, User as SelectUser } from "@shared/schema";
import admin from "firebase-admin";
import { TokenService } from "./features/billing/tokens/service";
import { UserTokens } from "./features/billing/tokens/types";
import MemoryStore from "memorystore";

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
  // Create persistent session store
  const MemoryStoreSession = MemoryStore(session);
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'temporary-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days TTL
      max: 500 // Maximum number of sessions
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  };

  console.log('Setting up persistent session store:', {
    environment: process.env.NODE_ENV,
    sessionTTL: '7 days',
    cookieSecure: sessionSettings.cookie?.secure,
    timestamp: new Date().toISOString()
  });

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
    // Development domain authentication bypass
    // Allow easy testing on configured development domains
    const host = req.get('host') || '';
    const exemptedDomains = process.env.AUTH_EXEMPT_DOMAINS ? 
      process.env.AUTH_EXEMPT_DOMAINS.split(',').map(d => d.trim()) : [];
    
    const isDevelopmentDomain = exemptedDomains.some(domain => 
      domain.startsWith('*') ? host.endsWith(domain.slice(1)) : host === domain
    );
    
    if (isDevelopmentDomain && !req.isAuthenticated()) {
      // For development environments, automatically use demo user (ID 1)
      req.user = { 
        id: 1, 
        email: 'demo@5ducks.ai',
        username: 'Guest User',
        password: '' // Empty password for Firebase compatibility
      } as any;
      
      // Override isAuthenticated to return true for this request
      req.isAuthenticated = function(this: any) { return true; } as any;
      
      console.log('[DEV MODE] Auth bypassed for development domain:', {
        host,
        path: req.path,
        method: req.method,
        userId: 1,
        timestamp: new Date().toISOString()
      });
      
      return next(); // Skip other auth checks
    }
    
    // Enhanced session debugging
    console.log('Session middleware check:', {
      sessionID: req.sessionID || 'none',
      isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
      hasUser: !!req.user,
      userId: req.user ? (req.user as any).id : 'none',
      path: req.path,
      method: req.method,
      hasAuthHeader: !!req.headers.authorization,
      timestamp: new Date().toISOString()
    });

    if (!req.isAuthenticated()) {
      const firebaseUser = await verifyFirebaseToken(req);
      if (firebaseUser) {
        // Attach the Firebase user to the request for other middleware to access
        (req as any).firebaseUser = firebaseUser;
        
        // Also log the user in to create a session - WAIT for completion
        req.login(firebaseUser, (err) => {
          if (err) {
            console.error('Session creation failed:', {
              error: err.message,
              userId: firebaseUser.id,
              timestamp: new Date().toISOString()
            });
            return next(err);
          }
          
          console.log('Firebase user session created successfully:', {
            id: firebaseUser.id,
            email: firebaseUser.email?.split('@')[0] + '@...',
            sessionID: req.sessionID,
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
      console.log('User already authenticated via session:', {
        userId: (req.user as any)?.id,
        sessionID: req.sessionID,
        timestamp: new Date().toISOString()
      });
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
      const { CreditService } = await import("./features/billing/credits/service");
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
      const { email, username, firebaseUid, selectedPlan, planSource, joinWaitlist } = req.body;

      console.log('Google auth endpoint received request:', { 
        hasEmail: !!email, 
        hasUsername: !!username,
        hasFirebaseUid: !!firebaseUid,
        selectedPlan,
        planSource,
        joinWaitlist
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

      // Handle plan selection from pricing page
      if (selectedPlan && planSource === 'pricing_page') {
        try {
          const { CreditService } = await import("./features/billing/credits/service");
          
          if (selectedPlan === 'ugly-duckling') {
            // User selected The Duckling plan - redirect to Stripe checkout after auth
            console.log(`User ${user.id} selected The Duckling plan from pricing page`);
            // The frontend will handle Stripe checkout redirection
          } else if (selectedPlan === 'duckin-awesome' && joinWaitlist) {
            // User selected Mama Duck plan - add to waitlist
            console.log(`User ${user.id} joined Mama Duck waitlist from pricing page`);
            // TODO: Implement waitlist logic
          }
        } catch (error) {
          console.error('Error handling plan selection:', error);
          // Don't fail authentication if plan handling fails
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
}