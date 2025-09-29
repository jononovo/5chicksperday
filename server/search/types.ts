/**
 * Shared types for search module
 */

import type { Company, Contact } from "@shared/schema";

// Global session storage for search results
export interface SearchSessionResult {
  sessionId: string;
  query: string;
  status: 'pending' | 'companies_found' | 'contacts_complete' | 'failed';
  quickResults?: any[];
  fullResults?: any[];
  error?: string;
  timestamp: number;
  ttl: number;
  emailSearchStatus?: 'none' | 'running' | 'completed';
  emailSearchCompleted?: number;
  jobId?: string;  // Added for job-based search
}

// Contact search configuration from frontend
export interface ContactSearchConfig {
  enableCoreLeadership?: boolean;
  enableDepartmentHeads?: boolean;
  enableMiddleManagement?: boolean;
  enableCustomSearch?: boolean;
  customSearchTarget?: string;
  enableCustomSearch2?: boolean;
  customSearchTarget2?: string;
}

// Company search request
export interface CompanySearchRequest {
  query: string;
  strategyId?: number;
  includeContacts?: boolean;
  contactSearchConfig?: ContactSearchConfig;
  sessionId?: string;
  searchType?: string;
}

// Quick search request
export interface QuickSearchRequest {
  query: string;
  strategyId?: number;
  contactSearchConfig?: ContactSearchConfig;
  sessionId?: string;
  searchType?: string;
}

// Company with contacts
export interface CompanyWithContacts extends Company {
  contacts?: Contact[];
}

// Email orchestration request
export interface EmailOrchestrationRequest {
  companyIds: number[];
  sessionId?: string;
}

// Email orchestration result
export interface EmailOrchestrationResult {
  companyId: number;
  companyName: string;
  emailsFound: number;
  source: string;
}

// Cache entry structure
export interface SearchCacheEntry {
  apiResults: any[];
  companyRecords: Company[];
  timestamp: number;
  ttl: number;
}