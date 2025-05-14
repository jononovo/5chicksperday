/**
 * Decision Maker Module
 * 
 * This module is responsible for finding decision makers within companies.
 * It focuses on identifying key contacts who have decision-making authority.
 */

import { BaseSearchModule, type SearchModuleContext, type SearchModuleResult } from '../base-module';
import { analyzeCompany, extractContacts } from '../core-search';
import { validateContacts } from '../contact-validation';
import { isLeadershipRole, getRoleMultiplier } from '../utils/company-utils';

/**
 * Module for discovering decision makers at companies
 */
export class DecisionMakerModule extends BaseSearchModule {
  /**
   * Execute the decision maker search
   */
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    // Default response structure for decision maker search
    const responseStructure = `{
      "contacts": [
        {
          "name": "Contact's full name", 
          "role": "Contact's role or job title", 
          "email": "Contact's email if available"
        }
      ]
    }`;
    
    // Default prompt template
    const defaultPrompt = `Find key decision makers at [COMPANY]. Include C-level executives, VPs, Directors, and Managers. Provide their full names and job titles.`;
    
    // Use configuration if provided, otherwise defaults
    const promptTemplate = config.promptTemplates?.decisonMakers || defaultPrompt;
    const structure = config.responseStructures?.decisionMakers || responseStructure;
    
    try {
      // Use company name from previous results or query
      const companyName = previousResults?.companies[0]?.name || query;
      
      if (!companyName) {
        return {
          companies: [],
          contacts: [],
          metadata: {
            moduleType: 'decision_maker',
            completedSearches: [],
            validationScores: {
              error: 0
            }
          }
        };
      }
      
      // Make API request to get contact details
      const result = await analyzeCompany(
        companyName,
        promptTemplate,
        "You are an expert at finding key decision makers at companies. Focus on leadership roles only.",
        structure
      );
      
      // Extract contacts from the result
      let contacts = await extractContacts(result, companyName);
      
      // Add company ID to each contact if available
      const companyId = previousResults?.companies[0]?.id;
      if (companyId) {
        contacts = contacts.map(contact => ({
          ...contact,
          companyId
        }));
      }
      
      // Filter out non-leadership roles if configured
      if (config.requiredFields?.includes('leadership_role')) {
        contacts = contacts.filter(contact => isLeadershipRole(contact.role));
      }
      
      // Apply the new unified contact validation and scoring
      if (contacts.length > 0) {
        contacts = await validateContacts(contacts, companyName, {
          minimumScore: 30,
          prioritizeLeadership: true
        });
      }
      
      // Sort contacts by probability (should already be done by validateContacts, but just in case)
      contacts.sort((a, b) => (b.probability || 0) - (a.probability || 0));
      
      // Calculate average confidence score
      const avgConfidence = contacts.reduce((sum, contact) => {
        return sum + (contact.probability || 0);
      }, 0) / (contacts.length || 1);
      
      // Return well-formatted result
      return {
        companies: previousResults?.companies || [],
        contacts: contacts,
        metadata: {
          moduleType: 'decision_maker',
          completedSearches: ['contact_discovery', 'name_validation'],
          validationScores: {
            contact_count: contacts.length,
            leadership_ratio: contacts.filter(c => isLeadershipRole(c.role)).length / (contacts.length || 1),
            confidence: avgConfidence
          }
        }
      };
    } catch (error) {
      console.error('Error in DecisionMakerModule', error);
      
      // Return empty result on error
      return {
        companies: previousResults?.companies || [],
        contacts: [],
        metadata: {
          moduleType: 'decision_maker',
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
    // No contacts found
    if (result.contacts.length === 0) {
      return false;
    }
    
    // Check if we have at least one leadership role
    const hasLeadership = result.contacts.some(contact => isLeadershipRole(contact.role));
    
    // Check average confidence
    const avgConfidence = result.metadata?.validationScores?.confidence || 0;
    const minimumConfidence = 60; // Default minimum confidence
    
    return hasLeadership && avgConfidence >= minimumConfidence;
  }
  
  /**
   * Merge with previous results
   */
  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    // Use the base implementation but ensure we don't duplicate contacts
    const merged = super.merge(current, previous);
    
    // Deduplicate contacts by name
    if (merged.contacts.length > 0) {
      const uniqueContacts: Record<string, Partial<any>> = {};
      
      for (const contact of merged.contacts) {
        const key = contact.name?.toLowerCase();
        if (key && (!uniqueContacts[key] || getRoleMultiplier(contact.role) > getRoleMultiplier(uniqueContacts[key].role))) {
          uniqueContacts[key] = contact;
        }
      }
      
      merged.contacts = Object.values(uniqueContacts);
    }
    
    return merged;
  }
}