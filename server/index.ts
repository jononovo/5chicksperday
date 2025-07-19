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

(async () => {
  try {
    // Setup authentication before registering routes
    setupAuth(app);
    
    // Database already initialized through Drizzle
    
    // Initialize default search approaches
    try {
      await storage.initializeDefaultSearchApproaches();
      console.log('Default search approaches initialized successfully');
    } catch (error) {
      console.error('Error initializing default search approaches:', error);
      // Continue with server startup even if this fails
    }

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