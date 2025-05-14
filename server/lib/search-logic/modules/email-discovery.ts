/**
 * Email Discovery Module
 * 
 * This module is responsible for discovering and validating email addresses
 * for contacts at a company.
 */

import { BaseSearchModule, type SearchModuleContext, type SearchModuleResult } from '../base-module';
import { analyzeCompany } from '../core-search';
import { isValidBusinessEmail } from '../../perplexity';

/**
 * Standard email patterns for a company
 */
const EMAIL_PATTERNS = [
  '{first}@{domain}',
  '{first}.{last}@{domain}',
  '{first}{last}@{domain}',
  '{first_initial}{last}@{domain}',
  '{first_initial}.{last}@{domain}',
  '{first}.{last_initial}@{domain}',
  '{first}{last_initial}@{domain}'
];

/**
 * Module for discovering email addresses
 */
export class EmailDiscoveryModule extends BaseSearchModule {
  /**
   * Execute the email discovery search
   */
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    // Default response structure for email discovery
    const responseStructure = `{
      "validatedEmails": "List of validated email addresses with format, confidence score, and verification status",
      "validationMetrics": "Summary of validation methods used and success rate"
    }`;
    
    // Default prompt template
    const defaultPrompt = `Find email addresses for contacts at [COMPANY]. Based on the company name and domain, predict the most likely email patterns and formats used by this organization.`;
    
    // Use configuration if provided, otherwise defaults
    const promptTemplate = config.promptTemplates?.emailDiscovery || defaultPrompt;
    const structure = config.responseStructures?.emailDiscovery || responseStructure;
    
    try {
      // Use company information from previous results
      const company = previousResults?.companies[0];
      if (!company || !company.name) {
        return {
          companies: previousResults?.companies || [],
          contacts: previousResults?.contacts || [],
          metadata: {
            moduleType: 'email_discovery',
            completedSearches: [],
            validationScores: {
              error: 0
            }
          }
        };
      }
      
      // Extract company details
      const companyName = company.name;
      const domain = this.extractDomain(company.website || '');
      
      // Skip if no domain available and domain is required by config
      if (!domain && config.requiredFields?.includes('domain')) {
        return {
          companies: previousResults?.companies || [],
          contacts: previousResults?.contacts || [],
          metadata: {
            moduleType: 'email_discovery',
            completedSearches: ['domain_check'],
            validationScores: {
              domain_check: 0
            }
          }
        };
      }
      
      // Prepare contacts from previous results or empty array
      let contacts = [...(previousResults?.contacts || [])];
      
      // If we have contacts without emails, try to discover them
      const contactsWithoutEmail = contacts.filter(contact => !contact.email && contact.name);
      
      if (contactsWithoutEmail.length > 0 && domain) {
        // Add domain to the prompt to improve email discovery
        const enhancedPrompt = `${promptTemplate} For the company "${companyName}" with domain "${domain}".`;
        
        // Make API request to get email patterns and predictions
        const result = await analyzeCompany(
          companyName,
          enhancedPrompt,
          "You are an expert at discovering professional email addresses. Focus on accuracy and common corporate email patterns.",
          structure
        );
        
        // Extract any discovered email patterns
        let emailPatterns = EMAIL_PATTERNS;
        try {
          const parsedResult = JSON.parse(result);
          if (parsedResult.emailPatterns && Array.isArray(parsedResult.emailPatterns)) {
            emailPatterns = parsedResult.emailPatterns;
          }
        } catch (error) {
          console.warn('Failed to parse email patterns from result, using defaults');
        }
        
        // Generate and validate email addresses for each contact
        const updatedContacts = await Promise.all(contactsWithoutEmail.map(async contact => {
          if (!contact.name) return contact;
          
          // Generate potential email addresses
          const potentialEmails = this.generatePotentialEmails(
            contact.name,
            domain,
            emailPatterns
          );
          
          // Validate the potential emails
          const validatedEmails = potentialEmails
            .filter(email => isValidBusinessEmail(email));
          
          // Use the first valid email if available
          const bestEmail = validatedEmails.length > 0 ? validatedEmails[0] : null;
          
          return {
            ...contact,
            email: bestEmail,
            alternativeEmails: validatedEmails.length > 1 ? validatedEmails.slice(1) : null,
            probability: validatedEmails.length > 0 ? 0.8 : null
          };
        }));
        
        // Update contacts with new email information
        contacts = contacts.map(contact => {
          const updatedContact = updatedContacts.find(uc => uc.name === contact.name);
          return updatedContact || contact;
        });
      }
      
      // Calculate success metrics
      const totalContacts = contacts.length;
      const contactsWithEmail = contacts.filter(c => !!c.email).length;
      const successRate = totalContacts > 0 ? contactsWithEmail / totalContacts : 0;
      
      // Return well-formatted result
      return {
        companies: previousResults?.companies || [],
        contacts: contacts,
        metadata: {
          moduleType: 'email_discovery',
          completedSearches: ['pattern_analysis', 'email_validation'],
          validationScores: {
            success_rate: successRate,
            email_count: contactsWithEmail
          }
        }
      };
    } catch (error) {
      console.error('Error in EmailDiscoveryModule', error);
      
      // Return previous results on error
      return {
        companies: previousResults?.companies || [],
        contacts: previousResults?.contacts || [],
        metadata: {
          moduleType: 'email_discovery',
          completedSearches: [],
          validationScores: {
            error: 0
          }
        }
      };
    }
  }
  
  /**
   * Validate the search results
   */
  async validate(result: SearchModuleResult): Promise<boolean> {
    // No contacts or companies found
    if (result.contacts.length === 0 || result.companies.length === 0) {
      return false;
    }
    
    // Check if we discovered any emails
    const contactsWithEmail = result.contacts.filter(c => !!c.email).length;
    
    // Success if we have at least some emails
    return contactsWithEmail > 0;
  }
  
  /**
   * Extract domain from website URL
   */
  private extractDomain(website: string): string {
    if (!website) return '';
    
    // Clean up the website URL
    let domain = website.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    
    return domain;
  }
  
  /**
   * Generate potential email addresses based on name and patterns
   */
  private generatePotentialEmails(name: string, domain: string, patterns: string[]): string[] {
    // Split the name into parts
    const nameParts = name.split(' ').filter(part => part.trim() !== '');
    if (nameParts.length < 1) return [];
    
    const firstName = nameParts[0].toLowerCase();
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1].toLowerCase() : '';
    const firstInitial = firstName.charAt(0).toLowerCase();
    const lastInitial = lastName.charAt(0).toLowerCase();
    
    // Generate emails based on patterns
    return patterns.map(pattern => {
      return pattern
        .replace('{first}', firstName)
        .replace('{last}', lastName)
        .replace('{first_initial}', firstInitial)
        .replace('{last_initial}', lastInitial)
        .replace('{domain}', domain);
    }).filter(email => {
      // Filter out invalid patterns (e.g., if lastName is empty but pattern requires it)
      return !email.includes('{') && !email.includes('}') && 
             email.includes('@') && email.split('@')[1] === domain;
    });
  }
}