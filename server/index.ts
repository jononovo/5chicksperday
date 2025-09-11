import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { outreachScheduler } from "./features/daily-outreach";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Configure webhook-specific raw body parsing
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Configure JSON parsing for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for development
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Capture the domain from incoming requests for webhook callbacks
app.use((req, res, next) => {
  const protocol = req.secure || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const host = req.get('host');
  if (host) {
    process.env.CURRENT_DOMAIN = `${protocol}://${host}`;
    console.log(`Current domain captured: ${process.env.CURRENT_DOMAIN}`);
  }
  next();
});

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Add health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

(async () => {
  try {
    // Setup authentication before registering routes
    setupAuth(app);
    
    // Auth bypass for development environment (AI agent testing)
    const BYPASS_AUTH = process.env.REPLIT_DEPLOYMENT !== "1";
    
    if (BYPASS_AUTH) {
      console.log("🔓 AUTH BYPASS ENABLED - Development Mode");
      console.log("All requests will use demo user (ID: 1)");
      
      // Cache demo user to avoid repeated DB lookups
      let cachedDemoUser: any = null;
      
      const getOrCreateDemoUser = async () => {
        if (cachedDemoUser) return cachedDemoUser;
        
        try {
          // Try to get user with ID 1 (existing demo/guest user)
          let demoUser = await storage.getUserById(1);
          
          if (!demoUser) {
            console.log("Demo user (ID: 1) not found, attempting to find by email...");
            // Try to find by email
            demoUser = await storage.getUserByEmail('demo@5ducks.test');
            
            if (!demoUser) {
              console.log("Creating new demo user...");
              // Create demo user if doesn't exist
              demoUser = await storage.createUser({
                email: 'demo@5ducks.test',
                username: 'Demo User',
                password: '' // Empty for Firebase compatibility
              });
              console.log(`Created demo user with ID: ${demoUser.id}`);
              
              if (demoUser.id !== 1) {
                console.warn(`WARNING: Demo user created with ID ${demoUser.id} instead of expected ID 1`);
              }
            }
          }
          
          cachedDemoUser = demoUser;
          console.log(`Using demo user for auth bypass - ID: ${demoUser.id}, Email: ${demoUser.email}`);
          return demoUser;
        } catch (error) {
          console.error("Error getting/creating demo user:", error);
          // Return a minimal user object as fallback
          return {
            id: 1,
            email: 'demo@5ducks.test',
            username: 'Demo User',
            password: ''
          };
        }
      }
      
      // Add bypass middleware after auth setup
      app.use(async (req: any, res, next) => {
        const demoUser = await getOrCreateDemoUser();
        
        // Inject demo user into request
        req.user = demoUser;
        req.firebaseUser = demoUser;
        
        // Override isAuthenticated to always return true
        req.isAuthenticated = () => true;
        
        // Add header for debugging
        res.setHeader('X-Auth-Bypass', '1');
        
        next();
      });
      
      console.log("Auth bypass middleware installed - all routes accessible without authentication");
    }
    
    // Database already initialized through Drizzle
    
    // Storage initialization handled by individual storage implementations
    
    // Initialize daily outreach scheduler
    await outreachScheduler.initialize();

    const server = registerRoutes(app);

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Global error handler - place after Vite setup
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Return a properly formatted error response
      res.status(status).json({ 
        error: message,
        status: status,
        timestamp: new Date().toISOString()
      });
    });

    const PORT = parseInt(process.env.PORT || "5000", 10);
    server.listen(PORT, "0.0.0.0", () => {
      log(`Express server serving on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();