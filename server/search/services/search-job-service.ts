import { storage } from "../../storage";
import { searchCompanies, discoverCompanies, enrichCompanyDetails } from "../perplexity/company-search";
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
      
      // Regular flow: Fast company discovery with parallel enrichment
      // Phase 1: Fast company discovery (just names & websites)
      const totalPhases = job.searchType === 'emails' ? 7 : 6;
      await this.updateJobProgress(job.id, {
        phase: 'Finding companies',
        completed: 1,
        total: totalPhases,
        message: 'Discovering matching companies'
      });

      const discoveredCompanies = await discoverCompanies(job.query);
      console.log(`[SearchJobService] Discovered ${discoveredCompanies.length} companies for job ${jobId}`);

      // Phase 2: Save companies immediately for fast display
      await this.updateJobProgress(job.id, {
        phase: 'Saving companies',
        completed: 2,
        total: totalPhases,
        message: `Processing ${discoveredCompanies.length} companies`
      });

      for (const company of discoveredCompanies) {
        const companyData: any = {
          ...company,
          description: null, // Will be enriched later
          userId: job.userId,
          listId: (job.metadata as any)?.listId || null
        };
        const savedCompany = await storage.createCompany(companyData);
        savedCompanies.push(savedCompany);
      }
      
      // Save companies to job results immediately (5-7 seconds from start)
      const companiesOnlyResults = {
        companies: savedCompanies.map(company => ({ ...company, contacts: [] })),
        contacts: [],
        totalCompanies: savedCompanies.length,
        totalContacts: 0
      };
      
      await storage.updateSearchJob(job.id, {
        results: companiesOnlyResults
      });
      
      console.log(`[SearchJobService] Saved ${savedCompanies.length} companies for immediate display`);
      
      // Phase 3: Parallel enrichment and contact discovery
      if (job.searchType === 'contacts' || job.searchType === 'emails') {
        await this.updateJobProgress(job.id, {
          phase: 'Enriching data',
          completed: 3,
          total: totalPhases,
          message: 'Enriching companies and finding contacts in parallel'
        });

        // Prepare parallel tasks
        const parallelTasks: Promise<any>[] = [];
        
        // Task 1: Enrich company descriptions
        const enrichmentTask = enrichCompanyDetails(discoveredCompanies).catch(error => {
          console.error(`[SearchJobService] Company enrichment failed:`, error);
          return []; // Return empty array on failure
        });
        parallelTasks.push(enrichmentTask);
        
        // Task 2: Find contacts
        const { ContactSearchService } = await import('./contact-search-service');
        const contactTask = ContactSearchService.searchContacts({
          companies: savedCompanies,
          userId: job.userId,
          searchConfig: job.contactSearchConfig as ContactSearchConfig || ContactSearchService.getDefaultConfig(),
          jobId: job.jobId,
          onProgress: async (message: string) => {
            // Update progress to show contact search status
            await this.updateJobProgress(job.id, {
              phase: 'Finding contacts',
              completed: 3,
              total: totalPhases,
              message
            });
          }
        }).catch(error => {
          console.error(`[SearchJobService] Contact search failed:`, error);
          return []; // Return empty array on failure
        });
        parallelTasks.push(contactTask);
        
        // Execute both tasks in parallel
        console.log(`[SearchJobService] Starting parallel enrichment and contact search`);
        const [enrichedDescriptions, contactResults] = await Promise.all(parallelTasks);
        
        // Update companies with enriched descriptions
        if (enrichedDescriptions && enrichedDescriptions.length > 0) {
          for (const enrichedCompany of enrichedDescriptions) {
            const savedCompany = savedCompanies.find(c => c.name === enrichedCompany.name);
            if (savedCompany && enrichedCompany.description) {
              savedCompany.description = enrichedCompany.description;
              // Update in database
              await storage.updateCompany(savedCompany.id, { description: enrichedCompany.description });
            }
          }
          console.log(`[SearchJobService] Enriched ${enrichedDescriptions.length} company descriptions`);
        }
        
        // Process contact results
        if (contactResults && contactResults.length > 0) {
          for (const result of contactResults) {
            contacts.push(...result.contacts.map((contact: any) => ({
              ...contact,
              companyId: result.companyId,  // CRITICAL: Include companyId for filtering
              companyName: result.companyName
            })));
          }
          console.log(`[SearchJobService] Found ${contacts.length} contacts`);
        }
        
        // Update results with enriched companies and contacts
        const companiesWithContactsResults = {
          companies: savedCompanies.map(company => {
            const companyContacts = contacts.filter((contact: any) => 
              contact.companyId === company.id
            );
            return {
              ...company,
              contacts: companyContacts
            };
          }),
          contacts: contacts,
          totalCompanies: savedCompanies.length,
          totalContacts: contacts.length
        };
        
        await storage.updateSearchJob(job.id, {
          results: companiesWithContactsResults
        });
        
        console.log(`[SearchJobService] Updated job with enriched data and ${contacts.length} contacts`);
        
        // Phase 4: Find emails for contacts if searchType is 'emails'
        if (job.searchType === 'emails' && contacts.length > 0) {
          await this.updateJobProgress(job.id, {
            phase: 'Finding emails',
            completed: 4,
            total: totalPhases,
            message: `Discovering email addresses for ${contacts.length} contacts`
          });
          console.log(`[SearchJobService] Starting email enrichment for ${contacts.length} contacts`);
          await this.enrichContactsWithEmails(job, contacts, savedCompanies, totalPhases);
        }
      }

      // Phase 5: Deduct credits if applicable
      const creditPhase = job.searchType === 'emails' ? 6 : 5;
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

      // Phase 6: Mark job as completed
      const completedPhase = job.searchType === 'emails' ? 7 : 6;
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
      
      const allContacts: any[] = [];
      for (const company of validCompanies) {
        const contacts = await storage.listContactsByCompany(company.id, job.userId);
        
        // Sort by probability score (higher is better) and take top 3
        const topContacts = contacts
          .sort((a, b) => (b.probability || 0) - (a.probability || 0))
          .slice(0, 3);
        
        console.log(`[SearchJobService] Company ${company.name}: ${contacts.length} total contacts, taking top ${topContacts.length}`);
        allContacts.push(...topContacts);
      }
      
      console.log(`[SearchJobService] Selected ${allContacts.length} top contacts to enrich (from ${validCompanies.length} companies)`);
      
      // Phase 3: Enrich contacts with emails
      await this.updateJobProgress(job.id, {
        phase: 'Finding emails',
        completed: 3,
        total: 5,
        message: `Enriching ${allContacts.length} contacts with emails`
      });
      
      await this.enrichContactsWithEmails(job, allContacts, validCompanies, 5);
      
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
          contactsEnriched: allContacts.length,  // Number we actually searched
          totalContacts: allContactsForDisplay.length,  // Total contacts in companies
          emailsFound: allContactsForDisplay.filter(c => c.email).length
        }
      };
      
      await storage.updateSearchJob(job.id, {
        status: 'completed',
        completedAt: new Date(),
        results: results,
        resultCount: allContacts.filter(c => c.email).length
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
   * Enrich contacts with emails using parallel tiered approach
   * Processes contacts by company for optimized parallel searching
   */
  private static async enrichContactsWithEmails(
    job: SearchJob, 
    contacts: any[], 
    companies: any[],
    totalPhases: number
  ): Promise<void> {
    const { parallelTieredEmailSearch } = await import('./parallel-email-search');
    const { processBatch } = await import('../utils/batch-processor');
    
    let totalEmailsFound = 0;
    let companiesProcessed = 0;
    const totalCompanies = companies.length;
    
    console.log(`[SearchJobService] Starting parallel email enrichment for ${contacts.length} contacts across ${totalCompanies} companies`);
    
    // Group contacts by company
    const contactsByCompany = new Map<number, any[]>();
    for (const contact of contacts) {
      const companyContacts = contactsByCompany.get(contact.companyId) || [];
      companyContacts.push(contact);
      contactsByCompany.set(contact.companyId, companyContacts);
    }
    
    // Process companies in larger batches for true parallel execution
    const COMPANY_BATCH_SIZE = 15; // Increased from 5 for better parallelism
    
    // Use the batch processor utility with progress callback
    const batchResults = await processBatch(
      companies,
      async (company) => {
        const companyContacts = contactsByCompany.get(company.id) || [];
        if (companyContacts.length === 0) {
          console.log(`[SearchJobService] No contacts for company ${company.name}, skipping`);
          return { company: company.name, emailsFound: 0 };
        }
        
        // Execute parallel tiered search for this company's contacts
        const results = await parallelTieredEmailSearch(companyContacts, company, job.userId);
        
        // Update contact objects in place with found emails
        for (const result of results) {
          if (result.email) {
            const contact = companyContacts.find(c => c.id === result.contactId);
            if (contact) {
              contact.email = result.email;
            }
          }
        }
        
        const emailsFound = results.filter(r => r.email && r.source !== 'existing').length;
        return { company: company.name, emailsFound };
      },
      COMPANY_BATCH_SIZE,
      async (batchResults, batchIndex) => {
        // Process batch results and update progress in real-time
        const batchStartTime = Date.now();
        
        for (const result of batchResults) {
          companiesProcessed++;
          if (result.status === 'fulfilled') {
            totalEmailsFound += result.value.emailsFound;
            console.log(`[SearchJobService] Company "${result.value.company}": ${result.value.emailsFound} emails found`);
          } else {
            console.error(`[SearchJobService] Company batch error:`, result.reason);
          }
        }
        
        // Update progress after each batch
        await this.updateJobProgress(job.id, {
          phase: 'Finding emails',
          completed: 4,
          total: totalPhases,
          message: `Finding emails: ${companiesProcessed}/${totalCompanies} companies processed (${totalEmailsFound} emails found)`
        });
        
        // Update job results with current email data for progressive display
        const companiesWithCurrentEmails = companies.map(company => {
          const companyContacts = contacts.filter((contact: any) => 
            contact.companyId === company.id
          );
          return {
            ...company,
            contacts: companyContacts
          };
        });
        
        await storage.updateSearchJob(job.id, {
          results: {
            companies: companiesWithCurrentEmails,
            contacts: contacts,
            totalCompanies: companies.length,
            totalContacts: contacts.length
          }
        });
        
        console.log(`[SearchJobService] Batch ${batchIndex + 1} complete in ${Date.now() - batchStartTime}ms - ${companiesProcessed}/${totalCompanies} companies processed`);
      }
    );
    
    console.log(`[SearchJobService] Email enrichment complete: ${totalEmailsFound} emails found across ${totalCompanies} companies`);
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