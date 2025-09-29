import { storage } from "../../storage";
import { searchCompanies } from "../perplexity/company-search";
import { findKeyDecisionMakers } from "../contacts/finder";
import { CreditService } from "../../features/billing/credits/service";
import type { InsertSearchJob, SearchJob } from "@shared/schema";
import type { ContactSearchConfig } from "../types";

export interface CreateJobParams {
  userId: number;
  query: string;
  searchType: 'companies' | 'contacts' | 'emails' | 'contact-only' | 'email-single';
  contactSearchConfig?: ContactSearchConfig;
  source: 'frontend' | 'api' | 'cron';
  metadata?: Record<string, any>;
  priority?: number;
}

export interface JobProgress {
  phase: string;
  completed: number;
  total: number;
  message?: string;
}

export class SearchJobService {
  /**
   * Create a new search job and save it to database
   */
  static async createJob(params: CreateJobParams): Promise<string> {
    // Map 'contact-only' to 'contacts' for database storage
    const searchType = params.searchType === 'contact-only' ? 'contacts' : params.searchType;
    
    const jobData: InsertSearchJob = {
      userId: params.userId,
      query: params.query,
      searchType: searchType || 'companies',
      contactSearchConfig: params.contactSearchConfig || {},
      source: params.source,
      metadata: {
        ...params.metadata,
        isContactOnly: params.searchType === 'contact-only'  // Store flag in metadata
      },
      priority: params.priority || 0,
      maxRetries: 3
    };

    const job = await storage.createSearchJob(jobData);
    console.log(`[SearchJobService] Created job ${job.jobId} for user ${params.userId}`);
    
    return job.jobId;
  }

  /**
   * Execute a search job (can be called synchronously or by background processor)
   */
  static async executeJob(jobId: string): Promise<void> {
    try {
      // Get the job from database
      const job = await storage.getSearchJobByJobId(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.status !== 'pending') {
        console.log(`[SearchJobService] Job ${jobId} already ${job.status}, skipping`);
        return;
      }

      // Mark job as processing
      await storage.updateSearchJob(job.id, {
        status: 'processing',
        startedAt: new Date(),
        progress: {
          phase: 'Starting search',
          completed: 0,
          total: 5,
          message: 'Initializing search process'
        }
      });

      console.log(`[SearchJobService] Starting execution of job ${jobId}`);

      let savedCompanies = [];
      let contacts: any[] = [];
      
      // Handle different search types
      // Check metadata for contact-only flag (since we store it as 'contacts' in DB)
      const isContactOnly = (job.metadata as any)?.isContactOnly === true;
      if (isContactOnly) {
        // Contact-only search: Use existing companies
        await this.executeContactOnlySearch(job, jobId);
        return;
      }
      
      // Handle bulk email search (Find Key Emails button)
      const isBulkEmailSearch = job.searchType === 'emails' && (job.metadata as any)?.companyIds;
      if (isBulkEmailSearch) {
        // Bulk email search: Use existing companies and enrich with emails
        await this.executeBulkEmailSearch(job, jobId);
        return;
      }
      
      // Handle single email search
      if (job.searchType === 'email-single') {
        await this.executeEmailSearch(job, jobId);
        return;
      }
      
      // Regular flow: Search companies first
      // Phase 1: Search for companies
      const totalPhases = job.searchType === 'emails' ? 6 : 5;
      await this.updateJobProgress(job.id, {
        phase: 'Finding companies',
        completed: 1,
        total: totalPhases,
        message: 'Searching for matching companies'
      });

      const companies = await searchCompanies(job.query);
      console.log(`[SearchJobService] Found ${companies.length} companies for job ${jobId}`);

      // Phase 2: Save companies to database
      await this.updateJobProgress(job.id, {
        phase: 'Saving companies',
        completed: 2,
        total: totalPhases,
        message: `Processing ${companies.length} companies`
      });

      for (const company of companies) {
        const companyData: any = {
          ...company,
          userId: job.userId,
          listId: (job.metadata as any)?.listId || null
        };
        const savedCompany = await storage.createCompany(companyData);
        savedCompanies.push(savedCompany);
      }
      
      // Phase 3: Find contacts if requested
      if (job.searchType === 'contacts' || job.searchType === 'emails') {
        await this.updateJobProgress(job.id, {
          phase: 'Finding contacts',
          completed: 3,
          total: totalPhases,
          message: 'Discovering key decision makers'
        });

        // Use the new ContactSearchService
        const { ContactSearchService } = await import('./contact-search-service');
        
        const contactResults = await ContactSearchService.searchContacts({
          companies: savedCompanies,
          userId: job.userId,
          searchConfig: job.contactSearchConfig as ContactSearchConfig || ContactSearchService.getDefaultConfig(),
          jobId: job.jobId,
          onProgress: async (message: string) => {
            await this.updateJobProgress(job.id, {
              phase: 'Finding contacts',
              completed: 3,
              total: totalPhases,
              message
            });
          }
        });

        // Flatten all contacts from results
        for (const result of contactResults) {
          contacts.push(...result.contacts.map(contact => ({
            ...contact,
            companyName: result.companyName
          })));
        }

        console.log(`[SearchJobService] Found ${contacts.length} contacts for job ${jobId}`);
        
        // Phase 3.5: Find emails for contacts if searchType is 'emails'
        if (job.searchType === 'emails' && contacts.length > 0) {
          console.log(`[SearchJobService] Starting email enrichment for ${contacts.length} contacts`);
          await this.enrichContactsWithEmails(job, contacts, savedCompanies, totalPhases);
        }
      }

      // Phase 4: Deduct credits if applicable
      const creditPhase = job.searchType === 'emails' ? 5 : 4;
      if (job.source !== 'cron' && savedCompanies.length > 0) {
        await this.updateJobProgress(job.id, {
          phase: 'Processing credits',
          completed: creditPhase,
          total: totalPhases,
          message: 'Updating account credits'
        });

        const creditType = job.searchType === 'emails' ? 'email_search' : 
                          job.searchType === 'contacts' ? 'contact_discovery' : 
                          'company_search';
        
        await CreditService.deductCredits(
          job.userId,
          creditType as any,
          true
        );
      }

      // Phase 5: Mark job as completed
      const completedPhase = job.searchType === 'emails' ? 6 : 5;
      await this.updateJobProgress(job.id, {
        phase: 'Completed',
        completed: completedPhase,
        total: totalPhases,
        message: 'Search completed successfully'
      });

      // Nest contacts within their respective companies for frontend compatibility
      const companiesWithContacts = savedCompanies.map(company => {
        const companyContacts = contacts.filter((contact: any) => 
          contact.companyId === company.id
        );
        return {
          ...company,
          contacts: companyContacts
        };
      });

      const results = {
        companies: companiesWithContacts,
        contacts: contacts,  // Keep separate array for backward compatibility
        totalCompanies: savedCompanies.length,
        totalContacts: contacts.length
      };

      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: results,
        resultCount: savedCompanies.length
      });

      console.log(`[SearchJobService] Completed job ${jobId} with ${savedCompanies.length} companies and ${contacts.length} contacts`);

    } catch (error) {
      console.error(`[SearchJobService] Error executing job ${jobId}:`, error);
      
      // Get the job to check retry count
      const job = await storage.getSearchJobByJobId(jobId);
      if (job) {
        const shouldRetry = (job.retryCount || 0) < (job.maxRetries || 3);
        
        await storage.updateSearchJob(job.id, {
          status: shouldRetry ? 'pending' : 'failed',
          error: error instanceof Error ? error.message : String(error),
          retryCount: (job.retryCount || 0) + 1,
          progress: {
            phase: 'Error',
            completed: 0,
            total: 1,
            message: error instanceof Error ? error.message : 'Search failed'
          }
        });

        if (shouldRetry) {
          console.log(`[SearchJobService] Job ${jobId} will be retried (attempt ${(job.retryCount || 0) + 1}/${job.maxRetries || 3})`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute an individual email search for a single contact
   * Used for programmatic triggers (cron, webhooks, etc.)
   */
  private static async executeEmailSearch(job: SearchJob, jobId: string): Promise<void> {
    try {
      console.log(`[SearchJobService] Executing email search for job ${jobId}`);
      
      const contactId = (job.metadata as any)?.contactId;
      if (!contactId) {
        throw new Error('contactId required in metadata for email search');
      }
      
      // Get the contact
      const contact = await storage.getContact(contactId, job.userId);
      if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
      }
      
      // Check if already has email
      if (contact.email && contact.email.includes('@')) {
        console.log(`[SearchJobService] Contact ${contactId} already has email: ${contact.email}`);
        await storage.updateSearchJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          results: {
            contactId,
            email: contact.email,
            source: 'existing',
            message: 'Contact already has email'
          },
          resultCount: 1
        });
        return;
      }
      
      // Get the company
      const company = await storage.getCompany(contact.companyId, job.userId);
      if (!company) {
        throw new Error(`Company ${contact.companyId} not found`);
      }
      
      // Update progress
      await this.updateJobProgress(job.id, {
        phase: 'Searching for email',
        completed: 1,
        total: 3,
        message: `Finding email for ${contact.name}`
      });
      
      // Try providers in waterfall order (same as orchestrator)
      let emailFound = false;
      let source = '';
      let updatedContact = contact;
      
      // Try Apollo first
      const apolloApiKey = process.env.APOLLO_API_KEY;
      if (apolloApiKey && !emailFound) {
        console.log(`[SearchJobService] Trying Apollo for ${contact.name}`);
        const { searchApolloDirect } = await import('../providers/apollo');
        const result = await searchApolloDirect(contact, company, apolloApiKey);
        if (result.success && result.contact.email) {
          updatedContact = result.contact;
          emailFound = true;
          source = 'apollo';
        }
      }
      
      // Try Perplexity if no email yet
      if (!emailFound) {
        console.log(`[SearchJobService] Trying Perplexity for ${contact.name}`);
        const { searchContactDetails } = await import('../enrichment/contact-details');
        const details = await searchContactDetails(contact.name, company.name);
        if (details.email) {
          updatedContact = { ...contact, email: details.email };
          emailFound = true;
          source = 'perplexity';
        }
      }
      
      // Try Hunter as fallback
      const hunterApiKey = process.env.HUNTER_API_KEY;
      if (hunterApiKey && !emailFound) {
        console.log(`[SearchJobService] Trying Hunter for ${contact.name}`);
        const { searchHunterDirect } = await import('../providers/hunter');
        const result = await searchHunterDirect(contact, company, hunterApiKey);
        if (result.success && result.contact.email) {
          updatedContact = result.contact;
          emailFound = true;
          source = 'hunter';
        }
      }
      
      // Update contact if email found
      if (emailFound) {
        await this.updateJobProgress(job.id, {
          phase: 'Updating contact',
          completed: 2,
          total: 3,
          message: `Found email via ${source}`
        });
        
        await storage.updateContact(contactId, { 
          email: updatedContact.email,
          role: updatedContact.role || contact.role
        });
        
        // Deduct credits
        await CreditService.deductCredits(job.userId, 'email_search', true);
      }
      
      // Complete the job
      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: {
          contactId,
          email: emailFound ? updatedContact.email : null,
          source: emailFound ? source : 'not_found',
          message: emailFound ? `Email found via ${source}` : 'No email found'
        },
        resultCount: emailFound ? 1 : 0,
        progress: {
          phase: 'Complete',
          completed: 3,
          total: 3,
          message: emailFound ? 'Email found successfully' : 'No email found'
        }
      });
      
      console.log(`[SearchJobService] Completed email search job ${jobId}: ${emailFound ? 'found' : 'not found'}`);
      
    } catch (error) {
      console.error(`[SearchJobService] Error in email search job ${jobId}:`, error);
      
      await storage.updateSearchJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
        progress: {
          phase: 'Error',
          completed: 0,
          total: 1,
          message: error instanceof Error ? error.message : 'Email search failed'
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Execute bulk email search for existing companies and contacts
   * Used by "Find Key Emails" button to enrich existing contacts with emails
   * Now uses tiered approach for better performance
   */
  private static async executeBulkEmailSearch(job: SearchJob, jobId: string): Promise<void> {
    try {
      console.log(`[SearchJobService] Executing bulk email search for job ${jobId}`);
      
      // Get company IDs from metadata
      const companyIds = (job.metadata as any)?.companyIds || [];
      if (companyIds.length === 0) {
        throw new Error('No company IDs provided for bulk email search');
      }
      
      // Phase 1: Load companies
      await this.updateJobProgress(job.id, {
        phase: 'Loading companies',
        completed: 1,
        total: 5,
        message: `Loading ${companyIds.length} companies`
      });
      
      const companies = await Promise.all(
        companyIds.map((id: number) => storage.getCompany(id, job.userId))
      );
      const validCompanies = companies.filter(c => c);
      
      if (validCompanies.length === 0) {
        throw new Error('No valid companies found');
      }
      
      // Phase 2: Load TOP 3 contacts for each company (by probability score)
      await this.updateJobProgress(job.id, {
        phase: 'Loading contacts',
        completed: 2,
        total: 5,
        message: `Loading top contacts for ${validCompanies.length} companies`
      });
      
      // Build company-to-contacts map for tiered processing
      const companyContactsMap = new Map<number, any[]>();
      let totalContactsToSearch = 0;
      
      for (const company of validCompanies) {
        const contacts = await storage.listContactsByCompany(company.id, job.userId);
        
        // Sort by probability score (higher is better) and take top 3
        const topContacts = contacts
          .sort((a, b) => (b.probability || 0) - (a.probability || 0))
          .slice(0, 3);
        
        if (topContacts.length > 0) {
          companyContactsMap.set(company.id, topContacts);
          totalContactsToSearch += topContacts.length;
        }
        
        console.log(`[SearchJobService] Company ${company.name}: ${contacts.length} total contacts, taking top ${topContacts.length}`);
      }
      
      console.log(`[SearchJobService] Selected ${totalContactsToSearch} top contacts to enrich (from ${validCompanies.length} companies)`);
      
      // Phase 3: Enrich contacts with emails using tiered approach with true parallel processing
      await this.updateJobProgress(job.id, {
        phase: 'Finding emails',
        completed: 3,
        total: 5,
        message: `Enriching ${totalContactsToSearch} contacts with emails using parallel tiered approach`
      });
      
      // Prepare companies with their contacts for batch processing
      const companiesWithContacts = validCompanies
        .map(company => ({
          company,
          contacts: companyContactsMap.get(company.id) || []
        }))
        .filter(item => item.contacts.length > 0);
      
      // Import the batch processing utility
      const { processTieredBatch } = await import('../utils/batch-processing');
      
      // Process all companies concurrently using the tiered batch processor
      // Increased batch size to 10 for better parallelism (was 5)
      const batchResults = await processTieredBatch(
        companiesWithContacts,
        (contacts, company) => this.tieredEmailSearch(contacts, company, job.userId),
        {
          batchSize: 10,  // Process 10 companies simultaneously for better performance
          onProgress: async (completed, total, emailsFound) => {
            await this.updateJobProgress(job.id, {
              phase: 'Finding emails',
              completed: 3,
              total: 5,
              message: `Processed ${completed}/${total} companies (${emailsFound} emails found)`
            });
          }
        }
      );
      
      const totalEmailsFound = batchResults.totalEmailsFound;
      const companiesProcessed = batchResults.companiesProcessed;
      
      if (batchResults.errors.length > 0) {
        console.warn(`[SearchJobService] ${batchResults.errors.length} companies had errors during email search`);
        batchResults.errors.forEach(err => 
          console.warn(`[SearchJobService] Company ${err.companyId} error:`, err.error)
        );
      }
      
      console.log(`[SearchJobService] Email enrichment complete: ${totalEmailsFound}/${totalContactsToSearch} emails found`);
      
      // Phase 4: Deduct credits
      await this.updateJobProgress(job.id, {
        phase: 'Processing credits',
        completed: 4,
        total: 5,
        message: 'Updating account credits'
      });
      
      await CreditService.deductCredits(job.userId, 'email_search', true);
      
      // Phase 5: Complete
      await this.updateJobProgress(job.id, {
        phase: 'Completed',
        completed: 5,
        total: 5,
        message: 'Email search completed successfully'
      });
      
      // Prepare results - fetch ALL contacts for display, not just top 3
      const allContactsForDisplay: any[] = [];
      for (const company of validCompanies) {
        const contacts = await storage.listContactsByCompany(company.id, job.userId);
        allContactsForDisplay.push(...contacts);
      }
      
      const results = {
        companies: validCompanies.map(company => ({
          ...company,
          contacts: allContactsForDisplay.filter(c => c.companyId === company.id)
        })),
        contacts: allContactsForDisplay,
        searchType: 'bulk-email',
        metadata: {
          companiesSearched: validCompanies.length,
          contactsEnriched: totalContactsToSearch,  // Number we actually searched
          totalContacts: allContactsForDisplay.length,  // Total contacts in companies
          emailsFound: allContactsForDisplay.filter(c => c.email).length
        }
      };
      
      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: results,
        resultCount: totalEmailsFound
      });
      
      console.log(`[SearchJobService] Completed bulk email search job ${jobId}: ${results.metadata.emailsFound} emails found`);
      
    } catch (error) {
      console.error(`[SearchJobService] Error in bulk email search:`, error);
      
      await storage.updateSearchJob(job.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
        progress: {
          phase: 'Error',
          completed: 0,
          total: 1,
          message: error instanceof Error ? error.message : 'Bulk email search failed'
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Execute a contact-only search (no company search)
   * Used when companies already exist and we just need contacts
   */
  private static async executeContactOnlySearch(job: SearchJob, jobId: string): Promise<void> {
    try {
      console.log(`[SearchJobService] Executing contact-only search for job ${jobId}`);
      
      // Get company IDs from metadata or search all user's companies
      const companyIds = (job.metadata as any)?.companyIds || [];
      let companies;
      
      if (companyIds.length > 0) {
        // Search specific companies
        companies = await Promise.all(
          companyIds.map((id: number) => storage.getCompany(id, job.userId))
        );
        companies = companies.filter(c => c); // Remove nulls
      } else {
        // Search all user's companies
        companies = await storage.listCompanies(job.userId);
      }
      
      if (!companies || companies.length === 0) {
        // No companies found - mark job as completed with 0 results
        console.log(`[SearchJobService] No companies found for contact search in job ${jobId}`);
        
        await storage.updateSearchJob(job.id, {
          status: 'completed',
          completedAt: new Date(),
          results: {
            companies: [],
            contacts: [],
            searchType: 'contact-only',
            metadata: {
              companiesSearched: 0,
              contactsFound: 0,
              message: 'No companies available for contact search'
            }
          },
          resultCount: 0,
          progress: {
            phase: 'Complete',
            completed: 1,
            total: 1,
            message: 'No companies found to search contacts'
          }
        });
        
        console.log(`[SearchJobService] Completed job ${jobId} with no companies to search`);
        return;
      }
      
      console.log(`[SearchJobService] Searching contacts for ${companies.length} companies`);
      
      // Update progress
      await this.updateJobProgress(job.id, {
        phase: 'Finding contacts',
        completed: 1,
        total: 3,
        message: `Searching contacts for ${companies.length} companies`
      });
      
      // Use the ContactSearchService
      const { ContactSearchService } = await import('./contact-search-service');
      
      const contactResults = await ContactSearchService.searchContacts({
        companies,
        userId: job.userId,
        searchConfig: job.contactSearchConfig as ContactSearchConfig || ContactSearchService.getDefaultConfig(),
        jobId: job.jobId,
        onProgress: async (message: string) => {
          await this.updateJobProgress(job.id, {
            phase: 'Finding contacts',
            completed: 2,
            total: 3,
            message
          });
        }
      });
      
      // Collect all contacts
      const allContacts = [];
      for (const result of contactResults) {
        allContacts.push(...result.contacts.map(contact => ({
          ...contact,
          companyName: result.companyName
        })));
      }
      
      console.log(`[SearchJobService] Found ${allContacts.length} contacts across ${companies.length} companies`);
      
      // Update job as completed
      const results = {
        companies: companies.map(c => ({
          id: c.id,
          name: c.name,
          website: c.website,
          description: c.description
        })),
        contacts: allContacts,
        searchType: 'contact-only',
        metadata: {
          companiesSearched: companies.length,
          contactsFound: allContacts.length,
          config: job.contactSearchConfig
        }
      };
      
      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: results,
        resultCount: allContacts.length,
        progress: {
          phase: 'Complete',
          completed: 3,
          total: 3,
          message: `Found ${allContacts.length} contacts`
        }
      });
      
      console.log(`[SearchJobService] Completed contact-only job ${jobId}`);
      
    } catch (error) {
      console.error(`[SearchJobService] Error in contact-only search:`, error);
      
      // Handle retry logic
      const shouldRetry = (job.retryCount || 0) < (job.maxRetries || 3);
      
      await storage.updateSearchJob(job.id, {
        status: shouldRetry ? 'pending' : 'failed',
        error: error instanceof Error ? error.message : String(error),
        retryCount: (job.retryCount || 0) + 1,
        progress: {
          phase: 'Error',
          completed: 0,
          total: 1,
          message: error instanceof Error ? error.message : 'Contact search failed'
        }
      });
      
      throw error;
    }
  }

  /**
   * Enrich contacts with emails using tiered approach
   * Groups contacts by company and processes them using the tiered search
   * This replaces the old waterfall approach for better performance
   */
  private static async enrichContactsWithEmails(
    job: SearchJob, 
    contacts: any[], 
    companies: any[],
    totalPhases: number
  ): Promise<void> {
    console.log(`[SearchJobService] Starting email enrichment for ${contacts.length} contacts using tiered approach`);
    
    // Group contacts by company for tiered processing
    const contactsByCompany = new Map<number, any[]>();
    contacts.forEach(contact => {
      const companyContacts = contactsByCompany.get(contact.companyId) || [];
      companyContacts.push(contact);
      contactsByCompany.set(contact.companyId, companyContacts);
    });
    
    // Prepare companies with their contacts
    const companiesWithContacts = Array.from(contactsByCompany.entries())
      .map(([companyId, companyContacts]) => {
        const company = companies.find(c => c.id === companyId);
        if (!company) {
          console.warn(`[SearchJobService] Company ${companyId} not found`);
          return null;
        }
        return { company, contacts: companyContacts };
      })
      .filter(item => item !== null) as Array<{ company: any, contacts: any[] }>;
    
    // Import batch processing utility
    const { processTieredBatch } = await import('../utils/batch-processing');
    
    // Process all companies with their contacts using tiered batch processing
    const batchResults = await processTieredBatch(
      companiesWithContacts,
      (contactsToSearch, company) => this.tieredEmailSearch(contactsToSearch, company, job.userId),
      {
        batchSize: 10,  // Process 10 companies concurrently
        onProgress: async (completed, total, emailsFound) => {
          await this.updateJobProgress(job.id, {
            phase: 'Finding emails',
            completed: 4,
            total: totalPhases,
            message: `Processed ${completed}/${total} companies (${emailsFound} emails found)`
          });
        }
      }
    );
    
    // Update contact objects in place with found emails
    for (const contact of contacts) {
      const updatedContact = await storage.getContact(contact.id, job.userId);
      if (updatedContact && updatedContact.email) {
        contact.email = updatedContact.email;
      }
    }
    
    console.log(`[SearchJobService] Email enrichment complete: ${batchResults.totalEmailsFound}/${contacts.length} emails found`);
  }

  /**
   * Try to find email for a single contact using waterfall approach
   * Apollo -> Perplexity -> Hunter (exact same as frontend)
   * DEPRECATED: Use tieredEmailSearch for better performance
   */
  private static async waterfallEmailSearch(
    contact: any, 
    company: any, 
    userId: number
  ): Promise<boolean> {
    // Skip if already has email
    if (contact.email && contact.email.includes('@')) {
      console.log(`[SearchJobService] Contact ${contact.name} already has email: ${contact.email}`);
      return false;
    }
    
    let emailFound = false;
    let source = '';
    
    // 1. Try Apollo first
    const apolloApiKey = process.env.APOLLO_API_KEY;
    if (apolloApiKey && !emailFound) {
      try {
        console.log(`[SearchJobService] Trying Apollo for ${contact.name}`);
        const { searchApolloDirect } = await import('../providers/apollo');
        const result = await searchApolloDirect(contact, company, apolloApiKey);
        if (result.success && result.contact.email) {
          await storage.updateContact(contact.id, { 
            email: result.contact.email,
            role: result.contact.role || contact.role,
            completedSearches: [...(contact.completedSearches || []), 'apollo_search'],
            lastValidated: new Date()
          });
          emailFound = true;
          source = 'apollo';
          console.log(`[SearchJobService] Found email via Apollo: ${result.contact.email}`);
        }
      } catch (error) {
        console.log(`[SearchJobService] Apollo search failed for ${contact.name}:`, error);
      }
    }
    
    // 2. Try Perplexity if no email yet
    if (!emailFound) {
      try {
        console.log(`[SearchJobService] Trying Perplexity for ${contact.name}`);
        const { searchContactDetails } = await import('../enrichment/contact-details');
        const details = await searchContactDetails(contact.name, company.name);
        if (details.email) {
          await storage.updateContact(contact.id, { 
            email: details.email,
            completedSearches: [...(contact.completedSearches || []), 'contact_enrichment'],
            lastValidated: new Date()
          });
          emailFound = true;
          source = 'perplexity';
          console.log(`[SearchJobService] Found email via Perplexity: ${details.email}`);
        }
      } catch (error) {
        console.log(`[SearchJobService] Perplexity search failed for ${contact.name}:`, error);
      }
    }
    
    // 3. Try Hunter as fallback
    const hunterApiKey = process.env.HUNTER_API_KEY;
    if (hunterApiKey && !emailFound) {
      try {
        console.log(`[SearchJobService] Trying Hunter for ${contact.name}`);
        const { searchHunterDirect } = await import('../providers/hunter');
        const result = await searchHunterDirect(contact, company, hunterApiKey);
        if (result.success && result.contact.email) {
          await storage.updateContact(contact.id, { 
            email: result.contact.email,
            role: result.contact.role || contact.role,
            completedSearches: [...(contact.completedSearches || []), 'hunter_search'],
            lastValidated: new Date()
          });
          emailFound = true;
          source = 'hunter';
          console.log(`[SearchJobService] Found email via Hunter: ${result.contact.email}`);
        }
      } catch (error) {
        console.log(`[SearchJobService] Hunter search failed for ${contact.name}:`, error);
      }
    }
    
    // Mark as comprehensive search completed even if no email found
    if (!emailFound) {
      await storage.updateContact(contact.id, {
        completedSearches: [...(contact.completedSearches || []), 'comprehensive_search'],
        lastValidated: new Date()
      });
      console.log(`[SearchJobService] No email found for ${contact.name} after trying all providers`);
    }
    
    return emailFound;
  }

  /**
   * Tiered concurrent email search for top 3 contacts
   * Tier 1: Apollo searches all 3 contacts simultaneously
   * Tier 2: Perplexity (contacts #1, #3) + Hunter (contacts #1, #2) run concurrently
   * @returns Map of contact ID to success status
   */
  private static async tieredEmailSearch(
    contacts: any[],
    company: any,
    userId: number
  ): Promise<Map<number, boolean>> {
    const results = new Map<number, boolean>();
    const startTime = Date.now();
    
    // Take only top 3 contacts
    const topContacts = contacts.slice(0, 3);
    console.log(`[SearchJobService] Starting tiered email search for ${topContacts.length} contacts from ${company.name}`);
    
    // Skip contacts that already have emails
    const contactsToSearch = topContacts.filter(contact => {
      if (contact.email && contact.email.includes('@')) {
        console.log(`[SearchJobService] Contact ${contact.name} already has email: ${contact.email}`);
        results.set(contact.id, false);
        return false;
      }
      return true;
    });
    
    if (contactsToSearch.length === 0) {
      console.log(`[SearchJobService] All contacts already have emails`);
      return results;
    }
    
    // TIER 1: Apollo for all contacts simultaneously
    const apolloApiKey = process.env.APOLLO_API_KEY;
    const tier1Results = new Map<number, any>();
    
    if (apolloApiKey) {
      console.log(`[SearchJobService] TIER 1: Launching Apollo search for ${contactsToSearch.length} contacts`);
      const apolloPromises = contactsToSearch.map(async (contact) => {
        try {
          const { searchApolloDirect } = await import('../providers/apollo');
          const result = await searchApolloDirect(contact, company, apolloApiKey);
          if (result.success && result.contact.email) {
            console.log(`[SearchJobService] Apollo found email for ${contact.name}: ${result.contact.email}`);
            return { contactId: contact.id, result, source: 'apollo' };
          }
        } catch (error) {
          console.log(`[SearchJobService] Apollo failed for ${contact.name}:`, error);
        }
        return { contactId: contact.id, result: null };
      });
      
      const apolloResults = await Promise.allSettled(apolloPromises);
      
      // Process Apollo results and update contacts
      for (const settledResult of apolloResults) {
        if (settledResult.status === 'fulfilled' && settledResult.value.result) {
          const { contactId, result } = settledResult.value;
          const contact = contactsToSearch.find(c => c.id === contactId);
          if (contact && result.contact.email) {
            await storage.updateContact(contactId, {
              email: result.contact.email,
              role: result.contact.role || contact.role,
              completedSearches: [...(contact.completedSearches || []), 'apollo_search'],
              lastValidated: new Date()
            });
            tier1Results.set(contactId, result.contact.email);
            results.set(contactId, true);
          }
        }
      }
      
      console.log(`[SearchJobService] TIER 1 complete: ${tier1Results.size} emails found via Apollo`);
    }
    
    // Determine which contacts still need Tier 2
    const needsTier2 = contactsToSearch.filter(c => !tier1Results.has(c.id));
    
    if (needsTier2.length === 0) {
      console.log(`[SearchJobService] All contacts found in Tier 1, skipping Tier 2`);
      const elapsed = Date.now() - startTime;
      console.log(`[SearchJobService] Tiered search completed in ${elapsed}ms`);
      return results;
    }
    
    // TIER 2: Perplexity + Hunter running concurrently
    console.log(`[SearchJobService] TIER 2: Starting for ${needsTier2.length} remaining contacts`);
    const tier2Promises = [];
    
    // Perplexity: Search contacts #1 and #3 (indices 0 and 2)
    const perplexityContacts = needsTier2.filter((_, index) => {
      const originalIndex = topContacts.findIndex(tc => tc.id === needsTier2[index].id);
      return originalIndex === 0 || originalIndex === 2;
    });
    
    if (perplexityContacts.length > 0) {
      console.log(`[SearchJobService] TIER 2: Perplexity searching for contacts at positions #1 and #3`);
      const perplexityPromises = perplexityContacts.map(async (contact) => {
        try {
          const { searchContactDetails } = await import('../enrichment/contact-details');
          const details = await searchContactDetails(contact.name, company.name);
          if (details.email) {
            console.log(`[SearchJobService] Perplexity found email for ${contact.name}: ${details.email}`);
            return { contactId: contact.id, email: details.email, source: 'perplexity', role: undefined };
          }
        } catch (error) {
          console.log(`[SearchJobService] Perplexity failed for ${contact.name}:`, error);
        }
        return { contactId: contact.id, email: null, role: undefined };
      });
      tier2Promises.push(...perplexityPromises);
    }
    
    // Hunter: Search contacts #1 and #2 (indices 0 and 1)
    const hunterApiKey = process.env.HUNTER_API_KEY;
    const hunterContacts = needsTier2.filter((_, index) => {
      const originalIndex = topContacts.findIndex(tc => tc.id === needsTier2[index].id);
      return originalIndex === 0 || originalIndex === 1;
    });
    
    if (hunterApiKey && hunterContacts.length > 0) {
      console.log(`[SearchJobService] TIER 2: Hunter searching for contacts at positions #1 and #2`);
      const hunterPromises = hunterContacts.map(async (contact) => {
        try {
          const { searchHunterDirect } = await import('../providers/hunter');
          const result = await searchHunterDirect(contact, company, hunterApiKey);
          if (result.success && result.contact.email) {
            console.log(`[SearchJobService] Hunter found email for ${contact.name}: ${result.contact.email}`);
            return { contactId: contact.id, email: result.contact.email, source: 'hunter', role: result.contact.role };
          }
        } catch (error) {
          console.log(`[SearchJobService] Hunter failed for ${contact.name}:`, error);
        }
        return { contactId: contact.id, email: null, role: undefined };
      });
      tier2Promises.push(...hunterPromises);
    }
    
    // Execute all Tier 2 searches concurrently
    const tier2Results = await Promise.allSettled(tier2Promises);
    
    // Process Tier 2 results, preferring Perplexity over Hunter if both find an email
    const contactEmailMap = new Map<number, { email: string, source: string, role?: string }>();
    
    for (const settledResult of tier2Results) {
      if (settledResult.status === 'fulfilled' && settledResult.value.email) {
        const { contactId, email, source, role } = settledResult.value;
        const existing = contactEmailMap.get(contactId);
        
        // Prefer Perplexity results over Hunter
        if (!existing || (existing.source === 'hunter' && source === 'perplexity')) {
          contactEmailMap.set(contactId, { email, source, role: role || undefined });
        }
      }
    }
    
    // Update contacts with Tier 2 results
    const contactEmailEntries = Array.from(contactEmailMap.entries());
    for (const [contactId, emailData] of contactEmailEntries) {
      const contact = needsTier2.find(c => c.id === contactId);
      if (contact) {
        await storage.updateContact(contactId, {
          email: emailData.email,
          role: emailData.role || contact.role,
          completedSearches: [...(contact.completedSearches || []), `${emailData.source}_search`],
          lastValidated: new Date()
        });
        results.set(contactId, true);
      }
    }
    
    console.log(`[SearchJobService] TIER 2 complete: ${contactEmailMap.size} additional emails found`);
    
    // Mark contacts without emails as comprehensively searched
    for (const contact of needsTier2) {
      if (!results.has(contact.id) || !results.get(contact.id)) {
        await storage.updateContact(contact.id, {
          completedSearches: [...(contact.completedSearches || []), 'comprehensive_search'],
          lastValidated: new Date()
        });
        results.set(contact.id, false);
        console.log(`[SearchJobService] No email found for ${contact.name} after all tiers`);
      }
    }
    
    const elapsed = Date.now() - startTime;
    const totalFound = Array.from(results.values()).filter(v => v).length;
    console.log(`[SearchJobService] Tiered search completed in ${elapsed}ms: ${totalFound}/${topContacts.length} emails found`);
    
    return results;
  }

  /**
   * Update job progress
   */
  private static async updateJobProgress(jobId: number, progress: JobProgress): Promise<void> {
    await storage.updateSearchJob(jobId, { progress });
  }

  /**
   * Get job status and results
   */
  static async getJob(jobId: string, userId: number): Promise<SearchJob | null> {
    const job = await storage.getSearchJobByJobId(jobId);
    
    // Verify user owns this job
    if (job && job.userId !== userId) {
      console.warn(`[SearchJobService] User ${userId} tried to access job ${jobId} owned by user ${job.userId}`);
      return null;
    }
    
    return job || null;
  }

  /**
   * List user's recent jobs
   */
  static async listJobs(userId: number, limit: number = 10): Promise<SearchJob[]> {
    return storage.listSearchJobs(userId, limit);
  }

  /**
   * List pending jobs for processing
   */
  static async getPendingJobs(limit: number = 1): Promise<SearchJob[]> {
    return storage.getPendingSearchJobs(limit);
  }

  /**
   * Get jobs stuck in processing state for too long
   */
  static async getStuckProcessingJobs(): Promise<SearchJob[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return storage.getStuckProcessingJobs(fiveMinutesAgo);
  }

  /**
   * Reset a stuck job back to pending state
   */
  static async resetJobToPending(jobId: string): Promise<void> {
    const job = await storage.getSearchJobByJobId(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    if (job.status !== 'processing') {
      console.log(`[SearchJobService] Job ${jobId} is not stuck (status: ${job.status})`);
      return;
    }
    
    // Reset to pending with incremented retry count
    await storage.updateSearchJob(job.id, {
      status: 'pending',
      startedAt: null,
      progress: null,
      retryCount: (job.retryCount || 0) + 1
    });
    
    console.log(`[SearchJobService] Reset stuck job ${jobId} to pending (retry ${(job.retryCount || 0) + 1})`);
  }

  /**
   * Cancel a pending job
   */
  static async cancelJob(jobId: string): Promise<void> {
    const job = await storage.getSearchJobByJobId(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    if (job.status !== 'pending') {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }
    
    await storage.updateSearchJob(job.id, {
      status: 'failed',
      error: 'Job cancelled by user',
      completedAt: new Date()
    });
    
    console.log(`[SearchJobService] Cancelled job ${jobId}`);
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanupOldJobs(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const deleted = await storage.deleteOldSearchJobs(cutoffDate);
    console.log(`[SearchJobService] Cleaned up ${deleted} old search jobs`);
    
    return deleted;
  }

  /**
   * Get failed jobs that can be retried
   */
  static async getFailedJobsForRetry(): Promise<SearchJob[]> {
    return storage.getFailedJobsForRetry();
  }

  /**
   * Retry a failed job
   */
  static async retryJob(jobId: string): Promise<void> {
    const job = await storage.getSearchJobByJobId(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    await storage.updateSearchJob(job.id, {
      status: 'pending',
      retryCount: (job.retryCount || 0) + 1,
      error: null,
      progress: {
        phase: 'Retrying',
        completed: 0,
        total: 1,
        message: `Retrying attempt ${(job.retryCount || 0) + 1}`
      }
    });
    
    console.log(`[SearchJobService] Job ${jobId} marked for retry (attempt ${(job.retryCount || 0) + 1})`);
  }

  /**
   * Update job status directly
   */
  static async updateJobStatus(
    jobId: string, 
    status: string, 
    results?: any, 
    error?: string
  ): Promise<void> {
    const job = await storage.getSearchJobByJobId(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    
    await storage.updateSearchJob(job.id, {
      status,
      results,
      error,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
    });
  }

  /**
   * Delete old jobs (wrapper for cleanupOldJobs for consistency with cron examples)
   */
  static async deleteOldJobs(cutoffDate: Date): Promise<number> {
    const deleted = await storage.deleteOldSearchJobs(cutoffDate);
    console.log(`[SearchJobService] Deleted ${deleted} jobs older than ${cutoffDate.toISOString()}`);
    return deleted;
  }
}