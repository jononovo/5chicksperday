import { SearchJobService } from "./search-job-service";

/**
 * Background job processor for async search execution
 * Polls the database for pending jobs and executes them sequentially
 */
export class JobProcessor {
  private processingJobs = new Set<string>();
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private processingInterval = 5000; // Check every 5 seconds

  /**
   * Process the next pending job
   */
  async processNextJob(): Promise<void> {
    // Prevent overlapping processing
    if (this.isProcessing) {
      console.log("[JobProcessor] Already processing, skipping this cycle");
      return;
    }

    this.isProcessing = true;

    try {
      // First, check for stuck jobs (processing for > 5 minutes)
      await this.recoverStuckJobs();
      
      // Get next pending job (highest priority first)
      const pendingJobs = await SearchJobService.getPendingJobs(1);
      
      if (pendingJobs.length === 0) {
        console.log("[JobProcessor] No pending jobs found");
        return;
      }

      const job = pendingJobs[0];
      
      // Check if already being processed
      if (this.processingJobs.has(job.jobId)) {
        console.log(`[JobProcessor] Job ${job.jobId} already being processed, skipping`);
        return;
      }

      console.log(`[JobProcessor] Starting to process job ${job.jobId}`);
      this.processingJobs.add(job.jobId);

      try {
        // Execute the job with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Job execution timeout')), 120000) // 2 minute timeout
        );
        
        await Promise.race([
          SearchJobService.executeJob(job.jobId),
          timeoutPromise
        ]);
        
        console.log(`[JobProcessor] Successfully completed job ${job.jobId}`);
      } catch (error) {
        console.error(`[JobProcessor] Failed to process job ${job.jobId}:`, error);
        // Job will be retried based on retry logic in SearchJobService
      } finally {
        this.processingJobs.delete(job.jobId);
      }
    } catch (error) {
      console.error("[JobProcessor] Error in processNextJob:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Recover jobs stuck in processing state
   */
  async recoverStuckJobs(): Promise<void> {
    try {
      const stuckJobs = await SearchJobService.getStuckProcessingJobs();
      for (const job of stuckJobs) {
        console.warn(`[JobProcessor] Recovering stuck job ${job.jobId} (processing for > 5 minutes)`);
        await SearchJobService.resetJobToPending(job.jobId);
      }
    } catch (error) {
      console.error("[JobProcessor] Error recovering stuck jobs:", error);
    }
  }

  /**
   * Start the job processor
   */
  startProcessing(): void {
    if (this.intervalId) {
      console.log("[JobProcessor] Processor already running");
      return;
    }

    console.log("[JobProcessor] Starting job processor with interval:", this.processingInterval);
    
    // Process immediately on start
    this.processNextJob();
    
    // Then set up interval
    this.intervalId = setInterval(() => {
      this.processNextJob();
    }, this.processingInterval);
  }

  /**
   * Stop the job processor
   */
  stopProcessing(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[JobProcessor] Stopped job processor");
    }
  }

  /**
   * Check if processor is running
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Get currently processing jobs
   */
  getProcessingJobs(): string[] {
    return Array.from(this.processingJobs);
  }
}

// Create singleton instance
export const jobProcessor = new JobProcessor();