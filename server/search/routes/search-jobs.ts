import { Express, Request, Response } from "express";
import { SearchJobService } from "../services/search-job-service";
import { getUserId } from "../../utils/auth";

/**
 * Register search job API endpoints
 */
export function registerSearchJobRoutes(app: Express) {
  /**
   * Create an email search job for a single contact
   */
  app.post("/api/contacts/:contactId/find-email-job", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const contactId = parseInt(req.params.contactId);
      const { priority = 0, executeImmediately = false } = req.body;

      if (!contactId || isNaN(contactId)) {
        res.status(400).json({
          error: "Invalid contact ID"
        });
        return;
      }

      // Create the job for email search
      const jobId = await SearchJobService.createJob({
        userId,
        query: `email-search-${contactId}`, // Query is just for identification
        searchType: 'email-single',
        source: 'frontend',
        metadata: { 
          contactId 
        },
        priority
      });

      console.log(`[SearchJobRoutes] Created email search job ${jobId} for contact ${contactId}`);

      // Option to execute immediately (for testing) or let processor handle it
      if (executeImmediately) {
        console.log(`[SearchJobRoutes] Executing email job ${jobId} immediately`);
        try {
          await SearchJobService.executeJob(jobId);
        } catch (error) {
          console.error(`[SearchJobRoutes] Error executing email job ${jobId}:`, error);
          // Job will be retried by processor if it failed
        }
      }

      res.json({ 
        jobId,
        contactId,
        message: executeImmediately ? "Email search started" : "Email search queued"
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error creating email search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create email search job"
      });
    }
  });

  /**
   * Create a new search job
   */
  app.post("/api/search-jobs", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { query, searchType = 'companies', contactSearchConfig, metadata, priority = 0, executeImmediately = false } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: "Invalid request: query must be a non-empty string"
        });
        return;
      }

      // Create the job
      const jobId = await SearchJobService.createJob({
        userId,
        query,
        searchType,
        contactSearchConfig,
        source: 'frontend',
        metadata: metadata || {},
        priority
      });

      console.log(`[SearchJobRoutes] Created job ${jobId} for user ${userId}`);

      // Option to execute immediately (synchronous) or let processor handle it (async)
      if (executeImmediately) {
        console.log(`[SearchJobRoutes] Executing job ${jobId} immediately`);
        try {
          await SearchJobService.executeJob(jobId);
        } catch (error) {
          console.error(`[SearchJobRoutes] Error executing job ${jobId}:`, error);
          // Job will be retried by processor if it failed
        }
      }

      res.json({ 
        jobId,
        message: executeImmediately ? "Job created and processing" : "Job created and queued for processing"
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error creating search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create search job"
      });
    }
  });

  /**
   * Get job status and results
   */
  app.get("/api/search-jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { jobId } = req.params;

      const job = await SearchJobService.getJob(jobId, userId);
      
      if (!job) {
        res.status(404).json({
          error: "Job not found"
        });
        return;
      }

      res.json({
        jobId: job.jobId,
        query: job.query,
        searchType: job.searchType,
        status: job.status,
        progress: job.progress,
        results: job.results,
        resultCount: job.resultCount,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error getting search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to get search job"
      });
    }
  });

  /**
   * List user's recent jobs
   */
  app.get("/api/search-jobs", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 10;

      const jobs = await SearchJobService.listJobs(userId, limit);

      res.json({
        jobs: jobs.map(job => ({
          jobId: job.jobId,
          query: job.query,
          searchType: job.searchType,
          status: job.status,
          progress: job.progress,
          resultCount: job.resultCount,
          error: job.error,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        })),
        total: jobs.length
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error listing search jobs:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list search jobs"
      });
    }
  });

  /**
   * Cancel a pending job (mark as failed)
   */
  app.delete("/api/search-jobs/:jobId", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { jobId } = req.params;

      const job = await SearchJobService.getJob(jobId, userId);
      
      if (!job) {
        res.status(404).json({
          error: "Job not found"
        });
        return;
      }

      if (job.status !== 'pending') {
        res.status(400).json({
          error: `Cannot cancel job with status: ${job.status}`
        });
        return;
      }

      // Mark job as failed/cancelled
      await SearchJobService.cancelJob(jobId);

      res.json({
        message: "Job cancelled successfully"
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error cancelling search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to cancel search job"
      });
    }
  });

  /**
   * Create a contact-only search job (search contacts for existing companies)
   */
  app.post("/api/search-jobs/contacts", async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { 
        companyIds,  // Optional: specific company IDs to search
        contactSearchConfig,  // Contact search configuration
        metadata,
        priority = 3,
        executeImmediately = false 
      } = req.body;

      // Create contact-only job
      const jobId = await SearchJobService.createJob({
        userId,
        query: companyIds?.length > 0 
          ? `Contact search for ${companyIds.length} companies`
          : `Contact search for all companies`,
        searchType: 'contact-only',  // Special type for contact-only searches
        contactSearchConfig: contactSearchConfig || {
          enableCoreLeadership: true,
          enableDepartmentHeads: false,
          enableMiddleManagement: false,
          enableCustomSearch: false,
          enableCustomSearch2: false
        },
        source: 'frontend',
        metadata: {
          ...metadata,
          companyIds: companyIds || []
        },
        priority
      });

      console.log(`[SearchJobRoutes] Created contact-only job ${jobId} for user ${userId}`);

      // Option to execute immediately (synchronous) or let processor handle it (async)
      if (executeImmediately) {
        console.log(`[SearchJobRoutes] Executing contact job ${jobId} immediately`);
        try {
          await SearchJobService.executeJob(jobId);
        } catch (error) {
          console.error(`[SearchJobRoutes] Error executing contact job ${jobId}:`, error);
        }
      }

      res.json({ 
        jobId,
        message: executeImmediately 
          ? "Contact search job created and processing" 
          : "Contact search job created and queued for processing"
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error creating contact search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create contact search job"
      });
    }
  });

  /**
   * Create a programmatic search job (for API/cron usage)
   */
  app.post("/api/search-jobs/programmatic", async (req: Request, res: Response) => {
    try {
      // This endpoint could use API key authentication instead of user session
      // For now, we'll use the existing auth but mark source as 'api'
      const userId = getUserId(req);
      const { query, searchType = 'companies', contactSearchConfig, metadata, priority = 5 } = req.body;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          error: "Invalid request: query must be a non-empty string"
        });
        return;
      }

      // Create high-priority job for programmatic access
      const jobId = await SearchJobService.createJob({
        userId,
        query,
        searchType,
        contactSearchConfig,
        source: 'api',
        metadata: metadata || {},
        priority // Higher priority for programmatic jobs
      });

      console.log(`[SearchJobRoutes] Created programmatic job ${jobId} for user ${userId}`);

      // Always execute programmatic jobs immediately
      await SearchJobService.executeJob(jobId);

      // Get the completed job
      const completedJob = await SearchJobService.getJob(jobId, userId);

      res.json({ 
        jobId,
        status: completedJob?.status,
        results: completedJob?.results,
        message: "Programmatic job executed successfully"
      });

    } catch (error) {
      console.error("[SearchJobRoutes] Error creating programmatic search job:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create programmatic search job"
      });
    }
  });

  console.log("[SearchJobRoutes] Search job routes registered");
}