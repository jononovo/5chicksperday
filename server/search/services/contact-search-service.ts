/**
 * ContactSearchService - Centralized, stateless contact search service
 * 
 * This service provides a single source of truth for all contact searches,
 * ensuring consistent behavior whether triggered from browser, API, or cron jobs.
 * All contact searches go through the job queue for resilience.
 */

import { findKeyDecisionMakers } from "../contacts/finder";
import { storage } from "../../storage";
import type { Contact, Company } from "@shared/schema";
import type { ContactSearchConfig } from "../types";

export interface ContactSearchParams {
  companies: Company[];
  userId: number;
  searchConfig: ContactSearchConfig;
  jobId?: string;
  onProgress?: (message: string, phase: string) => Promise<void>;
}

export interface ContactSearchResult {
  companyId: number;
  companyName: string;
  contacts: Contact[];
  searchedAt: Date;
  config: ContactSearchConfig;
}

export class ContactSearchService {
  /**
   * Search for contacts across multiple companies
   * This is the single entry point for all contact searches
   */
  static async searchContacts(params: ContactSearchParams): Promise<ContactSearchResult[]> {
    const { companies, userId, searchConfig, jobId, onProgress } = params;
    const results: ContactSearchResult[] = [];

    console.log(`[ContactSearchService] Starting contact search for ${companies.length} companies`);
    console.log(`[ContactSearchService] Config:`, searchConfig);

    // Process each company
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      
      // Report progress
      if (onProgress) {
        await onProgress(
          `Searching contacts for ${company.name} (${i + 1}/${companies.length})`,
          'contact_discovery'
        );
      }

      try {
        // Search for contacts using the centralized finder
        const searchQuery = `${company.name} ${company.website || ''}`.trim();
        const contacts = await findKeyDecisionMakers(searchQuery, searchConfig);
        
        console.log(`[ContactSearchService] Found ${contacts.length} contacts for ${company.name}`);

        // Save contacts to database with deduplication
        const savedContacts: Contact[] = [];
        for (const contactData of contacts) {
          try {
            // Check if contact already exists (by email or name+company)
            const existingContacts = await storage.listContactsByCompany(company.id, userId);
            
            let existingContact = null;
            
            // First check by email if available
            if (contactData.email) {
              existingContact = existingContacts.find(c => 
                c.email?.toLowerCase() === contactData.email?.toLowerCase()
              );
            }
            
            // If no email match, check by name (case-insensitive)
            if (!existingContact && contactData.name) {
              existingContact = existingContacts.find(c => 
                c.name?.toLowerCase() === contactData.name?.toLowerCase()
              );
            }
            
            if (existingContact) {
              // Update existing contact instead of creating duplicate
              console.log(`[ContactSearchService] Updating existing contact: ${existingContact.name}`);
              
              // Merge new data with existing (prefer new data if available)
              const updateData: any = {
                ...contactData,
                // Preserve existing data if new data is null/undefined
                email: contactData.email || existingContact.email,
                role: contactData.role || existingContact.role,
                linkedinUrl: contactData.linkedinUrl || existingContact.linkedinUrl,
                phoneNumber: contactData.phoneNumber || existingContact.phoneNumber,
                lastValidated: new Date()
              };
              
              // Add jobId to completedSearches if not already present
              if (jobId) {
                const completedSearches = existingContact.completedSearches || [];
                if (!completedSearches.includes(jobId)) {
                  completedSearches.push(jobId);
                  updateData.completedSearches = completedSearches;
                }
              }
              
              const updatedContact = await storage.updateContact(existingContact.id, updateData);
              savedContacts.push(updatedContact);
              
            } else {
              // Create new contact
              console.log(`[ContactSearchService] Creating new contact: ${contactData.name}`);
              
              const contact = await storage.createContact({
                ...contactData,
                companyId: company.id,
                userId: userId,
                // Add job tracking metadata
                completedSearches: jobId ? [jobId] : [],
                lastValidated: new Date()
              } as any);
              
              savedContacts.push(contact);
            }
          } catch (error) {
            console.error(`[ContactSearchService] Error saving/updating contact:`, error);
          }
        }

        // Add to results
        results.push({
          companyId: company.id,
          companyName: company.name,
          contacts: savedContacts,
          searchedAt: new Date(),
          config: searchConfig
        });

      } catch (error) {
        console.error(`[ContactSearchService] Error searching contacts for ${company.name}:`, error);
        
        // Still add empty result so we know we tried
        results.push({
          companyId: company.id,
          companyName: company.name,
          contacts: [],
          searchedAt: new Date(),
          config: searchConfig
        });
      }
    }

    console.log(`[ContactSearchService] Completed search: ${results.length} companies processed`);
    return results;
  }

  /**
   * Search contacts for a single company
   * Convenience method that wraps searchContacts
   */
  static async searchCompanyContacts(
    company: Company,
    userId: number,
    searchConfig: ContactSearchConfig,
    jobId?: string
  ): Promise<ContactSearchResult> {
    const results = await this.searchContacts({
      companies: [company],
      userId,
      searchConfig,
      jobId
    });

    return results[0];
  }

  /**
   * Validate contact search configuration
   * Ensures config has valid settings before processing
   */
  static validateSearchConfig(config: ContactSearchConfig): boolean {
    // At least one search type must be enabled
    const hasEnabledSearch = 
      config.enableCoreLeadership ||
      config.enableDepartmentHeads ||
      config.enableMiddleManagement ||
      config.enableCustomSearch ||
      config.enableCustomSearch2;

    if (!hasEnabledSearch) {
      console.warn('[ContactSearchService] No search types enabled in config');
      return false;
    }

    // If custom search is enabled, must have target
    if (config.enableCustomSearch && !config.customSearchTarget) {
      console.warn('[ContactSearchService] Custom search enabled but no target specified');
      return false;
    }

    if (config.enableCustomSearch2 && !config.customSearchTarget2) {
      console.warn('[ContactSearchService] Custom search 2 enabled but no target specified');
      return false;
    }

    return true;
  }

  /**
   * Get default contact search configuration
   * Used when no specific config is provided
   */
  static getDefaultConfig(): ContactSearchConfig {
    return {
      enableCoreLeadership: true,
      enableDepartmentHeads: false,
      enableMiddleManagement: false,
      enableCustomSearch: false,
      customSearchTarget: undefined,
      enableCustomSearch2: false,
      customSearchTarget2: undefined
    };
  }

  /**
   * Merge user config with defaults
   * Ensures all required fields are present
   */
  static mergeWithDefaults(userConfig?: Partial<ContactSearchConfig>): ContactSearchConfig {
    return {
      ...this.getDefaultConfig(),
      ...userConfig
    };
  }

  /**
   * Check if contacts already exist for companies
   * Helps avoid duplicate searches
   */
  static async hasExistingContacts(
    companyIds: number[],
    userId: number
  ): Promise<Map<number, boolean>> {
    const result = new Map<number, boolean>();
    
    for (const companyId of companyIds) {
      const contacts = await storage.listContactsByCompany(companyId, userId);
      result.set(companyId, contacts.length > 0);
    }
    
    return result;
  }

  /**
   * Get contact search statistics for a user
   * Useful for analytics and rate limiting
   */
  static async getUserSearchStats(userId: number): Promise<{
    totalSearches: number;
    contactsFound: number;
    companiesSearched: number;
    lastSearchDate: Date | null;
  }> {
    const contacts = await storage.listContacts(userId);
    const companies = await storage.listCompanies(userId);
    
    // Find unique companies that have contacts
    const companiesWithContacts = new Set(
      contacts.map(c => c.companyId).filter(id => id)
    );
    
    // Find most recent contact
    const lastContact = contacts.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    )[0];
    
    return {
      totalSearches: contacts.filter(c => c.completedSearches && c.completedSearches.length > 0).length,
      contactsFound: contacts.length,
      companiesSearched: companiesWithContacts.size,
      lastSearchDate: lastContact?.createdAt || null
    };
  }
}