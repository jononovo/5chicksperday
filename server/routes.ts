import express, { type Express, Request, Response } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { searchCompanies, analyzeCompany } from "./lib/search-logic";
import { extractContacts } from "./lib/perplexity";
import { parseCompanyData } from "./lib/results-analysis/company-parser";
import { queryPerplexity } from "./lib/api/perplexity-client";
import { searchContactDetails } from "./lib/api-interactions";
import { insertCompanySchema, insertContactSchema, insertSearchApproachSchema, insertListSchema, insertCampaignSchema } from "@shared/schema";
import { insertEmailTemplateSchema } from "@shared/schema";
import { emailEnrichmentService } from "./lib/search-logic/email-enrichment/service"; 
import type { PerplexityMessage } from "./lib/perplexity";
import type { Contact } from "@shared/schema";
import { postSearchEnrichmentService } from "./lib/search-logic/post-search-enrichment/service";

// Keep track of active keep-alive intervals
const keepAliveIntervals: Record<string, NodeJS.Timeout> = {};

// Helper function to safely parse an ID parameter
function parseIdParam(idParam: string): number | null {
  const id = Number(idParam);
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

// Define interfaces for external workflow interactions
interface ExternalSearchRequest {
  query: string;
  callbackUrl: string;
  additionalParams?: Record<string, any>;
}

interface ExternalSearchResult {
  searchId: string;
  status: 'in_progress' | 'completed' | 'failed';
  stage?: string;
  progress?: number;
  timestamp?: string;
  results?: {
    companies?: any[];
    contacts?: any[];
    metadata?: {
      moduleType?: string;
      completedSearches?: string[];
      validationScores?: Record<string, number>;
      queryDetails?: {
        original?: string;
        refined?: string;
      };
    };
  };
  error?: string;
}

// Store recent logs for debugging
const logBuffer: {timestamp: string, message: string, type: string}[] = [];
const MAX_LOG_ENTRIES = 100;

// Custom logger that also stores logs
function logWithStorage(message: string, type = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, type };
  
  // Store in our buffer
  logBuffer.push(logEntry);
  
  // Keep buffer at a reasonable size
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
  
  // Also log to console
  if (type === 'error') {
    console.error(`[${timestamp}] ${message}`);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

export function registerRoutes(app: Express) {
  // Log endpoint for remote access to application logs
  app.get("/api/debug/logs", (_req, res) => {
    res.json({ logs: logBuffer });
  });
  
  // Clear logs endpoint
  app.post("/api/debug/logs/clear", (_req, res) => {
    logBuffer.length = 0;
    res.json({ success: true, message: "Logs cleared" });
  });
  
  // Add webhook status check endpoint for quick verification
  app.get("/api/debug/webhook-status", async (_req, res) => {
    try {
      // Find logs related to webhooks
      const webhookLogs = logBuffer.filter(log => 
        log.message.includes("WEBHOOK RECEIVED") || 
        log.message.includes("searchId") || 
        log.message.includes("API")
      );
      
      // Get most recently created companies
      const companies = await storage.listCompanies();
      const recentCompanies = companies
        .sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        })
        .slice(0, 5);
      
      return res.json({
        webhookActivity: webhookLogs.length > 0,
        recentWebhookHits: webhookLogs.length,
        lastWebhookLogs: webhookLogs.slice(-10), // last 10 webhook-related logs
        recentCompanies: recentCompanies,
        lastChecked: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error checking webhook status:", error);
      return res.status(500).json({ 
        message: "Failed to check webhook status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Ping endpoint for keep-alive mechanism
  app.get("/api/ping", (req, res) => {
    const searchId = req.query.searchId as string;
    if (searchId) {
      logWithStorage(`Keep-alive ping received for search: ${searchId}`, "info");
    }
    res.json({ 
      status: "alive", 
      timestamp: new Date().toISOString(),
      keepAliveActive: Object.keys(keepAliveIntervals).length > 0
    });
  });
  
  /**
   * Starts a keep-alive timer for a specific search ID
   * Sends regular ping requests to keep the server running for the specified duration
   */
  function startKeepAlive(searchId: string, minutes: number = 15): void {
    // Clear any existing keep-alive for this search ID
    if (keepAliveIntervals[searchId]) {
      clearInterval(keepAliveIntervals[searchId]);
      delete keepAliveIntervals[searchId];
    }
    
    const intervalMs = 60000; // 1 minute
    let remainingMinutes = minutes;
    
    logWithStorage(`Starting keep-alive for search ${searchId} for ${minutes} minutes`, "info");
    
    // Set up a new keep-alive interval
    keepAliveIntervals[searchId] = setInterval(() => {
      remainingMinutes--;
      
      if (remainingMinutes <= 0) {
        // Time's up, clear the interval
        logWithStorage(`Keep-alive for search ${searchId} completed after ${minutes} minutes`, "info");
        if (keepAliveIntervals[searchId]) {
          clearInterval(keepAliveIntervals[searchId]);
          delete keepAliveIntervals[searchId];
        }
        return;
      }
      
      // Log the keep-alive ping
      logWithStorage(`Keep-alive ping for search ${searchId} (${remainingMinutes} minutes remaining)`, "info");
      
      // Internally ping our own endpoint to maintain activity
      // This is done within the server to avoid HTTP request overhead
      // The app stays awake as long as there are active timers
    }, intervalMs);
  }
  // External Provider Webhook Endpoint
  app.post("/api/external-workflow/webhook", async (req: Request, res: Response) => {
    try {
      logWithStorage("============ WEBHOOK RECEIVED ============");
      logWithStorage("Received webhook from external provider at " + new Date().toISOString());
      
      // Extract the basic payload info for logging
      const payload = req.body.data || req.body.payload || req.body;
      
      // IMMEDIATE ACKNOWLEDGMENT - We respond to the webhook immediately to prevent timeout
      // This is critical for providers like Lead-Gen Rabbit that have a 30-second timeout
      
      // Find searchId in various places
      let searchId = payload.searchId || req.body.searchId || req.query.searchId as string;
      
      // Check additional places if still not found
      if (!searchId && payload.results && payload.results.searchId) {
        searchId = payload.results.searchId;
      }
      
      if (!searchId) {
        return res.status(400).json({
          success: false,
          message: "Missing required searchId parameter"
        });
      }
      
      // Basic validation of status field
      const status = payload.status;
      if (!['in_progress', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status. Must be one of: in_progress, completed, failed"
        });
      }
      
      // CRITICAL: Acknowledge receipt BEFORE processing data
      // This ensures we respond quickly before the provider times out
      res.status(200).json({
        success: true,
        message: `Webhook received for searchId: ${searchId}`,
        status
      });
      
      // Now process the data asynchronously AFTER sending the response
      // This way, even if processing takes longer than 30 seconds, the webhook sender
      // has already received an acknowledgment and won't time out
      setTimeout(async () => {
        try {
          logWithStorage("Starting asynchronous processing of webhook data");
          
          // If this is a partial update (in_progress), extend the keep-alive timer for this search
          // This ensures the app stays awake for the final webhook
          if (status === 'in_progress') {
            logWithStorage(`Extending keep-alive for search ${searchId} since we received a partial update`, "info");
            startKeepAlive(searchId, 15); // Reset the timer for another 15 minutes
          }
          
          // More detailed logging after we've already responded
          logWithStorage("Headers: " + JSON.stringify(req.headers, null, 2));
          logWithStorage("Body: " + JSON.stringify(req.body, null, 2));
          logWithStorage("Request IP: " + req.ip);
          logWithStorage("User-Agent: " + req.headers['user-agent']);
          
          // Enhanced payload validation and extraction
          // We need to handle different possible formats from various providers
          let results;
          
          // Try different possible locations for the results data
          if (payload.results) {
            results = payload.results;
            logWithStorage("Found results in payload.results");
          } else if (payload.data && payload.data.results) {
            results = payload.data.results;
            logWithStorage("Found results in payload.data.results");
          } else if (Array.isArray(payload.companies) || Array.isArray(payload.data?.companies)) {
            // Some providers might send companies directly in the root
            results = {
              companies: Array.isArray(payload.companies) ? payload.companies : payload.data?.companies
            };
            logWithStorage("Found companies array at root level");
          } else {
            // Last attempt - treat the entire payload as results if it has companies array
            if (Array.isArray(payload.data)) {
              results = { companies: payload.data };
              logWithStorage("Treating payload.data array as companies");
            } else {
              logWithStorage("No results found in payload with known structure", "error");
              logWithStorage("Payload structure: " + JSON.stringify(Object.keys(payload)), "error");
              
              // If we still can't find results, log additional debug info
              if (typeof payload === 'object' && payload !== null) {
                for (const key of Object.keys(payload)) {
                  logWithStorage(`Payload key "${key}" type: ${typeof payload[key]}`, "info");
                  if (typeof payload[key] === 'object' && payload[key] !== null) {
                    logWithStorage(`Payload["${key}"] keys: ${Object.keys(payload[key])}`, "info");
                  }
                }
              }
              
              return;
            }
          }
          
          let source = 'External Provider';
          
          // Update source information if available
          if (results.metadata?.moduleType) {
            source = `Lead-Gen Rabbit: ${results.metadata.moduleType}`;
          }
          
          const isInProgress = status === 'in_progress';
          const stage = (results as any).stage || 'unknown';
          const progress = (results as any).progress || 0;
          
          // Log progress information
          if (isInProgress) {
            console.log(`Search ${searchId} in progress: Stage ${stage}, Progress ${progress}%`);
          }
          
          // Store companies in the database
          if (results.companies && Array.isArray(results.companies)) {
            for (const companyData of results.companies) {
              try {
                // Check if this is a partial or complete result
                const isPartial = isInProgress || stage !== 'EMAIL_DISCOVERY';
                
                // Create company record
                const company = await storage.createCompany({
                  name: companyData.name,
                  website: companyData.website || null,
                  industry: companyData.industry || null,
                  location: companyData.location || null,
                  description: companyData.description || null,
                  employeeCount: companyData.employeeCount || null,
                  foundedYear: companyData.foundedYear || null,
                  revenue: companyData.revenue || null,
                  socialProfiles: companyData.socialProfiles || null,
                  technologiesUsed: companyData.technologiesUsed || null,
                  productOfferings: companyData.productOfferings || null,
                  headquarters: companyData.headquarters || null
                });
                
                // Process contacts if available
                if (companyData.contacts && Array.isArray(companyData.contacts)) {
                  for (const contactData of companyData.contacts) {
                    await storage.createContact({
                      companyId: company.id,
                      name: contactData.name,
                      role: contactData.role || null,
                      email: contactData.email || null,
                      probability: contactData.probability || null,
                      linkedinUrl: contactData.linkedinUrl || null,
                      twitterHandle: contactData.twitterHandle || null,
                      phoneNumber: contactData.phoneNumber || null,
                      department: contactData.department || null,
                      location: contactData.location || null,
                      verificationSource: source,
                      nameConfidenceScore: contactData.nameConfidenceScore || null,
                      userFeedbackScore: null,
                      feedbackCount: 0
                    });
                  }
                }
                
                logWithStorage(`Processed company: ${companyData.name} with ${companyData.contacts?.length || 0} contacts`);
              } catch (error) {
                console.error("Error processing external provider company:", error);
              }
            }
          }
          
          // Store standalone contacts if provided
          if (results.contacts && Array.isArray(results.contacts)) {
            for (const contactData of results.contacts) {
              // Only process contacts that have a companyId
              if (contactData.companyId) {
                try {
                  await storage.createContact({
                    companyId: contactData.companyId,
                    name: contactData.name,
                    role: contactData.role || null,
                    email: contactData.email || null,
                    probability: contactData.probability || null,
                    linkedinUrl: contactData.linkedinUrl || null,
                    twitterHandle: contactData.twitterHandle || null,
                    phoneNumber: contactData.phoneNumber || null,
                    department: contactData.department || null,
                    location: contactData.location || null,
                    verificationSource: source,
                    nameConfidenceScore: contactData.nameConfidenceScore || null,
                    userFeedbackScore: null,
                    feedbackCount: 0
                  });
                } catch (error) {
                  console.error("Error processing external provider contact:", error);
                }
              }
            }
          }
          
          logWithStorage(`Completed asynchronous processing of webhook data for ${searchId}`);
        } catch (error) {
          console.error("Error in asynchronous webhook processing:", error);
        }
      }, 0); // Process immediately but asynchronously
      
    } catch (error) {
      console.error("Error receiving external provider webhook:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error processing webhook",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // External Provider API Routes
  
  // Lion Provider Endpoint
  app.post("/api/external-provider/lion", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: query"
        });
      }
      
      // Generate callback URL - use actual server host in production
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:5000';
      const callbackUrl = `${protocol}://${host}/api/external-workflow/webhook`;
      
      // Configuration for Lion provider
      const endpoint = process.env.LEAD_GEN_LION_ENDPOINT || "https://api.leadgenlion.example.com/api/search";
      const apiKey = process.env.LEAD_GEN_LION_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: "Lion API key not configured"
        });
      }
      
      // Make API request to Lion provider
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ 
          query, 
          callbackUrl 
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lion API error (${response.status}): ${errorText}`);
      }
      
      const result = await response.json();
      
      return res.status(200).json({
        success: true,
        message: "Search request sent to Lead-Gen Lion",
        searchId: result.searchId,
        status: result.status
      });
      
    } catch (error) {
      console.error("Error initiating Lion search:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to initiate Lead-Gen Lion search",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Rabbit Provider Endpoint - Uses the actual Lead-Gen Rabbit API
  app.post("/api/external-provider/rabbit", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: query"
        });
      }
      
      // Generate a unique search ID
      const searchId = `rabbit_search_${Date.now()}`;
      
      console.log(`Received search request for query: "${query}"`);
      
      // Use the deployed URL for the webhook callback
      // This ensures Lead-Gen Rabbit can consistently reach our webhook endpoint
      const deployedUrl = "https://Bear-App.replit.app";
      const callbackUrl = `${deployedUrl}/api/external-workflow/webhook`;
      
      console.log(`Using webhook callback URL: ${callbackUrl}`); // Added for debugging
      
      // Fallback for local development if needed
      // const protocol = req.headers['x-forwarded-proto'] || 'http';
      // const host = req.headers.host || 'localhost:5000';
      // const localCallbackUrl = `${protocol}://${host}/api/external-workflow/webhook`;
      
      // Use the correct endpoint as confirmed by Lead-Gen Rabbit team
      const rabbitEndpoint = "https://lead-rabbit.replit.app/api/search";
      
      // Log this critical connection information
      logWithStorage("Using confirmed Rabbit API endpoint: " + rabbitEndpoint, "info");
      
      // Keep previous endpoints in case we need them for testing
      const fallbackEndpoints = [
        "https://358f51b5-fd9b-4fb9-82f8-7cf56a3f18d6-00-161sbihgzmt13.worf.replit.dev/api/webhooks/workflow/6/node/webhook_trigger-1"
      ];
      
      // Log the endpoint we're trying to connect to
      logWithStorage(`Attempting to connect to Rabbit API endpoint: ${rabbitEndpoint}`, "info");
      
      // Use the provided API key
      const apiKey = "LGR-API-ff82c91d7184d5eeb3f3a142";
      
      // Create the request payload according to the API docs
      const requestPayload = {
        query: query,
        callbackUrl: callbackUrl
      };
      
      console.log("Sending request to Lead-Gen Rabbit API:", {
        endpoint: rabbitEndpoint,
        payload: requestPayload
      });
      
      try {
        // Start a keep-alive timer to ensure the app stays awake for webhook responses
        logWithStorage(`Starting keep-alive for search ${searchId} - app will stay awake for 15 minutes`, "info");
        startKeepAlive(searchId, 15); // Keep the app running for 15 minutes
        
        // Make the actual API request to the Rabbit service
        const response = await fetch(rabbitEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestPayload)
        });
        
        // First get the raw response text
        const responseText = await response.text();
        logWithStorage(`Raw API response: ${responseText.substring(0, 200)}...`, "info");
        
        // Check if the response is JSON by attempting to parse it
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          // Not JSON - handle as error
          logWithStorage(`API returned non-JSON response: ${responseText.substring(0, 200)}...`, "error");
          throw new Error(`API returned invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
        
        // Check the response status
        if (!response.ok) {
          console.error(`Rabbit API error (${response.status}):`, responseData);
          logWithStorage(`API request failed with status ${response.status}: ${JSON.stringify(responseData)}`, "error");
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        console.log("Lead-Gen Rabbit API response:", responseData);
        
        // Return the actual API response to the client
        return res.status(200).json({
          success: true,
          message: "Search request sent to Lead-Gen Rabbit",
          searchId: responseData.searchId || searchId,
          status: 'in_progress',
          keepAlive: true // Indicate that keep-alive is active for 15 minutes
        });
      } catch (error) {
        console.error("Error calling Lead-Gen Rabbit API:", error);
        
        // Log the errors to console for debugging
        if (error instanceof Error) {
          console.error(`API Error Details: ${error.message}`);
        }
        
        // Log detailed API error
        logWithStorage("API ERROR: " + (error instanceof Error ? error.message : "Unknown error connecting to Lead-Gen Rabbit API"), "error");
        
        // Return a useful message to the client
        return res.status(200).json({
          success: false,
          message: "API not available",
          error: error instanceof Error ? error.message : "Unknown error connecting to Lead-Gen Rabbit API",
          searchId
        });
      }
      
    } catch (error) {
      console.error("Error initiating Rabbit search:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to initiate Lead-Gen Rabbit search",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Donkey Provider Endpoint
  app.post("/api/external-provider/donkey", async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Missing required parameter: query"
        });
      }
      
      // Simplified approach - direct company search without webhooks
      console.log("Starting simplified company search with Donkey provider:", query);
      
      // Configuration for Donkey provider - supporting both test and production environments
      const useProductionApi = process.env.LEAD_GEN_DONKEY_USE_PRODUCTION === "true";
      const isProduction = process.env.NODE_ENV === "production";
      
      // Determine which API key to use based on configuration
      const apiKey = useProductionApi || isProduction
        ? process.env.LEAD_GEN_DONKEY_PROD_API_KEY
        : process.env.LEAD_GEN_DONKEY_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: "Donkey API key not configured"
        });
      }
      
      console.log(`Using Lead-Gen Donkey ${useProductionApi || isProduction ? "PRODUCTION" : "TEST"} API`);
      
      // Make a real API request to Donkey endpoint
      // Using a simplified structure for now until we get complete workflow details
      // We'll update this with the correct endpoint when provided by Donkey
      
      // Try a direct API call to their company search endpoint
      // This is an interim approach until we get the proper workflow details
      const endpoint = "https://b45e11fa-5450-41c3-9aae-b0c5d9ba4636-00-2t2y9b3rc04rn.kirk.replit.dev/api/lead-gen/company-search";
      
      console.log("Making direct company search request to Donkey API:", endpoint);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Donkey API error (${response.status}): ${errorText}`);
          
          // Return a temporary response while we work on the integration
          return res.status(200).json({
            success: true,
            message: "Search in progress with Lead-Gen Donkey API",
            searchId: `donkey_search_${Date.now()}`,
            status: "in_progress"
          });
        }
        
        // Process the real API response
        const result = await response.json();
        console.log("Received Donkey API response:", result);
        
        // Return the actual API result
        return res.status(200).json(result);
      } catch (error) {
        console.error("Error connecting to Donkey API:", error);
        
        // Return a temporary error response
        return res.status(200).json({
          success: false,
          message: "Connection to Lead-Gen Donkey API failed - integration in progress",
          searchId: `donkey_search_${Date.now()}`,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
      
    } catch (error) {
      console.error("Error processing Donkey search:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process Lead-Gen Donkey search",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // New route for enriching multiple contacts
  app.post("/api/enrich-contacts", async (req, res) => {
    try {
      const { contactIds } = req.body;

      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        res.status(400).json({ message: "No contact IDs provided for enrichment" });
        return;
      }

      // Create a searchId for this batch
      const searchId = `search_${Date.now()}`;

      // Start the enrichment process using postSearchEnrichmentService
      const queueId = await postSearchEnrichmentService.startEnrichment(searchId, contactIds);

      res.json({
        message: "Contact enrichment started",
        queueId,
        status: 'processing',
        totalContacts: contactIds.length
      });
    } catch (error) {
      console.error('Contact enrichment error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to start enrichment process"
      });
    }
  });

// Lists
app.get("/api/lists", async (_req, res) => {
  const lists = await storage.listLists();
  res.json(lists);
});

app.get("/api/lists/:listId", async (req, res) => {
  const list = await storage.getList(parseInt(req.params.listId));
  if (!list) {
    res.status(404).json({ message: "List not found" });
    return;
  }
  res.json(list);
});

app.get("/api/lists/:listId/companies", async (req, res) => {
  const companies = await storage.listCompaniesByList(parseInt(req.params.listId));
  res.json(companies);
});

app.post("/api/lists", async (req, res) => {
  const { companies, prompt } = req.body;

  if (!Array.isArray(companies) || !prompt || typeof prompt !== 'string') {
    res.status(400).json({ message: "Invalid request: companies must be an array and prompt must be a string" });
    return;
  }

  try {
    // Get next available list ID (starting from 1001)
    const listId = await storage.getNextListId();

    // Create the list
    const list = await storage.createList({
      listId,
      prompt,
      resultCount: companies.length
    });

    // Update companies with the list ID
    await Promise.all(
      companies.map(company =>
        storage.updateCompanyList(company.id, listId)
      )
    );

    res.json(list);
  } catch (error) {
    console.error('List creation error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred while creating the list"
    });
  }
});

// Companies endpoints

// Note: Place specific routes BEFORE parameterized routes
// Add endpoint to get recent companies from external providers
app.get("/api/companies/recent", async (_req, res) => {
  try {
    // Fetch all companies
    const companies = await storage.listCompanies();
    console.log(`Found ${companies.length} companies, returning the most recent 10`);
    
    // Return an empty array if no companies found
    if (!companies || companies.length === 0) {
      return res.json([]);
    }
    
    // Sort by most recently created and limit to 10
    const recentCompanies = companies
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);
    
    // Return the companies without attempting to fetch contacts
    res.json(recentCompanies);
  } catch (error) {
    console.error("Error fetching recent companies:", error);
    res.status(500).json({ message: "Failed to fetch recent companies" });
  }
});

// Get all companies
app.get("/api/companies", async (_req, res) => {
  const companies = await storage.listCompanies();
  res.json(companies);
});

app.get("/api/companies/:id", async (req, res) => {
  const id = Number(req.params.id);
  
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid company ID" });
    return;
  }
  
  const company = await storage.getCompany(id);
  if (!company) {
    res.status(404).json({ message: "Company not found" });
    return;
  }
  res.json(company);
});

// Companies search endpoint
app.post("/api/companies/search", async (req, res) => {
  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      message: "Invalid request: query must be a non-empty string"
    });
    return;
  }

  try {
    // Search for matching companies
    const companyNames = await searchCompanies(query);

    // Get search approaches for analysis
    const approaches = await storage.listSearchApproaches();

    const companyOverview = approaches.find(a =>
      a.name === "Company Overview" && a.active
    );

    const decisionMakerAnalysis = approaches.find(a =>
      a.name === "Decision-maker Analysis" && a.active
    );

    if (!companyOverview) {
      res.status(400).json({
        message: "Company Overview approach is not active. Please activate it to proceed."
      });
      return;
    }

    // Analyze each company using technical prompts and response structures
    const companies = await Promise.all(
      companyNames.map(async (companyName) => {
        // Run Company Overview analysis with technical prompt
        const overviewResult = await analyzeCompany(
          companyName,
          companyOverview.prompt,
          companyOverview.technicalPrompt,
          companyOverview.responseStructure
        );
        const analysisResults = [overviewResult];

        // If Decision-maker Analysis is active, run it with technical prompt
        if (decisionMakerAnalysis?.active) {
          const decisionMakerResult = await analyzeCompany(
            companyName,
            decisionMakerAnalysis.prompt,
            decisionMakerAnalysis.technicalPrompt,
            decisionMakerAnalysis.responseStructure
          );
          analysisResults.push(decisionMakerResult);
        }

        // Parse results
        const companyData = parseCompanyData(analysisResults);

        // Create the company record first
        const createdCompany = await storage.createCompany({
          name: companyName,
          ...companyData
        });

        // Extract contacts with validation options
        const contacts = await extractContacts(
          analysisResults,
          companyName
          // Remove validation options object if it's causing type errors
        );

        // Create contact records with basic information
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
              verificationSource: 'Decision-maker Analysis',
              nameConfidenceScore: contact.nameConfidenceScore ?? null,
              userFeedbackScore: null,
              feedbackCount: 0
            })
          )
        );

        return { ...createdCompany, contacts: createdContacts };
      })
    );

    // Return results immediately to complete the search
    res.json({
      companies,
      query,
    });

    // After sending response, start email enrichment if enabled
    const emailEnrichmentModule = approaches.find(a =>
      a.moduleType === 'email_enrichment' && a.active
    );

    if (emailEnrichmentModule?.active) {
      const searchId = `search_${Date.now()}`;
      console.log('Starting post-search email enrichment with searchId:', searchId);

      // Process each company's contacts for enrichment asynchronously
      for (const company of companies) {
        try {
          const enrichmentResults = await emailEnrichmentService.enrichTopProspects(company.id);
          console.log(`Queued enrichment for ${enrichmentResults.length} contacts in ${company.name}`);
        } catch (error) {
          console.error(`Email enrichment error for ${company.name}:`, error);
        }
      }
    }

  } catch (error) {
    console.error('Company search error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during company search"
    });
  }
});

// Contacts
app.get("/api/companies/:companyId/contacts", async (req, res) => {
  const id = Number(req.params.companyId);
  
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid company ID" });
    return;
  }
  
  const contacts = await storage.listContactsByCompany(id);
  res.json(contacts);
});

app.post("/api/companies/:companyId/enrich-contacts", async (req, res) => {
  try {
    const id = Number(req.params.companyId);
    
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "Invalid company ID" });
      return;
    }
    
    const companyId = id;
    const company = await storage.getCompany(companyId);

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Get the decision-maker analysis approach
    const approaches = await storage.listSearchApproaches();
    const decisionMakerApproach = approaches.find(a =>
      a.name === "Decision-maker Analysis"
    );

    if (!decisionMakerApproach) {
      res.status(400).json({
        message: "Decision-maker analysis approach is not configured"
      });
      return;
    }

    try {
      console.log('Starting decision-maker analysis for company:', company.name);

      // Perform decision-maker analysis with technical prompt
      const analysisResult = await analyzeCompany(
        company.name,
        decisionMakerApproach.prompt,
        decisionMakerApproach.technicalPrompt,
        decisionMakerApproach.responseStructure
      );
      console.log('Decision-maker analysis result:', analysisResult);

      // Extract contacts focusing on core fields only
      const newContacts = await extractContacts([analysisResult]);
      console.log('Extracted contacts:', newContacts);

      // Remove existing contacts
      await storage.deleteContactsByCompany(companyId);

      // Create new contacts with only the essential fields
      // Fix type issues by ensuring we only work with complete Contact objects
      const validContacts = newContacts
        .filter(contact => contact.name && contact.name !== "Unknown")
        .map(contact => ({
          name: contact.name || "",
          role: contact.role || null,
          email: contact.email || null
          // Remove any fields that don't exist in the schema
        }));
      
      console.log('Valid contacts for enrichment:', validContacts);

      const createdContacts = await Promise.all(
        validContacts.map(async (contact) => {
          console.log(`Processing contact enrichment for: ${contact.name}`);

          return storage.createContact({
            companyId,
            name: contact.name,
            role: contact.role,
            email: contact.email,
            // Don't include priority field as it doesn't exist in the schema
            linkedinUrl: null,
            twitterHandle: null,
            phoneNumber: null,
            department: null,
            location: null,
            verificationSource: 'Decision-maker Analysis'
          });
        })
      );

      console.log('Created contacts:', createdContacts);
      res.json(createdContacts);
    } catch (error) {
      console.error('Contact enrichment error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "An unexpected error occurred during contact enrichment"
      });
    }
  } catch (error) {
    console.error('Contact enrichment error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during contact enrichment"
    });
  }
});

// Add new route for getting a single contact
app.get("/api/contacts/:id", async (req, res) => {
  const id = Number(req.params.id);
  
  if (isNaN(id) || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid contact ID" });
    return;
  }
  
  const contact = await storage.getContact(id);
  if (!contact) {
    res.status(404).json({ message: "Contact not found" });
    return;
  }
  res.json(contact);
});

app.post("/api/contacts/search", async (req, res) => {
  const { name, company } = req.body;

  if (!name || !company) {
    res.status(400).json({
      message: "Both name and company are required"
    });
    return;
  }

  try {
    const contactDetails = await searchContactDetails(name, company);

    if (Object.keys(contactDetails).length === 0) {
      res.status(404).json({
        message: "No additional contact details found"
      });
      return;
    }

    res.json(contactDetails);
  } catch (error) {
    console.error('Contact search error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during contact search"
    });
  }
});


// Search Approaches
app.get("/api/search-approaches", async (_req, res) => {
  const approaches = await storage.listSearchApproaches();
  res.json(approaches);
});

app.patch("/api/search-approaches/:id", async (req, res) => {
  const result = insertSearchApproachSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const updated = await storage.updateSearchApproach(
    parseInt(req.params.id),
    result.data
  );

  if (!updated) {
    res.status(404).json({ message: "Search approach not found" });
    return;
  }

  res.json(updated);
});

// Campaigns
app.get("/api/campaigns", async (_req, res) => {
  const campaigns = await storage.listCampaigns();
  res.json(campaigns);
});

app.get("/api/campaigns/:campaignId", async (req, res) => {
  const campaign = await storage.getCampaign(parseInt(req.params.campaignId));
  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }
  res.json(campaign);
});

app.post("/api/campaigns", async (req, res) => {
  try {
    // Get next available campaign ID (starting from 2001)
    const campaignId = await storage.getNextCampaignId();

    const result = insertCampaignSchema.safeParse({
      ...req.body,
      campaignId,
      totalCompanies: 0
    });

    if (!result.success) {
      res.status(400).json({
        message: "Invalid request body",
        errors: result.error.errors
      });
      return;
    }

    // Create the campaign
    const campaign = await storage.createCampaign({
      ...result.data,
      description: result.data.description || null,
      startDate: result.data.startDate || null,
      status: result.data.status || 'draft'
    });

    res.json(campaign);
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred while creating the campaign"
    });
  }
});

app.patch("/api/campaigns/:campaignId", async (req, res) => {
  const result = insertCampaignSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const updated = await storage.updateCampaign(
    parseInt(req.params.campaignId),
    result.data
  );

  if (!updated) {
    res.status(404).json({ message: "Campaign not found" });
    return;
  }

  res.json(updated);
});

// Email Templates
app.get("/api/email-templates", async (_req, res) => {
  const templates = await storage.listEmailTemplates();
  res.json(templates);
});

app.get("/api/email-templates/:id", async (req, res) => {
  const template = await storage.getEmailTemplate(parseInt(req.params.id));
  if (!template) {
    res.status(404).json({ message: "Template not found" });
    return;
  }
  res.json(template);
});

app.post("/api/email-templates", async (req, res) => {
  const result = insertEmailTemplateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Invalid request body" });
    return;
  }

  const template = await storage.createEmailTemplate(result.data);
  res.json(template);
});

// Add new route for email generation
app.post("/api/generate-email", async (req, res) => {
  const { emailPrompt, contact, company } = req.body;

  if (!emailPrompt || !company) {
    res.status(400).json({ message: "Missing required parameters" });
    return;
  }

  try {
    // Construct the prompt for Perplexity
    const messages: PerplexityMessage[] = [
      {
        role: "system",
        content: "You are a professional business email writer. Write personalized, engaging emails that are concise and effective. Focus on building genuine connections while maintaining professionalism."
      },
      {
        role: "user",
        content: `Write a business email based on this context:

Prompt: ${emailPrompt}

Company: ${company.name}
${company.size ? `Size: ${company.size} employees` : ''}
${company.services ? `Services: ${company.services.join(', ')}` : ''}

${contact ? `Recipient: ${contact.name}${contact.role ? ` (${contact.role})` : ''}` : 'No specific recipient selected'}

First, provide a short, engaging subject line prefixed with "Subject: ".
Then, on a new line, write the body of the email. Keep both subject and content concise and professional.`
      }
    ];

    const response = await queryPerplexity(messages);

    // Split response into subject and content
    const parts = response.split('\n').filter(line => line.trim());
    const subjectLine = parts[0].replace(/^Subject:\s*/i, '').trim();
    const content = parts.slice(1).join('\n').trim();

    res.json({
      subject: subjectLine,
      content: content
    });
  } catch (error) {
    console.error('Email generation error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during email generation"
    });
  }
});

// Add new route for enriching a single contact
app.post("/api/contacts/:contactId/enrich", async (req, res) => {
  try {
    const contactId = Number(req.params.contactId);
    if (isNaN(contactId) || !Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ message: "Invalid contact ID" });
    }
    console.log('Starting enrichment for contact:', contactId);

    const contact = await storage.getContact(contactId);
    if (!contact) {
      res.status(404).json({ message: "Contact not found" });
      return;
    }
    console.log('Found contact:', contact);

    const company = await storage.getCompany(contact.companyId);
    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }
    console.log('Found company:', company.name);

    // Search for additional contact details
    console.log('Searching for contact details...');
    const enrichedDetails = await searchContactDetails(contact.name, company.name);
    console.log('Enriched details found:', enrichedDetails);

    // Update contact with enriched information
    const updatedContact = await storage.updateContact(contactId, {
      ...contact,
      email: enrichedDetails.email || contact.email,
      linkedinUrl: enrichedDetails.linkedinUrl || contact.linkedinUrl,
      twitterHandle: enrichedDetails.twitterHandle || contact.twitterHandle,
      phoneNumber: enrichedDetails.phoneNumber || contact.phoneNumber,
      department: enrichedDetails.department || contact.department,
      location: enrichedDetails.location || contact.location,
      completedSearches: [...(contact.completedSearches || []), 'contact_enrichment']
    });
    console.log('Updated contact:', updatedContact);

    res.json(updatedContact);
  } catch (error) {
    console.error('Contact enrichment error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during contact enrichment"
    });
  }
});

app.post("/api/contacts/search", async (req, res) => {
  const { name, company } = req.body;

  if (!name || !company) {
    res.status(400).json({
      message: "Both name and company are required"
    });
    return;
  }

  try {
    const contactDetails = await searchContactDetails(name, company);

    if (Object.keys(contactDetails).length === 0) {
      res.status(404).json({
        message: "No additional contact details found"
      });
      return;
    }

    res.json(contactDetails);
  } catch (error) {
    console.error('Contact search error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "An unexpected error occurred during contact search"
    });
  }
});

app.post("/api/companies/:companyId/enrich-top-prospects", async (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    const searchId = `search_${Date.now()}`;
    const { contactIds } = req.body; // Get the specific contact IDs to enrich

    // Start the enrichment process - fix the parameters to match the actual function signature
    // Assuming startEnrichment only takes a searchId parameter
    const queueId = await postSearchEnrichmentService.startEnrichment(searchId);

    res.json({
      message: "Top prospects enrichment started",
      queueId,
      status: 'processing'
    });
  } catch (error) {
    console.error('Enrichment start error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to start enrichment process"
    });
  }
});

  // Add this route within the registerRoutes function, before the return statement
  app.get("/api/enrichment/:queueId/status", async (req, res) => {
    try {
      const status = postSearchEnrichmentService.getEnrichmentStatus(req.params.queueId);

      if (!status) {
        res.status(404).json({ message: "Enrichment queue not found" });
        return;
      }

      res.json(status);
    } catch (error) {
      console.error('Status check error:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to check enrichment status"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}