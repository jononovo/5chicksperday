/**
 * Base Search Module
 * 
 * This module defines the core interfaces and base class for all search modules.
 * It handles common functionality and ensures consistent behavior across modules.
 */

// Define the core interfaces for search modules

/**
 * Interface for search module configuration options
 */
export interface SearchModuleConfig {
  // Common configuration options for all modules
  ignoreFranchises?: boolean;
  locallyHeadquartered?: boolean;
  
  // Module-specific prompt templates
  promptTemplates?: Record<string, string>;
  
  // Module-specific response structures
  responseStructures?: Record<string, string>;
  
  // Fields required for validation
  requiredFields?: string[];
  
  // Scoring thresholds for validation
  scoreThresholds?: Record<string, number>;
  
  // Confidence thresholds
  minimumConfidence?: number;
}

/**
 * Interface for search module execution context
 */
export interface SearchModuleContext {
  // The search query or company name
  query: string;
  
  // Module configuration
  config: SearchModuleConfig;
  
  // Optional previous results to build upon
  previousResults?: SearchModuleResult;
}

/**
 * Interface for search module results
 */
export interface SearchModuleResult {
  // Array of discovered companies
  companies: Array<Partial<any>>;
  
  // Array of discovered contacts
  contacts: Array<Partial<any>>;
  
  // Additional metadata about the search
  metadata?: {
    // Type of module that generated this result
    moduleType: string;
    
    // List of searches that were completed
    completedSearches?: string[];
    
    // Validation scores for different aspects
    validationScores?: Record<string, number>;
    
    // Additional module-specific metadata
    [key: string]: any;
  };
}

/**
 * Base class for all search modules
 * Implements common functionality and defines required interface
 */
export abstract class BaseSearchModule {
  /**
   * Execute the search
   * This method must be implemented by all modules
   */
  abstract execute(context: SearchModuleContext): Promise<SearchModuleResult>;
  
  /**
   * Optional validation method for results
   * @param result The result to validate
   * @returns Boolean indicating if the result meets quality standards
   */
  async validate(result: SearchModuleResult): Promise<boolean> {
    // Basic validation: we have some data
    return result.companies.length > 0 || result.contacts.length > 0;
  }
  
  /**
   * Merge current results with previous results
   * Default implementation combines arrays and preserves metadata
   */
  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;
    
    // Merge companies (current takes precedence)
    const companies = [
      ...(current.companies || []),
      ...(previous.companies || []).filter(
        prevComp => !(current.companies || []).some(
          currComp => currComp.name?.toLowerCase() === prevComp.name?.toLowerCase()
        )
      )
    ];
    
    // Merge contacts (current takes precedence)
    const contacts = [
      ...(current.contacts || []),
      ...(previous.contacts || []).filter(
        prevContact => !(current.contacts || []).some(
          currContact => currContact.name?.toLowerCase() === prevContact.name?.toLowerCase()
        )
      )
    ];
    
    // Merge metadata (preserve both)
    const metadata = {
      ...(previous.metadata || {}),
      ...(current.metadata || {}),
      // Combine completedSearches arrays
      completedSearches: [
        ...(previous.metadata?.completedSearches || []),
        ...(current.metadata?.completedSearches || [])
      ],
      // Combine validation scores (current takes precedence)
      validationScores: {
        ...(previous.metadata?.validationScores || {}),
        ...(current.metadata?.validationScores || {})
      }
    };
    
    return {
      companies,
      contacts,
      metadata
    };
  }
}