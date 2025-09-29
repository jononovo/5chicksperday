import express, { type Express } from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { searchCompanies } from "./search/perplexity/company-search";
// import { extractContacts } from "./lib/perplexity"; // File doesn't exist
// import { parseCompanyData } from "./lib/results-analysis/company-parser"; // File doesn't exist
import { queryPerplexity } from "./search/perplexity/perplexity-client";
import { queryOpenAI, generateEmailStrategy, generateBoundary, generateBoundaryOptions, generateSprintPrompt, generateDailyQueries, type PerplexityMessage } from "./ai-services";
// import { searchContactDetails } from "./search/enrichment/contact-details"; // File doesn't exist - TSX runtime cached
import { 
  insertCompanySchema, 
  insertContactSchema, 
  insertListSchema, 
  insertEmailTemplateSchema
} from "@shared/schema";
 
// import type { PerplexityMessage } from "./lib/perplexity"; // File doesn't exist
import type { Contact } from "@shared/schema";
// import { postSearchEnrichmentService } from "./search/enrichment/post-search/post-search-enrichment/service"; // File doesn't exist
import { TokenService } from "./features/billing/tokens/service";
import { registerBillingRoutes } from "./features/billing/routes";
import { CreditService } from "./features/billing/credits/service";
import { SearchType } from "./features/billing/credits/types";
import { getEmailProvider } from "./gmail-api-service";
import { registerEmailGenerationRoutes } from "./email-content-generation/routes";
import { registerGmailRoutes } from "./gmail-api-service";
import { registerHealthMonitoringRoutes } from "./features/health-monitoring";
import { registerListsRoutes } from "./features/lists";
import { registerEmailTemplatesRoutes } from "./email/email-templates";
import { registerSearchRoutes, SessionManager } from "./search";
import { registerSitemapRoutes } from "./features/sitemap";
import { registerSearchJobRoutes } from "./search/routes/search-jobs";
import { jobProcessor } from "./search/services/job-processor";

// Import inactive module registration functions


import { registerEmailRepliesRoutes } from "./email-replies";
import { registerHtmlStaticChatRoutes } from "./user-chatbox/html-static";
import { registerReactChatRoutes } from "./user-chatbox/react";
import { registerUserAccountSettingsRoutes } from "./user-account-settings";
import { dailyOutreachRoutes } from "./features/daily-outreach";
import { registerCampaignsRoutes } from "./features/campaigns";
import { registerAdminRoutes } from "./features/admin/routes";


// Import centralized auth utilities
import { getUserId, requireAuth } from "./utils/auth";

// Helper functions for improved search test scoring and AI agent support
function normalizeScore(score: number): number {
  return Math.min(Math.max(Math.round(score), 30), 100);
}

function calculateAverage(scores: number[]): number {
  if (!scores || scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function calculateImprovement(results: any[]): string | null {
  if (!results || results.length < 2) return null;
  
  // Sort by date (newest first)
  const sortedResults = [...results].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Calculate improvement percentage between most recent and oldest
  const latest = sortedResults[0].overallScore;
  const oldest = sortedResults[sortedResults.length - 1].overallScore;
  
  const percentChange = ((latest - oldest) / oldest) * 100;
  
  if (percentChange > 0) {
    return `+${percentChange.toFixed(1)}%`;
  } else if (percentChange < 0) {
    return `${percentChange.toFixed(1)}%`;
  } else {
    return "No change";
  }
}



export function registerRoutes(app: Express) {
  // Register modular search routes (sessions and companies)
  registerSearchRoutes(app, requireAuth);
  
  // Register search job routes for persistent search execution
  registerSearchJobRoutes(app);
  
  // Start the background job processor
  jobProcessor.startProcessing();
  console.log("[Server] Background job processor started");
  
  // Register campaigns module (includes sender profiles, customer profiles, and products)
  registerCampaignsRoutes(app, requireAuth);

  // Serve static files from the static directory
  app.use('/static', express.static(path.join(__dirname, '../static')));
  
  // Serve the static landing page at root route
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/landing.html'));
  });
  
  // Serve the static pricing page
  app.get('/pricing', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/pricing/index.html'));
  });
  
  // Serve the static contact page
  app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/contact.html'));
  });
  
  // Serve the static privacy page
  app.get('/privacy.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/privacy.html'));
  });
  



  // Leave the search approaches endpoints without auth since they are system-wide

  // Register modular email generation routes
  registerEmailGenerationRoutes(app, requireAuth);
  
  // Register modular Gmail integration routes
  registerGmailRoutes(app, requireAuth);
  
  // Register modular health monitoring routes
  registerHealthMonitoringRoutes(app);
  
  // Register admin routes (protected by requireAdmin middleware)
  registerAdminRoutes(app);
  
  // Register modular lists management routes
  registerListsRoutes(app, requireAuth);
  
  // Register modular email templates routes
  registerEmailTemplatesRoutes(app, requireAuth);
  
  // Register modular sitemap routes
  registerSitemapRoutes(app);
  
  // Register daily outreach routes
  // Note: Auth is handled selectively inside the router - token-based endpoints don't need auth
  app.use('/api/daily-outreach', dailyOutreachRoutes);

  // Register campaigns module (includes sender profiles, customer profiles, and products)
  registerCampaignsRoutes(app, requireAuth);
  
  // Register dormant modules that were created but never activated
  registerEmailRepliesRoutes(app, requireAuth);
  registerHtmlStaticChatRoutes(app); // No requireAuth needed - serves public landing page
  registerReactChatRoutes(app, requireAuth);
  registerUserAccountSettingsRoutes(app, requireAuth);


  // Strategy Processing Endpoint for Cold Email Outreach
  app.post("/api/onboarding/process-strategy", async (req, res) => {
    try {
      const { businessType, formData } = req.body;

      if (!businessType || !formData || !formData.targetDescription) {
        res.status(400).json({ message: "Missing required parameters" });
        return;
      }

      console.log(`Processing strategy for ${businessType}:`, formData);

      // Construct strategy processing prompt for Perplexity API
      const strategyPrompt = `Analyze this ${businessType} business profile and target market description to create a cold email outreach strategy:

**Business Profile:**
Product/Service: ${formData.productService}
Customer Feedback: ${formData.customerFeedback}
Website: ${formData.website || 'Not provided'}
Target Market Description: ${formData.targetDescription}

**Required Analysis:**
Extract and provide the following strategy components for cold email outreach:

1. **Strategy High-Level Boundary** - A precise target market definition (e.g., "3-4 star family-friendly hotels in coastal towns in southeast US")

2. **Example Sprint Planning Prompt** - A medium-level search prompt for weekly planning (e.g., "family-friendly hotels on space coast, florida")

3. **Example Daily Search Query** - A specific daily search query for finding 15-20 contacts (e.g., "family-friendly hotels in cocoa beach")

4. **Sales Context Guidance** - Strategic advice for cold email approach specific to this target market

5. **Sales Targeting Guidance** - Specific recommendations for identifying and reaching decision makers in this market

Respond in this exact JSON format:
{
  "strategyHighLevelBoundary": "precise target market definition",
  "exampleSprintPlanningPrompt": "medium-level search prompt",
  "exampleDailySearchQuery": "specific daily search query",
  "reportSalesContextGuidance": "strategic cold email advice",
  "reportSalesTargetingGuidance": "decision maker targeting recommendations"
}`;

      const strategyMessages: PerplexityMessage[] = [
        {
          role: "system",
          content: "You are a cold email outreach strategist. Analyze business profiles and create precise targeting strategies for B2B cold email campaigns. Always respond with valid JSON in the exact format requested."
        },
        {
          role: "user", 
          content: strategyPrompt
        }
      ];

      // Get strategy analysis from Perplexity
      const strategyResponse = await queryPerplexity(strategyMessages);

      // Parse JSON response
      let strategyData;
      try {
        // Extract JSON from response if it contains other text
        const jsonMatch = strategyResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : strategyResponse;
        strategyData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("Failed to parse strategy JSON:", parseError);
        // Fallback to basic strategy data
        strategyData = {
          strategyHighLevelBoundary: formData.targetDescription,
          exampleSprintPlanningPrompt: `${formData.targetDescription} in specific regions`,
          exampleDailySearchQuery: `${formData.targetDescription} in [city name]`,
          reportSalesContextGuidance: `Focus on cold email outreach to ${formData.targetDescription} emphasizing ${formData.customerFeedback}`,
          reportSalesTargetingGuidance: `Target decision makers at ${formData.targetDescription} using ${formData.primarySalesChannel} insights`
        };
      }

      console.log('Strategy processing completed successfully');

      res.json(strategyData);

    } catch (error) {
      console.error("Strategy processing error:", error);
      res.status(500).json({
        message: "Failed to process strategy",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // All N8N Workflow Management Endpoints and proxies have been removed

  // Gamification routes have been moved to billing module

  // User Profile API endpoints

  // Sender and Customer Profiles Routes are registered via their modules

  // Register all billing-related routes (credits, Stripe, gamification)
  registerBillingRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}