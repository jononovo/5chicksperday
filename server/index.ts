import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { storage } from "../storage-switching/1--storage-switcher";

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

// Add process error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received, shutting down gracefully');
  process.exit(0);
});

(async () => {
  try {
    console.log('Starting server initialization...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Port:', process.env.PORT || '5000');
    
    // Log critical environment variables (without exposing secrets)
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
      APOLLO_API_KEY: process.env.APOLLO_API_KEY ? 'Set' : 'Missing',
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Missing'
    });

    // Setup authentication before registering routes
    console.log('Setting up authentication...');
    setupAuth(app);
    console.log('Authentication setup complete');
    
    // Database already initialized through Drizzle
    console.log('Database initialization...');
    
    // Initialize default search approaches
    try {
      await storage.initializeDefaultSearchApproaches();
      console.log('Default search approaches initialized successfully');
    } catch (error) {
      console.error('Error initializing default search approaches:', error);
      // Continue with server startup even if this fails
    }

    console.log('Registering routes...');
    const server = registerRoutes(app);
    console.log('Routes registered successfully');

    if (app.get("env") === "development") {
      console.log('Setting up Vite for development...');
      await setupVite(app, server);
      console.log('Vite setup complete');
    } else {
      console.log('Setting up static serving for production...');
      serveStatic(app);
      console.log('Static serving setup complete');
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
    console.log(`Starting server on port ${PORT}...`);
    
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Express server serving on port ${PORT}`);
      log(`Express server serving on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
})();