/**
 * Company Search Module
 * Handles all company-related search operations
 */

import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { CreditService } from "../features/billing/credits/service";
import { SearchType } from "../features/billing/credits/types";
import { SessionManager } from "./sessions";
import { getUserId } from "../utils/auth";
import rateLimit from "express-rate-limit";
import type { 
  QuickSearchRequest, 
  CompanySearchRequest
} from "./types";


// Create session-based rate limiter for demo searches
const demoSearchLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // Limit each session to 10 searches per hour
  keyGenerator: (req) => {
    // Use session ID as the key for rate limiting
    return (req as any).sessionID || 'no-session';
  },
  skipSuccessfulRequests: false, // Count all requests
  message: "You've enjoyed 10 free searches! Please sign up for unlimited searches.",
  handler: (req, res) => {
    res.status(429).json({
      message: "You've enjoyed 10 free searches! Please sign up for unlimited searches.",
      signupUrl: "/register",
      limitReached: true
    });
  }
});

/**
 * Map frontend search type to backend search type for billing
 */
function mapSearchTypeToCredits(frontendSearchType: string): SearchType {
  switch(frontendSearchType) {
    case 'companies': return 'company_search';         // 10 credits
    case 'contacts': return 'company_and_contacts';    // 70 credits (10 + 60)
    case 'emails': return 'company_contacts_emails';   // 240 credits (10 + 60 + 170)
    default: return 'company_search';                  // fallback to 10 credits
  }
}

/**
 * Register company search routes
 * IMPORTANT: Specific routes MUST come before dynamic routes
 */
export function registerCompanyRoutes(app: Express, requireAuth: any) {
  // List companies (allows unauthenticated access for demo)
  app.get("/api/companies", async (req: Request, res: Response) => {
    // Check if the user is authenticated with their own account
    const isAuthenticated = (req as any).isAuthenticated && (req as any).isAuthenticated() && (req as any).user;
    
    if (isAuthenticated) {
      // Return authenticated user's companies
      const companies = await storage.listCompanies((req as any).user!.id);
      res.json(companies);
    } else {
      // For demo/unauthenticated users, return only the demo companies
      const demoCompanies = await storage.listCompanies(1); // Demo user ID = 1
      res.json(demoCompanies);
    }
  });

  // Quick company search endpoint - creates a job and returns immediately
  app.post("/api/companies/quick-search", (req: Request, res: Response, next) => {
    // Apply rate limiting to demo users (userId = 1) and unauthenticated users
    const userId = (req as any).user?.id;
    const isDemo = userId === 1 || !((req as any).isAuthenticated && (req as any).isAuthenticated());
    
    if (isDemo) {
      return demoSearchLimiter(req, res, () => next());
    }
    next();
  }, async (req: Request, res: Response) => {
    const userId = (req as any).isAuthenticated() && (req as any).user ? (req as any).user.id : 1;
    const { query, strategyId, contactSearchConfig, sessionId, searchType }: QuickSearchRequest = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        message: "Invalid request: query must be a non-empty string"
      });
      return;
    }
    
    try {
      console.log(`[Quick Search] Creating job for query: ${query}`);
      console.log(`[Quick Search] Search type: ${searchType || 'companies'}`);
      
      // Credit blocking check: Prevent searches if user has negative balance
      if ((req as any).isAuthenticated() && (req as any).user) {
        const credits = await CreditService.getUserCredits((req as any).user.id);
        if (credits.currentBalance < 0) {
          return res.status(402).json({
            message: "Account blocked due to insufficient credits",
            currentBalance: credits.currentBalance
          });
        }
      }
      
      // Import SearchJobService
      const { SearchJobService } = await import("./services/search-job-service");
      
      // Create a job instead of processing directly
      const jobId = await SearchJobService.createJob({
        userId,
        query,
        searchType: (searchType || 'companies') as 'companies' | 'contacts' | 'emails',
        contactSearchConfig,
        source: 'frontend',
        metadata: {
          sessionId,
          strategyId,
          isQuickSearch: true
        },
        priority: 1 // Higher priority for quick search
      });
      
      console.log(`[Quick Search] Created job ${jobId} for user ${userId}`);
      
      // Store session if sessionId provided
      if (sessionId) {
        SessionManager.createOrUpdateSession(sessionId, {
          query,
          status: 'pending',
          jobId,
          timestamp: Date.now(),
          ttl: 30 * 60 * 1000 // 30 minutes
        });
        console.log(`[Quick Search] Session ${sessionId} created with job ${jobId}`);
      }
      
      // Return job information for frontend to poll
      res.json({
        jobId,
        sessionId,
        query,
        searchType: searchType || 'companies',
        message: "Search job created and processing"
      });
      
    } catch (error) {
      console.error('Quick search error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });

  // Full company search endpoint with contacts - creates a job
  app.post("/api/companies/search", (req: Request, res: Response, next) => {
    // Apply rate limiting to demo users (userId = 1) and unauthenticated users
    const userId = (req as any).user?.id;
    const isDemo = userId === 1 || !((req as any).isAuthenticated && (req as any).isAuthenticated());
    
    if (isDemo) {
      return demoSearchLimiter(req, res, () => next());
    }
    next();
  }, async (req: Request, res: Response) => {
    const userId = (req as any).isAuthenticated() && (req as any).user ? (req as any).user.id : 1;
    const { query, strategyId, includeContacts = true, contactSearchConfig, sessionId, searchType }: CompanySearchRequest = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        message: "Invalid request: query must be a non-empty string"
      });
      return;
    }
    
    try {
      console.log(`[Full Search] Creating job for query: ${query}`);
      console.log(`[Full Search] Search type: ${searchType || (includeContacts ? 'contacts' : 'companies')}`);
      console.log(`[Full Search] Contact search config:`, contactSearchConfig);
      
      // Credit blocking check: Prevent searches if user has negative balance
      if ((req as any).isAuthenticated() && (req as any).user) {
        const credits = await CreditService.getUserCredits((req as any).user.id);
        if (credits.currentBalance < 0) {
          return res.status(402).json({
            message: "Account blocked due to insufficient credits",
            currentBalance: credits.currentBalance
          });
        }
      }
      
      // Import SearchJobService
      const { SearchJobService } = await import("./services/search-job-service");
      
      // Determine search type from request params
      const jobSearchType = searchType || (includeContacts ? 'contacts' : 'companies');
      
      // Create a job instead of processing directly
      const jobId = await SearchJobService.createJob({
        userId,
        query,
        searchType: jobSearchType as 'companies' | 'contacts' | 'emails',
        contactSearchConfig,
        source: 'frontend',
        metadata: {
          sessionId,
          strategyId,
          isFullSearch: true,
          includeContacts
        },
        priority: 0 // Normal priority for full search
      });
      
      console.log(`[Full Search] Created job ${jobId} for user ${userId}`);
      
      // Store session if sessionId provided
      if (sessionId) {
        SessionManager.createOrUpdateSession(sessionId, {
          query,
          status: 'pending',
          jobId,
          timestamp: Date.now(),
          ttl: 30 * 60 * 1000 // 30 minutes
        });
        console.log(`[Full Search] Session ${sessionId} created with job ${jobId}`);
      }
      
      // Return job information for frontend to poll
      res.json({
        jobId,
        sessionId,
        query,
        searchType: jobSearchType,
        message: "Search job created and processing"
      });
      
    } catch (error) {
      console.error('Full search error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred during company search"
      });
    }
  });

  // Get company by ID (allows unauthenticated access for demo companies)
  app.get("/api/companies/:id", async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      const isAuthenticated = (req as any).isAuthenticated && (req as any).isAuthenticated() && (req as any).user;
      
      console.log('GET /api/companies/:id - Request params:', {
        id: req.params.id,
        isAuthenticated: isAuthenticated
      });
      
      let company = null;
      
      // First try to find the company for the authenticated user
      if (isAuthenticated) {
        company = await storage.getCompany(companyId, (req as any).user!.id);
      }
      
      // If not found or not authenticated, check if it's a demo company
      if (!company) {
        company = await storage.getCompany(companyId, 1); // Check demo user (ID 1)
      }
      
      console.log('GET /api/companies/:id - Retrieved company:', {
        requested: req.params.id,
        found: company ? { id: company.id, name: company.name } : null,
        isDemo: company && (!isAuthenticated || company.userId === 1)
      });

      if (!company) {
        res.status(404).json({ message: "Company not found" });
        return;
      }
      res.json(company);
    } catch (error) {
      console.error('Error fetching company:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });
}