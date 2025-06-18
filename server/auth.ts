import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage-simple";
import { User } from "./storage-simple";
import admin from "firebase-admin";

// Extend the session type to include gmailToken and userId
declare module 'express-session' {
  interface SessionData {
    gmailToken?: string;
    userId?: number;
  }
}

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      password: string;
      email: string;
      createdAt: string;
    }
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
async function verifyFirebaseToken(req: Request): Promise<User | null> {
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

      // Check if this is a session upgrade
      const sessionUserId = req.session?.userId;
      if (sessionUserId) {
        // Upgrade session user to registered user
        console.log(`Upgrading session user ${sessionUserId} to registered user`);
        user = await storage.createUserWithId(sessionUserId, {
          email: decodedToken.email,
          username: decodedToken.name || decodedToken.email.split('@')[0],
          password: '',  // Not used for Firebase auth
          firebaseUid: decodedToken.uid
        });
        
        // Initialize with trial credits if they don't have any
        const currentCredits = await storage.getUserCredits(sessionUserId);
        if (currentCredits === 0) {
          await storage.createUserCredits(sessionUserId, 100);
        }
      } else {
        // Create new user normally
        user = await storage.createUser({
          email: decodedToken.email,
          username: decodedToken.name || decodedToken.email.split('@')[0],
          password: '',  // Not used for Firebase auth
        });
      }
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

// Simplified session-only authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  console.log('Auth check:', {
    url: req.url,
    hasSession: !!req.session,
    hasUser: !!req.user,
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    cookies: Object.keys(req.cookies || {}),
    headers: {
      cookie: req.headers.cookie ? 'present' : 'missing',
      userAgent: req.headers['user-agent']?.substring(0, 50)
    }
  });
  
  if (!req.isAuthenticated()) {
    console.log('Authentication failed:', {
      hasSession: !!req.session,
      hasUser: !!req.user,
      sessionID: req.sessionID,
      url: req.url,
      method: req.method
    });
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'temporary-secret-key',
    resave: true, // Force session save to fix Replit persistence
    saveUninitialized: true, // Create session immediately
    rolling: true, // Refresh session on each request
    cookie: {
      secure: false, // Disabled for Replit development environment
      httpOnly: true,
      sameSite: 'lax', // Important for Replit cross-origin requests
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/' // Explicit path for all routes
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
    console.log('Serializing user:', { id: user.id, email: user.email, hasId: !!user.id });
    if (!user.id) {
      console.error('User serialization failed: user.id is null/undefined', user);
      return done(new Error('User ID is required for serialization'));
    }
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


  // Firebase login endpoint - converts Firebase token to backend session
  app.post("/api/auth/firebase-login", async (req, res) => {
    try {
      const firebaseUser = await verifyFirebaseToken(req);
      if (!firebaseUser) {
        return res.status(401).json({ error: "Invalid Firebase token" });
      }

      // Log user in to create session
      req.login(firebaseUser, (err) => {
        if (err) {
          console.error('Session creation failed:', err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        
        console.log('Firebase user logged in:', {
          id: firebaseUser.id,
          email: firebaseUser.email?.split('@')[0] + '@...',
          timestamp: new Date().toISOString()
        });
        
        res.json(firebaseUser);
      });
    } catch (error) {
      console.error('Firebase login endpoint error:', error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Guest user creation endpoint
  app.post("/api/guest-user", async (req, res) => {
    try {
      const { createGuest } = req.body;
      
      if (!createGuest) {
        return res.status(400).json({ error: "Invalid request" });
      }

      // Create guest user (user with no email/password)
      const guestUser = await storage.createUser({
        email: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@guest.local`,
        password: '', // Empty password for guest
        username: `guest_user_${Date.now()}`
      });

      console.log('Guest user created:', {
        id: guestUser.id,
        isGuest: true,
        timestamp: new Date().toISOString()
      });

      return res.json({
        id: guestUser.id,
        isGuest: true,
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Guest user creation error:', error);
      return res.status(500).json({ error: "Failed to create guest user" });
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, guestUserId } = req.body;

      console.log('Registration request received:', {
        hasEmail: !!email,
        hasPassword: !!password,
        hasGuestId: !!guestUserId,
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

      let user;

      // If guestUserId provided, update existing guest user
      if (guestUserId) {
        try {
          const existingGuestUser = await storage.getUserById(guestUserId);
          if (existingGuestUser && existingGuestUser.email.includes('@guest.local')) {
            // Update guest user with real credentials
            user = await storage.updateUserCredentials(guestUserId, {
              email,
              password: hashedPassword,
              username: email.split('@')[0]
            });
            
            console.log('Guest user upgraded to registered user:', {
              id: user.id,
              email: email.split('@')[0] + '@...',
              wasGuest: true,
              timestamp: new Date().toISOString()
            });
          } else {
            throw new Error('Invalid guest user ID');
          }
        } catch (guestError) {
          console.warn('Guest user upgrade failed, creating new user:', guestError);
          // Fallback to creating new user
          user = await storage.createUser({
            email,
            password: hashedPassword,
          });
        }
      } else {
        // Create new user (no guest upgrade)
        user = await storage.createUser({
          email,
          password: hashedPassword,
        });
      }

      console.log('User registration completed:', {
        id: user.id,
        email: email.split('@')[0] + '@...',
        method: guestUserId ? 'guest_upgrade' : 'new_user',
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

    } catch (err) {
      console.error('Registration error:', err);
      return res.status(500).json({ error: "Registration failed", details: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: User | false, info: { message: string } | undefined) => {
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

  // Add to the Google auth route
  app.post("/api/google-auth", async (req, res, next) => {
    try {
      const { email, username, accessToken } = req.body;

      console.log('Google auth endpoint received request:', { 
        hasEmail: !!email, 
        hasUsername: !!username,
        hasAccessToken: !!accessToken 
      });

      // Store Gmail token in session if provided
      if (accessToken) {
        req.session.gmailToken = accessToken;
        console.log('Stored Gmail token in session:', {
          hasToken: !!accessToken,
          sessionID: req.sessionID,
          timestamp: new Date().toISOString()
        });
      }

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
  app.get("/api/gmail/auth-status", requireAuth, (req, res) => {
    const hasGmailToken = !!req.session.gmailToken;
    console.log('Checking Gmail auth status:', {
      hasToken: hasGmailToken,
      sessionID: req.sessionID,
      timestamp: new Date().toISOString()
    });
    res.json({ authorized: hasGmailToken });
  });
}