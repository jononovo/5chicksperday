/**
 * Email Search Orchestrator Module
 * 
 * All search operations now go through the unified job queue system
 * This module is kept for backward compatibility but all endpoints have been migrated
 */

import { Express } from "express";

export function registerOrchestratorRoutes(app: Express, requireAuth: any) {
  // All search endpoints have been migrated to use the job queue system
  // See server/search/routes/search-jobs.ts for the new unified implementation
}