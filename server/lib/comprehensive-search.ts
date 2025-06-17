import { storage } from "../storage";
import { searchCompanies } from "./search-logic";
import { findKeyDecisionMakers } from "./search-logic/contact-discovery/enhanced-contact-finder";
import { emailEnrichmentService } from "./search-logic/email-enrichment/service";
import type { InsertSearchJob } from "@shared/schema";

/**
 * Comprehensive search orchestrator that runs the entire pipeline
 * Companies -> Contacts -> Emails in background
 */
export class ComprehensiveSearchOrchestrator {
  private static runningJobs = new Set<string>();

  /**
   * Start a comprehensive search job
   */
  static async startSearch(jobId: string, query: string, userId: number): Promise<void> {
    if (this.runningJobs.has(jobId)) {
      console.log(`Search job ${jobId} already running`);
      return;
    }

    this.runningJobs.add(jobId);
    console.log(`Starting comprehensive search job: ${jobId}`);

    try {
      // Update job status to processing
      await storage.updateSearchJob(jobId, {
        status: 'processing',
        progress: 'companies'
      });

      // Phase 1: Find companies
      console.log(`[${jobId}] Phase 1: Finding companies for query: ${query}`);
      const companiesResult = await searchCompanies(query);
      
      const companies = companiesResult || [];
      console.log(`[${jobId}] Found ${companies.length} companies`);

      await storage.updateSearchJob(jobId, {
        companiesFound: companies.length,
        progress: 'contacts'
      });

      if (companies.length === 0) {
        await storage.updateSearchJob(jobId, {
          status: 'completed',
          progress: 'completed',
          completedAt: new Date(),
          results: { companies: [], message: 'No companies found for this query' }
        });
        return;
      }

      // Phase 2: Extract contacts for each company
      console.log(`[${jobId}] Phase 2: Extracting contacts for ${companies.length} companies`);
      let totalContacts = 0;

      const companiesWithContacts = await Promise.all(
        companies.map(async (company: any) => {
          try {
            console.log(`[${jobId}] Finding contacts for: ${company.name}`);
            
            const contacts = await findKeyDecisionMakers(
              company.name,
              company.description || ''
            );

            // Save contacts to database
            const savedContacts = await Promise.all(
              contacts.map(contact => 
                storage.createContact({
                  name: contact.name,
                  email: contact.email || null,
                  role: contact.role || null,
                  companyId: company.id,
                  probability: contact.probability || null,
                  linkedinUrl: contact.linkedinUrl || null,
                  twitterHandle: contact.twitterHandle || null,
                  phoneNumber: contact.phoneNumber || null,
                  location: contact.location || null,
                  alternativeEmails: contact.alternativeEmails || null,
                  isDecisionMaker: contact.isDecisionMaker || false,
                  isInfluencer: contact.isInfluencer || false,
                  keyInsights: contact.keyInsights || null,
                  completedSearches: contact.completedSearches || null
                })
              )
            );

            totalContacts += savedContacts.length;
            console.log(`[${jobId}] Found ${savedContacts.length} contacts for ${company.name}`);

            return {
              ...company,
              contacts: savedContacts
            };
          } catch (error) {
            console.error(`[${jobId}] Error finding contacts for ${company.name}:`, error);
            return {
              ...company,
              contacts: []
            };
          }
        })
      );

      await storage.updateSearchJob(jobId, {
        contactsFound: totalContacts,
        progress: 'emails'
      });

      // Phase 3: Enrich emails for all contacts
      console.log(`[${jobId}] Phase 3: Enriching emails for ${totalContacts} contacts`);
      let totalEmails = 0;

      const finalResults = await Promise.all(
        companiesWithContacts.map(async (company: any) => {
          if (!company.contacts || company.contacts.length === 0) {
            return company;
          }

          const enrichedContacts = await Promise.all(
            company.contacts.map(async (contact: any) => {
              if (contact.email) {
                totalEmails++;
                return contact; // Already has email
              }

              try {
                // Try email enrichment using existing service methods
                const huntResult = await emailEnrichmentService.searchHunterContact(
                  contact.name,
                  company.name,
                  company.website || ''
                );

                if (huntResult.email) {
                  totalEmails++;
                  // Update contact in database
                  const updatedContact = await storage.updateContact(contact.id, {
                    email: huntResult.email,
                    alternativeEmails: huntResult.alternativeEmails || contact.alternativeEmails
                  });
                  return updatedContact;
                }

                return contact;
              } catch (error) {
                console.error(`[${jobId}] Error enriching contact ${contact.name}:`, error);
                return contact;
              }
            })
          );

          return {
            ...company,
            contacts: enrichedContacts
          };
        })
      );

      // Complete the job
      await storage.updateSearchJob(jobId, {
        status: 'completed',
        progress: 'completed',
        emailsFound: totalEmails,
        completedAt: new Date(),
        results: {
          companies: finalResults,
          summary: {
            companiesFound: companies.length,
            contactsFound: totalContacts,
            emailsFound: totalEmails
          }
        }
      });

      console.log(`[${jobId}] Search completed: ${companies.length} companies, ${totalContacts} contacts, ${totalEmails} emails`);

    } catch (error) {
      console.error(`[${jobId}] Search failed:`, error);
      
      await storage.updateSearchJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  /**
   * Check if a job is currently running
   */
  static isJobRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  /**
   * Get list of currently running jobs
   */
  static getRunningJobs(): string[] {
    return Array.from(this.runningJobs);
  }
}