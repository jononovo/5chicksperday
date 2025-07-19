
import { analyzeCompany, searchCompanies } from "server/lib/search-logic";
import { storage } from "../db/storage-replit";
import { requireAuth } from "./middle/requireAuth";
import { Express } from "express";
import CreditService from "server/lib/credits";
import { SearchCache, SearchSessionResult } from "@shared/util.types";
import { SearchType } from "server/lib/credits/types";
import { findKeyDecisionMakers } from "server/lib/search-logic/contact-discovery/enhanced-contact-finder";
import { getUserId } from "./middle/getUserId";
import { Contact } from "@shared/schema";
import { postSearchEnrichmentService } from "server/lib/search-logic/post-search-enrichment/service";
import { searchContactDetails } from "server/lib/api-interactions";


declare global {
  var searchCache: Map<string, SearchCache>;
}

export function setupRouteCompanies(app: Express) {
  
  app.get("/api/companies", requireAuth, async (req, res) => {
    // Check if the user is authenticated with their own account
    const isAuthenticated =
      req.isAuthenticated && req.isAuthenticated() && req.user;

    if (isAuthenticated) {
      // Return authenticated user's companies
      const companies = await storage.listCompanies(req.user!.id);
      res.json(companies);
    } else {
      // For demo/unauthenticated users, return only the demo companies
      const demoCompanies = await storage.listCompanies(1); // Demo user ID = 1
      res.json(demoCompanies);
    }
  });
  
  app.get("/api/companies/:id", requireAuth, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const isAuthenticated =
        req.isAuthenticated && req.isAuthenticated() && req.user;

      console.log("GET /api/companies/:id - Request params:", {
        id: req.params.id,
        isAuthenticated: isAuthenticated,
      });

      let company = null;

      // First try to find the company for the authenticated user
      if (isAuthenticated) {
        company = await storage.getCompany(companyId);
      }

      // If not found or not authenticated, check if it's a demo company
      if (!company) {
        company = await storage.getCompany(companyId); // Check demo user (ID 1)
      }

      console.log("GET /api/companies/:id - Retrieved company:", {
        requested: req.params.id,
        found: company ? { id: company.id, name: company.name } : null,
        isDemo: company && (!isAuthenticated || company.userId === 1),
      });

      if (!company) {
        res.status(404).json({ message: "Company not found" });
        return;
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  });
  
  app.post("/api/companies/quick-search", async (req, res) => {
    // For compatibility with the existing search functionality
    // This temporary fix uses a default user ID if authentication fails
    const userId = req.isAuthenticated() && req.user ? (req.user as any).id : 1;

    const { query, strategyId, contactSearchConfig, sessionId, searchType } =
      req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({
        message: "Invalid request: query must be a non-empty string",
      });
      return;
    }

    try {
      console.log(`[Quick Search] Processing query: ${query}`);
      console.log(
        `[Quick Search] Using strategy ID: ${strategyId || "default"}`,
      );
      console.log(`[Quick Search] Search type: ${searchType || "emails"}`);

      // Credit blocking check: Prevent searches if user has negative balance
      if (req.isAuthenticated() && req.user) {
        const credits = await CreditService.getUserCredits(
          (req.user as any).id,
        );
        if (credits.currentBalance < 0) {
          return res.status(402).json({
            message: "Account blocked due to insufficient credits",
            currentBalance: credits.currentBalance,
          });
        }
      }

      // First, get the company search results quickly
      const companyResults = await searchCompanies(query);

      if (!companyResults || companyResults.length === 0) {
        return res.json({
          companies: [],
          query,
        });
      }

      // Prepare companies with minimal processing for quick display
      const companies = [];

      for (const company of companyResults) {
        let companyName = "";
        let companyWebsite = '';
        let companyDescription = '';
        if (typeof company === "string") {
          companyName = company; // Direct string company name
        } else if (typeof company === "object") {
          companyName = company.name;
          companyWebsite =  company.website || '';
          companyDescription =  company.description || '';
        }

        // Create the company record with basic info
        const createdCompany = await storage.createCompany({
          name: companyName,
          website: companyWebsite,
          description: companyDescription,
          userId
        });

        companies.push(createdCompany);
      }

      // Cache both API results and created company records for full search reuse
      const cacheKey = `search_${Buffer.from(query).toString("base64")}_companies`;
      global.searchCache = global?.searchCache || new Map();
      global.searchCache.set(cacheKey, {
        apiResults: companyResults,
        companyRecords: companies,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000, // 5 minutes
      });

      console.log(
        `[Quick Search] Cached ${companyResults.length} company API results and ${companies.length} database records for reuse`,
      );
      console.log(`[Quick Search] Cache key: ${cacheKey}`);

      // Store session if sessionId provided
      if (sessionId) {
        const session: SearchSessionResult = {
          sessionId,
          query,
          status: "companies_found",
          quickResults: companies,
          timestamp: Date.now(),
          ttl: 30 * 60 * 1000, // 30 minutes
        };
        global.searchSessions.set(sessionId, session);
        console.log(
          `[Quick Search] Session ${sessionId} updated with companies`,
        );
      }

      // Pre-response billing: Deduct credits based on actual search type selected
      if (req.isAuthenticated() && req.user && companies.length > 0) {
        try {
          // Map frontend search type to backend search type for billing
          function mapSearchTypeToCredits(
            frontendSearchType: string,
          ): SearchType {
            switch (frontendSearchType) {
              case "companies":
                return "company_search"; // 10 credits
              case "contacts":
                return "company_and_contacts"; // 70 credits (10 + 60)
              case "emails":
                return "company_contacts_emails"; // 240 credits (10 + 60 + 170)
              default:
                return "company_search"; // fallback to 10 credits
            }
          }

          const creditSearchType = mapSearchTypeToCredits(
            searchType || "companies",
          );

          await CreditService.deductCredits(
            (req.user as any).id,
            creditSearchType,
            true,
          );
          console.log(
            `Credits deducted for user ${(req.user as any).id}: ${creditSearchType} (frontend type: ${searchType})`,
          );
        } catch (creditError) {
          console.error("Credit deduction error:", creditError);
          // Don't fail the search if credit deduction fails
        }
      }

      // Return the quick company data
      res.json({
        companies,
        query,
        strategyId: strategyId || null,
        sessionId,
        searchType: searchType || "emails",
      });
    } catch (error) {
      console.error("Quick search error:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
    }
  });

  // Companies search endpoint
  app.post("/api/companies/search", async (req, res) => {
    // For compatibility with the existing search functionality
    // This temporary fix uses a default user ID if authentication fails
    const userId = req.isAuthenticated() && req.user ? (req.user as any).id : 1;

    const {
      query,
      strategyId,
      includeContacts = true,
      contactSearchConfig,
      sessionId,
    } = req.body;

    // Debug: Log contact search configuration at batch level
    console.log(`[BATCH CONFIG] Contact search configuration:`, {
      enableCoreLeadership: contactSearchConfig?.enableCoreLeadership,
      enableDepartmentHeads: contactSearchConfig?.enableDepartmentHeads,
      enableMiddleManagement: contactSearchConfig?.enableMiddleManagement,
      enableCustomSearch: contactSearchConfig?.enableCustomSearch,
      customSearchTarget: contactSearchConfig?.customSearchTarget,
      query: query,
    });

    if (!query || typeof query !== "string") {
      res.status(400).json({
        message: "Invalid request: query must be a non-empty string",
      });
      return;
    }

    try {
      // Check cache first to avoid duplicate API calls
      const cacheKey = `search_${Buffer.from(query).toString("base64")}_companies`;
      global.searchCache = global.searchCache || new Map();

      let companyResults;
      let cachedCompanies = null;
      const cached = global.searchCache.get(cacheKey);

      console.log(`[Full Search] Cache key: ${cacheKey}`);
      console.log(`[Full Search] Cache has ${global.searchCache.size} entries`);
      console.log(`[Full Search] Cache entry exists: ${!!cached}`);

      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log(
          `[Full Search] Using cached company data for query: ${query}`,
        );
        companyResults = cached.apiResults;
        cachedCompanies = cached.companyRecords;
      } else {
        if (cached) {
          console.log(
            `[Full Search] Cache expired - age: ${Date.now() - cached.timestamp}ms, TTL: ${cached.ttl}ms`,
          );
        }
        console.log(
          `[Full Search] Cache miss - fetching fresh company results for query: ${query}`,
        );
        companyResults = await searchCompanies(query);
      }

      // Use direct search approach without strategy database dependency
      let selectedStrategy = null;
      if (strategyId) {
        console.log(
          `Strategy ID ${strategyId} requested - using direct search flow`,
        );
      }

      // Process search using direct modules without strategy dependency

      // Use direct search without strategy dependency
      console.log("Processing company search with direct search approach");

      // If we have cached companies, reuse them and enrich with contacts
      if (cachedCompanies) {
        console.log(
          `[Full Search] Reusing ${cachedCompanies.length} cached company records - enriching with contacts`,
        );

        // Helper function to process companies in parallel batches
        async function processBatch<T, R>(
          items: T[],
          processor: (item: T) => Promise<R>,
          batchSize: number = 4,
        ): Promise<R[]> {
          const results: R[] = [];
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(processor));
            results.push(...batchResults);
          }
          return results;
        }

        // Enrich existing companies with contacts using parallel batch processing
        const enrichedCompanies = await processBatch(
          cachedCompanies,
          async (existingCompany) => {
            const companyName = existingCompany.name;
            const companyWebsite = existingCompany.website;
            const companyDescription = existingCompany.description;

            // Use direct contact search without strategy dependency
            console.log(
              `Processing contacts for existing company: ${companyName}`,
            );

            // Skip company update - use existing company data
            const updatedCompany = existingCompany;

            // Determine industry from company name and description
            let industry: string | undefined = undefined;

            // Simple industry detection using company name and description
            const companyText =
              `${companyName} ${companyDescription || ""}`.toLowerCase();
            const industryKeywords: Record<string, string> = {
              software: "technology",
              tech: "technology",
              development: "technology",
              it: "technology",
              programming: "technology",
              cloud: "technology",
              healthcare: "healthcare",
              medical: "healthcare",
              hospital: "healthcare",
              doctor: "healthcare",
              finance: "financial",
              banking: "financial",
              investment: "financial",
              construction: "construction",
              building: "construction",
              "real estate": "construction",
              legal: "legal",
              law: "legal",
              attorney: "legal",
              retail: "retail",
              shop: "retail",
              store: "retail",
              education: "education",
              school: "education",
              university: "education",
              manufacturing: "manufacturing",
              factory: "manufacturing",
              production: "manufacturing",
              consulting: "consulting",
              advisor: "consulting",
            };

            for (const [keyword, industryValue] of Object.entries(
              industryKeywords,
            )) {
              if (companyText.includes(keyword)) {
                industry = industryValue;
                break;
              }
            }

            if (!industry && companyName) {
              const nameLower = companyName.toLowerCase();
              if (
                nameLower.includes("tech") ||
                nameLower.includes("software")
              ) {
                industry = "technology";
              } else if (
                nameLower.includes("health") ||
                nameLower.includes("medical")
              ) {
                industry = "healthcare";
              } else if (
                nameLower.includes("financ") ||
                nameLower.includes("bank")
              ) {
                industry = "financial";
              } else if (nameLower.includes("consult")) {
                industry = "consulting";
              }
            }

            console.log(
              `Detected industry for ${companyName}: ${industry || "unknown"}`,
            );

            // Debug: Log company-level configuration before enhanced contact finder
            console.log(`[COMPANY CONFIG] ${companyName} - Search config:`, {
              enableCoreLeadership: contactSearchConfig?.enableCoreLeadership,
              enableDepartmentHeads: contactSearchConfig?.enableDepartmentHeads,
              enableMiddleManagement:
                contactSearchConfig?.enableMiddleManagement,
              enableCustomSearch: contactSearchConfig?.enableCustomSearch,
              customSearchTarget: contactSearchConfig?.customSearchTarget,
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
              enableMiddleManagement:
                contactSearchConfig?.enableMiddleManagement,
              enableCustomSearch:
                contactSearchConfig?.enableCustomSearch ?? false,
              customSearchTarget: contactSearchConfig?.customSearchTarget ?? "",
              enableCustomSearch2:
                contactSearchConfig?.enableCustomSearch2 ?? false,
              customSearchTarget2:
                contactSearchConfig?.customSearchTarget2 ?? "",
            });

            console.log(
              `Found ${contacts.length} contacts using enhanced contact finder`,
            );

            // Create contact records
            const createdContacts = [];

            for (const contact of contacts) {
              const created = storage.createContact({
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
                verificationSource: "Decision-maker Analysis",
                nameConfidenceScore: contact.nameConfidenceScore ?? null,
                userFeedbackScore: null,
                feedbackCount: 0,
                userId: userId,
              });

              createdContacts.push(created);
            }

            return {
              ...(updatedCompany || existingCompany),
              contacts: await Promise.all(createdContacts),
            };
          },
          4, // batch size
        );

        // Return enriched companies using existing records
        res.json({
          companies: enrichedCompanies,
          query,
          strategyId: null,
          strategyName: "Direct Search Flow",
        });

        return; // Early return to skip the new company creation logic
      }

      // If no cached companies, create new ones (fallback logic)
      const companies = await Promise.all(
        companyResults.map(async (company: any) => {
          // Extract company name, website and description (if available)
          const companyName =
            typeof company === "string" ? company : company.name;
          const companyWebsite =
            typeof company === "string" ? null : company.website || null;
          const companyDescription =
            typeof company === "string" ? null : company.description || null;

          console.log(
            `Processing company: ${companyName}, Website: ${companyWebsite || "Not available"}`,
          );

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
            industry: "unknown",
            minimumConfidence: 30,
            maxContacts: 15,
            includeMiddleManagement: true,
            prioritizeLeadership: true,
            useMultipleQueries: true,
          });

          console.log(`Found ${contacts.length} contacts for ${companyName}`);

          // Create contact records
          const createdContacts = await Promise.all(
            contacts.map((contact) =>
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
                verificationSource: "Contact Search",
                nameConfidenceScore: contact.nameConfidenceScore ?? null,
                userFeedbackScore: null,
                feedbackCount: 0,
                userId: 0
              }),
            ),
          );

          return { ...createdCompany, contacts: createdContacts };
        }),
      );

      // Store complete session results if sessionId provided
      if (sessionId) {
        const session = global.searchSessions.get(sessionId);
        if (session) {
          session.status = "contacts_complete";
          session.fullResults = companies;
          session.timestamp = Date.now();
          global.searchSessions.set(sessionId, session);
          console.log(
            `[Full Search] Session ${sessionId} completed with ${companies.length} companies and contacts`,
          );
        }
      }

      // Return results immediately to complete the search
      res.json({
        companies: companies,
        query: query,
        strategyId: null,
        strategyName: "Direct Search Flow",
        sessionId,
      });

      // Contact discovery complete - return results immediately
      console.log(
        `Search completed successfully with ${companies.length} companies`,
      );
    } catch (error) {
      console.error("Company search error:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during company search",
      });
    }
  });

  // Contacts
  app.get(
    "/api/companies/:companyId/contacts",
    requireAuth,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const companyId = parseInt(req.params.companyId);

        // Handle cache invalidation for fresh data requests
        const cacheTimestamp = req.query.t;

        const contacts = await storage.listContactsByCompany(companyId, userId);

        // Set no-cache headers for fresh data requests
        if (cacheTimestamp) {
          res.set({
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          });
        }

        res.json(contacts);
      } catch (error) {
        console.error("Error fetching contacts by company:", error);
        res.status(500).json({ message: "Failed to fetch contacts" });
      }
    },
  );

  app.post(
    "/api/companies/:companyId/enrich-contacts",
    requireAuth,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const companyId = parseInt(req.params.companyId);
        const company = await storage.getCompany(companyId);

        if (!company) {
          res.status(404).json({ message: "Company not found" });
          return;
        }

        // Get any active decision-maker module approach
        const approaches = await storage.listSearchApproaches();
        const decisionMakerApproach = approaches.find(
          (a) => a.moduleType === "decision_maker" && a.active,
        );

        if (!decisionMakerApproach) {
          res.status(400).json({
            message: "Decision-maker analysis approach is not configured",
          });
          return;
        }

        try {
          console.log(
            "Starting decision-maker analysis for company:",
            company.name,
          );

          // Perform decision-maker analysis with technical prompt
          const analysisResult = await analyzeCompany(
            company.name,
            decisionMakerApproach.prompt||'',
            decisionMakerApproach.technicalPrompt,
            decisionMakerApproach.responseStructure,
          );
          console.log("Decision-maker analysis result:", analysisResult);

          // Extract contacts focusing on core fields only
          // Determine industry from company name
          let industry: string | undefined = undefined;
          if (company.name) {
            const nameLower = company.name.toLowerCase();
            // Simple industry detection from company name
            if (nameLower.includes("tech") || nameLower.includes("software")) {
              industry = "technology";
            } else if (
              nameLower.includes("health") ||
              nameLower.includes("medical")
            ) {
              industry = "healthcare";
            } else if (
              nameLower.includes("financ") ||
              nameLower.includes("bank")
            ) {
              industry = "financial";
            } else if (nameLower.includes("consult")) {
              industry = "consulting";
            }
            // Check for industry in company services if available
            if (!industry && company.services && company.services.length > 0) {
              const serviceString = company.services.join(" ").toLowerCase();
              if (
                serviceString.includes("tech") ||
                serviceString.includes("software") ||
                serviceString.includes("development")
              ) {
                industry = "technology";
              } else if (
                serviceString.includes("health") ||
                serviceString.includes("medical")
              ) {
                industry = "healthcare";
              } else if (
                serviceString.includes("financ") ||
                serviceString.includes("bank")
              ) {
                industry = "financial";
              }
            }
          }
          console.log(
            `Detected industry for contact enrichment: ${industry || "unknown"}`,
          );

          // Use enhanced contact finder for enrichment with default settings
          const newContacts = await findKeyDecisionMakers(company.name, {
            industry: industry,
            minimumConfidence: 30,
            maxContacts: 10,
            includeMiddleManagement: true,
            prioritizeLeadership: true,
            useMultipleQueries: true,
            // Enable all search types for enrichment
            enableCoreLeadership: true,
            enableDepartmentHeads: true,
            enableMiddleManagement: true,
            enableCustomSearch: false,
            customSearchTarget: "",
          });
          console.log("Enhanced contact finder results:", newContacts);

          // Remove existing contacts
          await storage.deleteContactsByCompany(companyId, req.user!.id);

          // Create new contacts with only the essential fields and minimum confidence score
          const validContacts = newContacts.filter(
            (contact: Partial<Contact>) =>
              contact.name &&
              contact.name !== "Unknown" &&
              (!contact.probability || contact.probability >= 40), // Filter out contacts with low confidence/probability scores
          );
          console.log("Valid contacts for enrichment:", validContacts);

          const createdContacts = await Promise.all(
            validContacts.map(async (contact: Partial<Contact>) => {
              console.log(`Processing contact enrichment for: ${contact.name}`);

              return storage.createContact({
                companyId,
                name: contact.name!,
                role: contact.role || null,
                email: contact.email || null,
                priority: contact.priority ?? null,
                linkedinUrl: null,
                twitterHandle: null,
                phoneNumber: null,
                department: null,
                location: null,
                verificationSource: "Decision-maker Analysis",
                userId: userId,
              });
            }),
          );

          console.log("Created contacts:", createdContacts);
          res.json(createdContacts);
        } catch (error) {
          console.error("Contact enrichment error:", error);
          res.status(500).json({
            message:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred during contact enrichment",
          });
        }
      } catch (error) {
        console.error("Contact enrichment error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred during contact enrichment",
        });
      }
    },
  );
  app.post(
    "/api/companies/:companyId/enrich-top-prospects",
    requireAuth,
    async (req, res) => {
      try {
        const companyId = parseInt(req.params.companyId);
        const searchId = `search_${Date.now()}`;
        const { contactIds } = req.body; // Get the specific contact IDs to enrich

        // Start the enrichment process
        const queueId = await postSearchEnrichmentService.startEnrichment(
          searchId,
          contactIds,
        );

        res.json({
          message: "Top prospects enrichment started",
          queueId,
          status: "processing",
        });
      } catch (error) {
        console.error("Enrichment start error:", error);
        res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Failed to start enrichment process",
        });
      }
    },
  );

  // Backend Email Search Orchestration Endpoint
  app.post("/api/companies/find-all-emails", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { companyIds, sessionId } = req.body;

      if (
        !companyIds ||
        !Array.isArray(companyIds) ||
        companyIds.length === 0
      ) {
        res.status(400).json({ message: "companyIds array is required" });
        return;
      }

      // Mark email search as started in session if sessionId provided
      if (sessionId) {
        const session = global.searchSessions?.get(sessionId);
        if (session) {
          session.emailSearchStatus = "running";
          global.searchSessions.set(sessionId, session);
          console.log(
            `[Email Search] Session ${sessionId} marked as email search running`,
          );
        }
      }

      let totalProcessed = 0;
      let totalEmailsFound = 0;
      const results = [];

      // Helper function to add delay
      const delay = (ms: number): Promise<void> =>
        new Promise((resolve) => setTimeout(resolve, ms));

      // Process individual company with waterfall search
      const processCompany = async (companyId: number, index: number) => {
        // Add staggered delay before starting each company
        await delay(index * 400);

        try {
          const company = await storage.getCompany(companyId);
          if (!company) {
            console.log(`Company ${companyId} not found, skipping`);
            return { processed: 0, emailsFound: 0, result: null };
          }

          console.log(
            `Processing emails for company: ${company.name} (started after ${index * 400}ms delay)`,
          );

          // Get current contacts for this company
          const contacts = await storage.listContactsByCompany(
            company.id,
            userId,
          );

          // Filter to contacts needing emails (top 3 contacts without emails)
          const topContacts = contacts
            .sort((a, b) => (b.probability || 0) - (a.probability || 0))
            .slice(0, 3)
            .filter((contact) => !contact.email || contact.email.length <= 5);

          if (topContacts.length === 0) {
            console.log(`No contacts need email search for ${company.name}`);
            return { processed: 0, emailsFound: 0, result: null };
          }

          // Helper function: Search multiple contacts with Apollo
          const searchApolloContacts = async (contacts: Contact[]) => {
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];

            for (const contact of contacts) {
              try {
                const apolloResponse = await fetch(
                  `http://localhost:5000/api/contacts/${contact.id}/apollo`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: req.headers.authorization || "",
                    },
                  },
                );

                const apolloData = await apolloResponse.json();
                if (
                  apolloResponse.status === 200 ||
                  apolloResponse.status === 422
                ) {
                  const contactData =
                    apolloResponse.status === 200
                      ? apolloData
                      : apolloData.contact;
                  if (contactData.email && contactData.email.length > 5) {
                    emailsFound++;
                    sources.push(`Apollo-${contact.name}`);
                    console.log(
                      `Apollo found email for ${contact.name}: ${contactData.email}`,
                    );
                  }
                  contactsProcessed++;
                }
              } catch (error) {
                console.error(
                  `Apollo search failed for contact ${contact.id}:`,
                  error,
                );
                contactsProcessed++;
              }
            }

            return { emailsFound, contactsProcessed, sources };
          };

          // Helper function: Search multiple contacts with Perplexity
          const searchPerplexityContacts = async (contacts: Contact[]) => {
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];

            for (const contact of contacts) {
              try {
                const enrichedDetails = await searchContactDetails(
                  contact.name,
                  company.name,
                );
                if (
                  enrichedDetails &&
                  enrichedDetails.email &&
                  enrichedDetails.email.length > 5
                ) {
                  await storage.updateContact(
                    contact.id,
                    {
                      ...enrichedDetails,
                      completedSearches: [
                        ...(contact.completedSearches || []),
                        "contact_enrichment",
                      ],
                    },
                  );
                  emailsFound++;
                  sources.push(`Perplexity-${contact.name}`);
                  console.log(
                    `Perplexity found email for ${contact.name}: ${enrichedDetails.email}`,
                  );
                }
                contactsProcessed++;
              } catch (error) {
                console.error(
                  `Perplexity search failed for contact ${contact.id}:`,
                  error,
                );
                contactsProcessed++;
              }
            }

            return { emailsFound, contactsProcessed, sources };
          };

          // Helper function: Search multiple contacts with Hunter
          const searchHunterContacts = async (contacts: Contact[]) => {
            let emailsFound = 0;
            let contactsProcessed = 0;
            const sources = [];

            for (const contact of contacts) {
              try {
                const hunterResponse = await fetch(
                  `http://localhost:5000/api/contacts/${contact.id}/hunter`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: req.headers.authorization || "",
                    },
                  },
                );

                const hunterData = await hunterResponse.json();
                if (
                  hunterResponse.status === 200 ||
                  hunterResponse.status === 422
                ) {
                  const contactData =
                    hunterResponse.status === 200
                      ? hunterData
                      : hunterData.contact;
                  if (contactData.email && contactData.email.length > 5) {
                    emailsFound++;
                    sources.push(`Hunter-${contact.name}`);
                    console.log(
                      `Hunter found email for ${contact.name}: ${contactData.email}`,
                    );
                  }
                  contactsProcessed++;
                }
              } catch (error) {
                console.error(
                  `Hunter search failed for contact ${contact.id}:`,
                  error,
                );
                contactsProcessed++;
              }
            }

            return { emailsFound, contactsProcessed, sources };
          };

          // Define contact assignments
          const contact1 = topContacts[0]; // Highest scored
          const contact2 = topContacts[1]; // Second highest
          const contact3 = topContacts[2]; // Third highest

          // Tier 1 & 2: Run Apollo and Perplexity in parallel
          console.log(
            `Starting parallel search - Apollo: contacts 1&2, Perplexity: contacts 1&3 for ${company.name}`,
          );
          const [apolloResults, perplexityResults] = await Promise.all([
            searchApolloContacts([contact1, contact2].filter(Boolean)),
            searchPerplexityContacts([contact1, contact3].filter(Boolean)),
          ]);

          const combinedEmailsFound =
            apolloResults.emailsFound + perplexityResults.emailsFound;
          const combinedContactsProcessed =
            apolloResults.contactsProcessed +
            perplexityResults.contactsProcessed;
          const combinedSources = [
            ...apolloResults.sources,
            ...perplexityResults.sources,
          ];

          // Early return if emails found
          if (combinedEmailsFound > 0) {
            console.log(
              `Parallel search success for ${company.name}: ${combinedEmailsFound} emails found`,
            );
            return {
              processed: combinedContactsProcessed,
              emailsFound: combinedEmailsFound,
              result: {
                companyId: company.id,
                companyName: company.name,
                emailsFound: combinedEmailsFound,
                source: combinedSources.join(", "),
              },
            };
          }

          // Tier 3: Hunter only if no emails found in Tiers 1 & 2
          console.log(
            `No emails found in parallel search, trying Hunter for ${company.name}`,
          );
          const hunterResults = await searchHunterContacts(
            [contact1, contact2].filter(Boolean),
          );

          return {
            processed:
              combinedContactsProcessed + hunterResults.contactsProcessed,
            emailsFound: hunterResults.emailsFound,
            result: {
              companyId: company.id,
              companyName: company.name,
              emailsFound: hunterResults.emailsFound,
              source:
                hunterResults.emailsFound > 0
                  ? hunterResults.sources.join(", ")
                  : "None",
            },
          };
        } catch (error) {
          console.error(`Error processing company ${companyId}:`, error);
          return { processed: 0, emailsFound: 0, result: null };
        }
      };

      // Process all companies in parallel with staggered starts
      const companyResults = await Promise.all(
        companyIds.map((companyId, index) => processCompany(companyId, index)),
      );

      // Collect results and calculate totals + source breakdown
      const sourceBreakdown = { Perplexity: 0, Apollo: 0, Hunter: 0 };

      for (const { processed, emailsFound, result } of companyResults) {
        totalProcessed += processed;
        totalEmailsFound += emailsFound;
        if (result) {
          results.push(result);
          if (result.source && result.emailsFound > 0) {
            // Handle parallel search results with multiple sources
            const sources = result.source.split(", ");
            sources.forEach((source) => {
              if (source.includes("Apollo")) {
                sourceBreakdown.Apollo++;
              } else if (source.includes("Perplexity")) {
                sourceBreakdown.Perplexity++;
              } else if (source.includes("Hunter")) {
                sourceBreakdown.Hunter++;
              }
            });
          }
        }
      }

      console.log(
        `Backend email orchestration completed: ${totalEmailsFound} emails found from ${totalProcessed} searches across ${companyIds.length} companies`,
      );
      console.log(
        `Source breakdown - Perplexity: ${sourceBreakdown.Perplexity}, Apollo: ${sourceBreakdown.Apollo}, Hunter: ${sourceBreakdown.Hunter}`,
      );

      // Mark email search as completed in session if sessionId provided
      if (sessionId) {
        const session = global.searchSessions?.get(sessionId);
        if (session) {
          session.emailSearchStatus = "completed";
          session.emailSearchCompleted = Date.now();
          global.searchSessions.set(sessionId, session);
          console.log(
            `[Email Search] Session ${sessionId} marked as email search completed`,
          );
        }
      }

      res.json({
        success: true,
        summary: {
          companiesProcessed: companyIds.length,
          contactsProcessed: totalProcessed,
          emailsFound: totalEmailsFound,
          sourceBreakdown,
        },
        results,
      });
    } catch (error) {
      console.error("Backend email orchestration error:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to orchestrate email search",
      });
    }
  });

}