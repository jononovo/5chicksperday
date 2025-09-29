/**
 * Company Search Module
 * Handles all company-related search operations
 */

import { Express, Request, Response } from "express";
import { storage } from "../storage";
import { searchCompanies } from "./perplexity/company-search";
import { findKeyDecisionMakers } from "./contacts/finder";
import { CreditService } from "../features/billing/credits/service";
import { SearchType } from "../features/billing/credits/types";
import { SessionManager } from "./sessions";
import { getUserId } from "../utils/auth";
import rateLimit from "express-rate-limit";
import type { 
  QuickSearchRequest, 
  CompanySearchRequest,
  SearchCache 
} from "./types";

// Ensure global searchCache exists
if (!global.searchCache) {
  global.searchCache = new Map<string, SearchCache>();
}

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
 * Process items in batches for rate limiting
 */
async function processBatch<T, R>(items: T[], processor: (item: T) => Promise<R>, batchSize: number = 4): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  return results;
}

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

  // Quick company search endpoint - returns companies immediately without waiting for contacts
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
      console.log(`[Quick Search] Processing query: ${query}`);
      console.log(`[Quick Search] Using strategy ID: ${strategyId || 'default'}`);
      console.log(`[Quick Search] Search type: ${searchType || 'emails'}`);
      
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
      
      // First, get the company search results quickly
      const companyResults = await searchCompanies(query);
      
      if (!companyResults || companyResults.length === 0) {
        return res.json({
          companies: [],
          query
        });
      }
      
      // Prepare companies with minimal processing for quick display
      const companies = await Promise.all(
        companyResults.slice(0, 7).map(async (company) => {
          // Extract company name, website and description (if available)
          const companyName = typeof company === 'string' ? company : company.name;
          const companyWebsite = typeof company === 'string' ? null : (company.website || null);
          const companyDescription = typeof company === 'string' ? null : (company.description || null);
          
          // Create the company record with basic info
          const createdCompany = await storage.createCompany({
            name: companyName,
            website: companyWebsite,
            description: companyDescription,
            userId
          });
          
          return createdCompany;
        })
      );

      // Cache both API results and created company records for full search reuse
      const cacheKey = `search_${Buffer.from(query).toString('base64')}_companies`;
      global.searchCache.set(cacheKey, {
        apiResults: companyResults,
        companyRecords: companies,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000 // 5 minutes
      });
      
      console.log(`[Quick Search] Cached ${companyResults.length} company API results and ${companies.length} database records for reuse`);
      console.log(`[Quick Search] Cache key: ${cacheKey}`);
      
      // Store session if sessionId provided
      if (sessionId) {
        SessionManager.createOrUpdateSession(sessionId, {
          query,
          status: 'companies_found',
          quickResults: companies,
          timestamp: Date.now(),
          ttl: 30 * 60 * 1000 // 30 minutes
        });
        console.log(`[Quick Search] Session ${sessionId} updated with companies`);
      }
      
      // Pre-response billing: Deduct credits based on actual search type selected
      if ((req as any).isAuthenticated() && (req as any).user && companies.length > 0) {
        try {
          const creditSearchType = mapSearchTypeToCredits(searchType || 'companies');
          
          await CreditService.deductCredits(
            (req as any).user.id,
            creditSearchType,
            true
          );
          console.log(`Credits deducted for user ${(req as any).user.id}: ${creditSearchType} (frontend type: ${searchType})`);
        } catch (creditError) {
          console.error('Credit deduction error:', creditError);
          // Don't fail the search if credit deduction fails
        }
      }

      // Return the quick company data
      res.json({
        companies,
        query,
        strategyId: strategyId || null,
        sessionId,
        searchType: searchType || 'emails'
      });
      
    } catch (error) {
      console.error('Quick search error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      });
    }
  });

  // Full company search endpoint with contacts
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
    const { query, strategyId, includeContacts = true, contactSearchConfig, sessionId }: CompanySearchRequest = req.body;

    // Debug: Log contact search configuration at batch level
    console.log(`[BATCH CONFIG] Contact search configuration:`, {
      enableCoreLeadership: contactSearchConfig?.enableCoreLeadership,
      enableDepartmentHeads: contactSearchConfig?.enableDepartmentHeads, 
      enableMiddleManagement: contactSearchConfig?.enableMiddleManagement,
      enableCustomSearch: contactSearchConfig?.enableCustomSearch,
      customSearchTarget: contactSearchConfig?.customSearchTarget,
      query: query
    });

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        message: "Invalid request: query must be a non-empty string"
      });
      return;
    }

    try {
      // Check cache first to avoid duplicate API calls
      const cacheKey = `search_${Buffer.from(query).toString('base64')}_companies`;
      
      let companyResults;
      let cachedCompanies = null;
      const cached = global.searchCache.get(cacheKey);
      
      console.log(`[Full Search] Cache key: ${cacheKey}`);
      console.log(`[Full Search] Cache has ${global.searchCache.size} entries`);
      console.log(`[Full Search] Cache entry exists: ${!!cached}`);
      
      if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
        console.log(`[Full Search] Using cached company data for query: ${query}`);
        companyResults = cached.apiResults;
        cachedCompanies = cached.companyRecords;
      } else {
        if (cached) {
          console.log(`[Full Search] Cache expired - age: ${Date.now() - cached.timestamp}ms, TTL: ${cached.ttl}ms`);
        }
        console.log(`[Full Search] Cache miss - fetching fresh company results for query: ${query}`);
        companyResults = await searchCompanies(query);
      }

      // If we have cached companies, reuse them and enrich with contacts
      if (cachedCompanies) {
        console.log(`[Full Search] Reusing ${cachedCompanies.length} cached company records - enriching with contacts`);
        
        // Enrich existing companies with contacts using parallel batch processing
        const enrichedCompanies = await processBatch(
          cachedCompanies,
          async (existingCompany) => {
            const companyName = existingCompany.name;
            const companyWebsite = existingCompany.website;
            const companyDescription = existingCompany.description;
            
            console.log(`Processing contacts for existing company: ${companyName}`);
            
            // Skip company update - use existing company data
            const updatedCompany = existingCompany;

            // Determine industry from company name and description
            let industry: string | undefined = undefined;
            
            // Simple industry detection using company name and description
            const companyText = `${companyName} ${companyDescription || ''}`.toLowerCase();
            const industryKeywords: Record<string, string> = {
              'software': 'technology',
              'tech': 'technology',
              'development': 'technology',
              'it': 'technology',
              'programming': 'technology',
              'cloud': 'technology',
              'healthcare': 'healthcare',
              'medical': 'healthcare',
              'hospital': 'healthcare',
              'doctor': 'healthcare',
              'finance': 'financial',
              'banking': 'financial',
              'investment': 'financial',
              'construction': 'construction',
              'building': 'construction',
              'real estate': 'construction',
              'legal': 'legal',
              'law': 'legal',
              'attorney': 'legal',
              'retail': 'retail',
              'shop': 'retail',
              'store': 'retail',
              'education': 'education',
              'school': 'education',
              'university': 'education',
              'manufacturing': 'manufacturing',
              'factory': 'manufacturing',
              'production': 'manufacturing',
              'consulting': 'consulting',
              'advisor': 'consulting'
            };
            
            for (const [keyword, industryValue] of Object.entries(industryKeywords)) {
              if (companyText.includes(keyword)) {
                industry = industryValue;
                break;
              }
            }
            
            if (!industry && companyName) {
              const nameLower = companyName.toLowerCase();
              if (nameLower.includes('tech') || nameLower.includes('software')) {
                industry = 'technology';
              } else if (nameLower.includes('health') || nameLower.includes('medical')) {
                industry = 'healthcare';
              } else if (nameLower.includes('financ') || nameLower.includes('bank')) {
                industry = 'financial';
              } else if (nameLower.includes('consult')) {
                industry = 'consulting';
              }
            }
            
            console.log(`Detected industry for ${companyName}: ${industry || 'unknown'}`);
            
            // Debug: Log company-level configuration before enhanced contact finder
            console.log(`[COMPANY CONFIG] ${companyName} - Search config:`, {
              enableCoreLeadership: contactSearchConfig?.enableCoreLeadership,
              enableDepartmentHeads: contactSearchConfig?.enableDepartmentHeads,
              enableMiddleManagement: contactSearchConfig?.enableMiddleManagement,
              enableCustomSearch: contactSearchConfig?.enableCustomSearch,
              customSearchTarget: contactSearchConfig?.customSearchTarget
            });
            
            // Use enhanced contact finder with user configuration
            const contacts = await findKeyDecisionMakers(companyName, {
              industry: industry,
              minimumConfidence: 30,
              maxContacts: 20,
              includeMiddleManagement: true,
              prioritizeLeadership: true,
              useMultipleQueries: true,
              // Use frontend-configured search phases
              enableCoreLeadership: contactSearchConfig?.enableCoreLeadership,
              enableDepartmentHeads: contactSearchConfig?.enableDepartmentHeads,
              enableMiddleManagement: contactSearchConfig?.enableMiddleManagement,
              enableCustomSearch: contactSearchConfig?.enableCustomSearch ?? false,
              customSearchTarget: contactSearchConfig?.customSearchTarget ?? "",
              enableCustomSearch2: contactSearchConfig?.enableCustomSearch2 ?? false,
              customSearchTarget2: contactSearchConfig?.customSearchTarget2 ?? ""
            });
            
            console.log(`Found ${contacts.length} contacts using enhanced contact finder`);

            // Create contact records
            const createdContacts = await Promise.all(
              contacts.map(contact =>
                storage.createContact({
                  companyId: existingCompany.id,
                  name: contact.name!,
                  role: contact.role ?? null,
                  email: contact.email ?? null,
                  probability: contact.probability ?? null,
                  linkedinUrl: null,
                  twitterHandle: null,
                  phoneNumber: null,
                  department: null,
                  location: null,
                  verificationSource: 'Decision-maker Analysis',
                  nameConfidenceScore: contact.nameConfidenceScore ?? null,
                  userFeedbackScore: null,
                  feedbackCount: 0,
                  userId: userId
                })
              )
            );

            return { ...updatedCompany || existingCompany, contacts: createdContacts };
          },
          4 // batch size
        );
        
        // Store complete session results if sessionId provided
        if (sessionId) {
          SessionManager.markContactsComplete(sessionId, enrichedCompanies);
        }
        
        // Return enriched companies using existing records
        res.json({
          companies: enrichedCompanies,
          query,
          strategyId: null,
          strategyName: "Direct Search Flow",
          sessionId
        });
        
        return; // Early return to skip the new company creation logic
      }

      // If no cached companies, create new ones (fallback logic)
      const companies = await Promise.all(
        companyResults.slice(0, 7).map(async (company: any) => {
          // Extract company name, website and description (if available)
          const companyName = typeof company === 'string' ? company : company.name;
          const companyWebsite = typeof company === 'string' ? null : (company.website || null);
          const companyDescription = typeof company === 'string' ? null : (company.description || null);
          
          console.log(`Processing company: ${companyName}, Website: ${companyWebsite || 'Not available'}`);
          
          // Skip broken analysis and use direct contact search
          console.log(`Processing contacts for new company: ${companyName}`);

          // Create the company record with minimal data
          const createdCompany = await storage.createCompany({
            name: companyName,
            website: companyWebsite,
            description: companyDescription,
            userId
          });

          // Use direct contact search without broken strategy dependencies
          const contacts = await findKeyDecisionMakers(companyName, {
            industry: 'unknown',
            minimumConfidence: 30,
            maxContacts: 15,
            includeMiddleManagement: true,
            prioritizeLeadership: true,
            useMultipleQueries: true,
          });
          
          console.log(`Found ${contacts.length} contacts for ${companyName}`);

          // Create contact records
          const createdContacts = await Promise.all(
            contacts.map(contact =>
              storage.createContact({
                companyId: createdCompany.id,
                name: contact.name!,
                role: contact.role ?? null,
                email: contact.email ?? null,
                probability: contact.probability ?? null,
                linkedinUrl: null,
                twitterHandle: null,
                phoneNumber: null,
                department: null,
                location: null,
                verificationSource: 'Contact Search',
                nameConfidenceScore: contact.nameConfidenceScore ?? null,
                userFeedbackScore: null,
                feedbackCount: 0,
                userId
              })
            )
          );

          return { ...createdCompany, contacts: createdContacts };
        })
      );

      // Store complete session results if sessionId provided
      if (sessionId) {
        SessionManager.markContactsComplete(sessionId, companies);
      }

      // Return results immediately to complete the search
      res.json({
        companies: companies,
        query: query,
        strategyId: null,
        strategyName: "Direct Search Flow",
        sessionId
      });

      // Contact discovery complete - return results immediately
      console.log(`Search completed successfully with ${companies.length} companies`);

    } catch (error) {
      console.error('Company search error:', error);
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