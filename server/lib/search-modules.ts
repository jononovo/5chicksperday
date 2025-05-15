import type { SearchModuleConfig, SearchSequence, SearchImplementation } from '@shared/schema';
import { validateNames, extractContacts } from './results-analysis/contact-name-validation';
import { searchCompanies, analyzeCompany } from './search-logic';
import { parseCompanyData } from './results-analysis/company-parser';
import { validateEmails } from './perplexity';
import type { Company, Contact } from '@shared/schema';
import { emailDiscoveryModule } from './search-logic/email-discovery';
import { validateEmailPattern, isValidBusinessEmail, isPlaceholderEmail } from './results-analysis/email-analysis';
import { validateEmailEnhanced, validateEmailsEnhanced } from './search-logic/email-discovery/enhanced-validation';
import { searchContactDetails } from './api-interactions';

import {
  analyzeCompanySize,
  analyzeDifferentiators,
  calculateCompanyScore,
  isFranchise,
  isLocalHeadquarter
} from './results-analysis/company-analysis';

import { localBusinessAssociationsSearch } from './search-logic/deep-searches/local-sources/local-business-associations-search';

// Define the structure of search module results
export interface SearchModuleResult {
  companies: Array<Partial<Company>>;
  contacts: Array<Partial<Contact>>;
  metadata: {
    moduleType: string;
    completedSearches: string[];
    validationScores: Record<string, number>;
  };
}

// Company Overview Module Configuration
export const COMPANY_OVERVIEW_MODULE = {
  type: 'company_overview',
  defaultPrompt: "Provide a detailed overview of [COMPANY], including its age, size, and main business focus.",
  technicalPrompt: `You are a business intelligence analyst. Analyze the company and provide structured information about:
    1. Company size (employee count)
    2. Core services offered
    3. Market positioning
    4. Key differentiators

    Format your response as JSON with the following structure:
    {
      "size": number,
      "services": string[],
      "marketPosition": string,
      "differentiators": string[]
    }`,
  responseStructure: {
    size: "number - employee count",
    services: "string[] - list of main services",
    marketPosition: "string - brief market position description",
    differentiators: "string[] - list of key differentiating factors"
  }
};

// Decision Maker Module Configuration
export const DECISION_MAKER_MODULE = {
  type: 'decision_maker',
  defaultPrompt: "Find key decision makers at [COMPANY], with a focus on leadership, executives, owners, and managers.",
  technicalPrompt: `You are a specialized business contact researcher. Your task is to find ONLY real people at the company, specifically leaders and decision makers.

    I need a list of REAL PEOPLE with their ACTUAL NAMES and CURRENT ROLES. Focus on finding:
    - Owners and founders
    - C-suite executives (CEO, COO, CFO, CTO, etc.)
    - Directors and department heads
    - Key managers and team leads

    FORMAT YOUR RESPONSE LIKE THIS:
    
    John Smith, CEO
    Sarah Johnson, Operations Director
    Michael Williams, Head of Marketing
    Robert Davis, Owner
    Jennifer Wilson, Technology Manager
    
    DO NOT INCLUDE ANY OF THESE:
    - Department names without people
    - Generic positions without names
    - Company services or products
    - General company information
    - Company history
    - Location information

    ONLY RETURN A LIST OF ACTUAL PEOPLE WHO WORK AT THE COMPANY.`,
  responseStructure: {
    contacts: [
      {
        name: "string - full name",
        role: "string - job title",
        department: "string - department name",
        email: "string | null - business email if found",
        linkedinUrl: "string | null - LinkedIn profile URL if found"
      }
    ]
  },
  validationRules: {
    minimumConfidence: 25, // Lowered to include more potential matches
    requireRole: true,
    requireDepartment: false,
    // Adding specific multipliers for roles
    founder_multiplier: 1.5,
    c_level_multiplier: 1.3,
    director_multiplier: 1.2,
    manager_multiplier: 1.1
  }
};

// Email Discovery Module Configuration
export const EMAIL_DISCOVERY_MODULE = {
  type: 'email_discovery',
  defaultPrompt: "Discover and validate email addresses for contacts at [COMPANY]",
  technicalPrompt: `You are an email discovery specialist. For the given company contacts:
    1. Analyze company domain and email patterns
    2. Search public sources for email addresses
    3. Validate discovered emails through multiple methods
    4. Assign confidence scores based on validation results

    Format your response as JSON with the following structure:
    {
      "discoveredEmails": [
        {
          "email": string,
          "contactName": string | null,
          "confidence": number,
          "source": string,
          "validationMethods": string[],
          "patternMatch": boolean
        }
      ],
      "emailPatterns": {
        "common": string[],
        "validated": boolean
      }
    }`,
  responseStructure: {
    discoveredEmails: [
      {
        email: "string - discovered email address",
        contactName: "string | null - associated contact name if known",
        confidence: "number - confidence score 0-100",
        source: "string - discovery source (e.g., website, directory, pattern)",
        validationMethods: "string[] - list of validation methods used",
        patternMatch: "boolean - matches company email pattern"
      }
    ],
    emailPatterns: {
      common: "string[] - detected company email patterns",
      validated: "boolean - pattern validation status"
    }
  },
  validationRules: {
    minimumConfidence: 50,
    requireValidation: true,
    validatePattern: true
  }
};

// Add Local Sources Module Configuration
export const LOCAL_SOURCES_MODULE = {
  type: 'local_sources',
  defaultPrompt: "Search local business associations and directories for contact information at [COMPANY]",
  technicalPrompt: `You are a local business researcher. Search local sources including:
    1. Chamber of commerce directories
    2. Local business associations
    3. Business networking groups
    4. Local trade organizations

    Format your response as JSON with the following structure:
    {
      "sources": [
        {
          "name": string,
          "type": string,
          "contacts": [{
            "name": string,
            "role": string,
            "email": string | null
          }]
        }
      ]
    }`,
  responseStructure: {
    sources: [
      {
        name: "string - source name (e.g., Chamber of Commerce)",
        type: "string - source type (e.g., business_association)",
        contacts: [
          {
            name: "string - contact name",
            role: "string - position/role",
            email: "string | null - contact email if available"
          }
        ]
      }
    ]
  },
  // Enable by default for email discovery
  defaultEnabledFor: ['email_discovery']
};

// All available search modules - The four core modules of our search system
export const SEARCH_MODULES = {
  // Core modules of our standard search flow
  company_overview: COMPANY_OVERVIEW_MODULE,
  email_discovery: EMAIL_DISCOVERY_MODULE,
  
  // Email enrichment module - validates and enhances email addresses
  email_enrichment: {
    type: 'email_enrichment',
    defaultPrompt: "Validate and enrich email addresses for contacts at the company.",
    technicalPrompt: `You are an email validation specialist. For each discovered email, perform detailed validation:
      1. Pattern validation
      2. Domain verification
      3. Business email format analysis
      4. Cross-reference with contact name
      
      Format your response with validation scores and confidence metrics.`,
    responseStructure: {
      validatedEmails: "array of validated emails with confidence scores",
      validationMetrics: "detailed validation information"
    },
    defaultEnabledFor: ['email_discovery']
  },
  
  // Email deepdive module - performs advanced analysis for high-value contacts
  email_deepdive: {
    type: 'email_deepdive',
    defaultPrompt: "Perform deep analysis of contact information with focus on leadership.",
    technicalPrompt: `For high-value contacts (leadership, founders, executives):
      1. Perform deep pattern analysis
      2. Cross-reference with social profiles
      3. Analyze role-specific email patterns
      4. Validate against business email conventions
      
      Focus on decision-makers and provide confidence metrics.`,
    responseStructure: {
      deepSearchResults: "detailed results from deep analysis",
      confidenceScores: "confidence metrics for each result"
    },
    defaultEnabledFor: ['email_discovery']
  },
  
  // Additional specialized search modules
  decision_maker: DECISION_MAKER_MODULE,
  local_sources: LOCAL_SOURCES_MODULE
};

// Helper function to get module configuration
export function getModuleConfig(moduleType: string): typeof COMPANY_OVERVIEW_MODULE | typeof DECISION_MAKER_MODULE | typeof EMAIL_DISCOVERY_MODULE | typeof LOCAL_SOURCES_MODULE {
  const module = SEARCH_MODULES[moduleType as keyof typeof SEARCH_MODULES];
  if (!module) {
    throw new Error(`Unknown module type: ${moduleType}`);
  }
  return module;
}

export interface SearchModuleContext {
  query: string;
  config: SearchModuleConfig;
  previousResults?: SearchModuleResult;
}

export interface SearchModule {
  execute(context: SearchModuleContext): Promise<SearchModuleResult>;
  validate(result: SearchModuleResult): Promise<boolean>;
  merge?(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult;
}

// Company Overview Module
export class CompanyOverviewModule implements SearchModule {
  async execute({ query, config }: SearchModuleContext): Promise<SearchModuleResult> {
    const completedSearches: string[] = [];
    const companies: Array<Partial<Company>> = [];
    const validationScores: Record<string, number> = {};

    try {
      // Base company search
      const companyNames = await searchCompanies(query);
      
      // If no companies found, try a more generic search
      if (!companyNames || companyNames.length === 0) {
        console.log(`No companies found for "${query}", trying fallback search...`);
        const fallbackNames = await searchCompanies(`business ${query}`);
        if (fallbackNames && fallbackNames.length > 0) {
          companyNames.push(...fallbackNames);
        }
      }

      // Add additional company analyses to get more complete data
      for (const name of companyNames) {
        const searchOptions = config.searchOptions || {};

        // Skip if it matches exclusion criteria
        if (searchOptions.ignoreFranchises && isFranchise(name)) continue;
        if (searchOptions.locallyHeadquartered && !isLocalHeadquarter(name)) continue;

        // First, get basic company details
        try {
          const basicPrompt = `Provide detailed information about ${name} including:
            1. Company size (employee count)
            2. Services offered
            3. Website URL
            4. Location/headquarters
            5. Year founded (if available)`;
          
          const basicResult = await analyzeCompany(name, basicPrompt, null, null);
          completedSearches.push('basic-company-details');
          
          // Get additional analysis based on enabled subsearches
          const analysisResults = await this.executeSubsearches(name, config);
          analysisResults.push(basicResult);
          
          // Parse combined results
          const companyData = parseCompanyData(analysisResults);

          if (companyData) {
            // Calculate a score for this company based on completeness of information
            const totalScore = calculateCompanyScore(companyData);
            
            companies.push({
              name,
              ...companyData,
              totalScore
            });
            
            validationScores[name] = totalScore;

            // Track completed searches
            completedSearches.push(...Object.keys(config.subsearches || {})
              .filter(key => config.subsearches?.[key]));
          }
        } catch (error) {
          console.error(`Error analyzing company ${name}:`, error);
        }
      }

      // Sort companies by score (highest first)
      companies.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

      return {
        companies,
        contacts: [], // Company overview doesn't handle contacts
        metadata: {
          moduleType: 'company_overview',
          completedSearches,
          validationScores
        }
      };
    } catch (error) {
      console.error('Error in CompanyOverviewModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    // Validate we have at least one company with sufficient information
    const hasValidCompanies = result.companies.length > 0;
    const hasMinimumRequiredData = result.companies.some(company =>
      company.name && ((company.services && company.services.length > 0) || company.description)
    );

    return hasValidCompanies && hasMinimumRequiredData;
  }

  private async executeSubsearches(
    companyName: string,
    config: SearchModuleConfig
  ): Promise<string[]> {
    const results: string[] = [];
    const subsearches = config.subsearches || {};
    
    // If no subsearches are specified, add a default one
    if (!subsearches || Object.keys(subsearches).length === 0 || 
        !Object.values(subsearches).some(enabled => enabled)) {
      // Default prompt for company details
      const detailsPrompt = `Analyze ${companyName} and provide information about:
        1. Their main business focus and industry
        2. Key services or products they offer
        3. Their target customers or market
        4. What makes them unique or different from competitors`;
        
      const result = await analyzeCompany(companyName, detailsPrompt, null, null);
      results.push(result);
      return results;
    }

    // Otherwise, execute each enabled subsearch
    for (const [searchId, enabled] of Object.entries(subsearches)) {
      if (!enabled) continue;

      const section = Object.values(config.searchSections || {})
        .find(section => section.searches.some(search => search.id === searchId));

      if (section) {
        const search = section.searches.find(s => s.id === searchId);
        if (search?.implementation) {
          try {
            const result = await analyzeCompany(
              companyName,
              search.implementation,
              null,
              null
            );
            results.push(result);
          } catch (error) {
            console.error(`Failed to execute search ${searchId}:`, error);
          }
        }
      }
    }

    return results;
  }
}

// Decision Maker Module
export class DecisionMakerModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    const companies = previousResults?.companies || [];
    const contacts: Array<Partial<Contact>> = [];
    const completedSearches: string[] = [];
    const validationScores: Record<string, number> = {};

    try {
      for (const company of companies) {
        if (!company.name) continue;

        // Execute enabled social and professional network searches
        const subsearches = config.subsearches || {};
        const searchSections = config.searchSections || {};
        const searchResults: string[] = [];

        // Track which sections we've processed
        const processedSections = new Set<string>();

        // Check if we should use enhanced name validation
        const useEnhancedValidation = config.searchOptions?.enhancedNameValidation || false;
        
        // Determine minimum validation thresholds
        const validationRules = config.validationRules || {};
        const minimumConfidence = validationRules.minimumConfidence || 0;
        
        // Execute explicit search for decision makers
        try {
          const defaultPrompt = "Find key decision makers at " + company.name + 
              ", including their roles. Focus on owners, founders, directors, and C-level executives.";
              
          // Result will be a list of potential contacts with roles
          const result = await analyzeCompany(
            company.name,
            defaultPrompt,
            null,
            null
          );
          searchResults.push(result);
          completedSearches.push('decision-maker-search');
        } catch (error) {
          console.error(`Failed to execute default decision maker search:`, error);
        }

        // Execute additional configured searches
        for (const [searchId, enabled] of Object.entries(subsearches)) {
          if (!enabled) continue;

          const section = Object.values(searchSections)
            .find(section => section.searches.some(search => search.id === searchId));

          if (section && !processedSections.has(section.id)) {
            processedSections.add(section.id);

            // Execute all enabled searches in this section
            const enabledSearches = section.searches
              .filter(search => subsearches[search.id])
              .filter(search => search.implementation);

            for (const search of enabledSearches) {
              try {
                const result = await analyzeCompany(
                  company.name,
                  search.implementation!,
                  null,
                  null
                );
                searchResults.push(result);
                completedSearches.push(search.id);
              } catch (error) {
                console.error(`Failed to execute search ${search.id}:`, error);
              }
            }
          }
        }

        // Create a series of highly targeted prompts specifically for real people
        const prompts = [
          // Primary contact prompt - very explicit about needing real people
          `LIST ONLY REAL PEOPLE who work at ${company.name}.
         
REQUIRED FORMAT:
- First Last, Title
- First Last, Title

EXAMPLES OF GOOD ANSWERS:
- John Smith, CEO
- Sarah Johnson, Operations Manager
- Michael Williams, Owner
- Robert Davis, General Manager
- Jennifer Wilson, Director
  
DO NOT INCLUDE:
- Department names
- Generic positions without names
- Services or products
- Financial metrics
- Company descriptions`,

          // Secondary prompt focused on management/leadership
          `Who are the key individuals in leadership positions at ${company.name}?
          
List real people with full names and their roles. Only include actual people, not departments or generic positions.`,

          // Tertiary prompt for owners/founders specifically
          `Who owns or founded ${company.name}? 
          
Provide their full name and current position. If this information is not available, who are the current leaders?`
        ];
        
        // Execute multiple targeted searches to find real people
        for (const prompt of prompts) {
          try {
            const result = await analyzeCompany(
              company.name,
              prompt,
              null,
              null
            );
            if (result && typeof result === 'string') {
              searchResults.push(result);
              completedSearches.push('people-search');
            }
          } catch (error) {
            console.error('Failed to execute people search:', error);
          }
        }
        
        // Build a collection of manually extracted person names
        const manuallyExtractedPeople: Partial<Contact>[] = [];
        
        // Extract names from results using regex patterns for common name formats
        const namePatterns = [
          // Name followed by role/title after comma
          /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,\s+|\s+-\s+)([^,.]+)/g,
          
          // Name with Mr./Mrs./Ms. prefix
          /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
          
          // Standard capitalized first and last name
          /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g
        ];
        
        for (const result of searchResults) {
          if (typeof result !== 'string' || !result) continue;
          
          // Try each pattern to extract names
          for (const pattern of namePatterns) {
            let match;
            const regex = new RegExp(pattern);
            
            while ((match = regex.exec(result)) !== null) {
              // Get the name portion - different index depending on pattern
              const name = pattern.toString().includes('Mr.') ? match[1] : match[1];
              
              // Try to extract a role if available (from patterns that capture roles)
              let role = null;
              if (match.length > 2 && pattern.toString().includes('([^,.]+)')) {
                role = match[2];
              } else {
                // Extract role from surrounding context
                const namePosition = result.indexOf(name);
                if (namePosition !== -1) {
                  const contextStart = Math.max(0, namePosition - 30);
                  const contextEnd = Math.min(result.length, namePosition + name.length + 100);
                  const context = result.substring(contextStart, contextEnd);
                  
                  // Common role patterns
                  const rolePatterns = [
                    new RegExp(`${name}(?:,|\\s+is|\\s+as)\\s+(?:the|a|an)?\\s+([^,.]+)`, 'i'),
                    new RegExp(`${name}\\s+\\(([^)]+)\\)`, 'i'),
                    new RegExp(`${name}\\s+-\\s+([^,.]+)`, 'i')
                  ];
                  
                  for (const rolePattern of rolePatterns) {
                    const roleMatch = context.match(rolePattern);
                    if (roleMatch && roleMatch[1]) {
                      role = roleMatch[1].trim();
                      break;
                    }
                  }
                }
              }
              
              // Skip obviously non-person names
              const nameLower = name.toLowerCase();
              if (nameLower.includes('company') || 
                  nameLower.includes('service') || 
                  nameLower.includes('department') || 
                  nameLower.includes('llc') || 
                  nameLower.includes('inc') ||
                  nameLower.includes('professional') ||
                  nameLower.includes('emergency') ||
                  nameLower.includes('quality')) {
                continue;
              }
              
              // Add as a contact with high confidence if it passes basic tests
              if (name.split(/\s+/).length >= 2 && name.length > 5) {
                // Slight variation in score based on context quality
                const contextScore = role ? 95 : 85;
                
                manuallyExtractedPeople.push({
                  name,
                  role,
                  companyId: company.id,
                  probability: contextScore,
                  verificationSource: 'direct-extraction',
                  // Flag as manually extracted to prioritize these results
                  manuallyExtracted: true
                });
              }
            }
          }
          
          // Also try to find common person name patterns with roles on the same line
          const personWithRoleLines = result.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && 
                  /^[A-Z]/.test(line) && // Starts with capital letter
                  /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line) && // Has proper name format
                  (line.includes(',') || line.includes('-') || line.includes(':'))); // Has role separator
          
          for (const line of personWithRoleLines) {
            const parts = line.split(/,|-|:/);
            
            if (parts.length >= 2) {
              const name = parts[0].trim();
              const role = parts[1].trim();
              
              // Skip obvious non-person names
              const nameLower = name.toLowerCase();
              if (nameLower.includes('company') || 
                  nameLower.includes('service') || 
                  nameLower.includes('department')) {
                continue;
              }
              
              // Add high-confidence entry from structured line
              if (name.split(/\s+/).length >= 2 && name.length > 5) {
                manuallyExtractedPeople.push({
                  name,
                  role,
                  companyId: company.id,
                  probability: 98, // Highest probability for well-structured entries
                  verificationSource: 'structured-line',
                  manuallyExtracted: true
                });
              }
            }
          }
        }
        
        // Always include manually extracted people, even if other methods fail
        console.log(`Manually extracted ${manuallyExtractedPeople.length} people from results`);
        
        // Extract contacts using standard methods too as a fallback
        let extractedContacts = await extractContacts(searchResults);
        
        // First prioritize manually extracted people
        extractedContacts = [...manuallyExtractedPeople, ...extractedContacts];
        
        // Filter out non-person entities
        extractedContacts = extractedContacts.filter(contact => {
          if (!contact.name) return false;
          
          const name = contact.name.toLowerCase();
          
          // Filter out obvious business terms
          const businessTerms = [
            'llc', 'inc', 'corp', 'corporation', 'company', 'co.', 'ltd', 
            'limited', 'service', 'plumbing', 'hvac', 'repair', 'department',
            'sales', 'marketing', 'support', 'customer', 'services',
            'contact us', 'contact', 'call', 'info', 'information',
            'overview', 'details', 'profile', 'business', 'industry'
          ];
          
          if (businessTerms.some(term => name.includes(term))) {
            return false;
          }
          
          // Filter out single-word names (likely not real people)
          if (!name.includes(' ') && name.length < 8) {
            return false;
          }
          
          return true;
        });
        
        // Apply appropriate validation based on configuration
        let validatedContacts = [];
        
        // Import needed for enhanced contact discovery
        const { filterContacts, LEGACY_OPTIONS } = await import('./search-logic/contact-discovery/enhanced-contact-discovery');
        
        // Check if legacy mode is enabled
        const isLegacyMode = config.searchOptions?.legacyMode === true;
        const focusOnLeadership = config.searchOptions?.focusOnLeadership === true;
        
        if (isLegacyMode) {
          console.log("Using legacy contact discovery mode");
          
          // Use more lenient legacy options designed for decision-maker focus
          const enhancedFiltered = filterContacts(
            extractedContacts, 
            company.name,
            LEGACY_OPTIONS
          );
          
          validatedContacts = enhancedFiltered.map(contact => ({
            ...contact,
            // Ensure we have a probability for sorting
            probability: contact.probability || 60
          }));
          
          // If focusing on leadership, prioritize leadership roles
          if (focusOnLeadership) {
            validatedContacts = validatedContacts.map(contact => {
              const role = contact.role?.toLowerCase() || '';
              
              // Apply role-specific multipliers for leadership roles
              const leadershipTerms = {
                'founder': config.validationRules?.founder_multiplier || 1.5,
                'ceo': config.validationRules?.c_level_multiplier || 1.3,
                'chief': config.validationRules?.c_level_multiplier || 1.3,
                'president': config.validationRules?.c_level_multiplier || 1.3,
                'owner': config.validationRules?.founder_multiplier || 1.5,
                'director': config.validationRules?.director_multiplier || 1.2,
                'vp': config.validationRules?.director_multiplier || 1.2,
                'vice president': config.validationRules?.director_multiplier || 1.2,
                'head of': config.validationRules?.director_multiplier || 1.2,
                'partner': config.validationRules?.founder_multiplier || 1.4
              };
              
              // Find the highest applicable multiplier
              let highestMultiplier = 1.0;
              
              for (const [term, multiplier] of Object.entries(leadershipTerms)) {
                if (role.includes(term) && multiplier > highestMultiplier) {
                  highestMultiplier = multiplier;
                }
              }
              
              // Apply the multiplier to the probability
              return {
                ...contact,
                probability: Math.min(100, (contact.probability || 60) * highestMultiplier)
              };
            });
          }
        } else if (useEnhancedValidation) {
          // Use more advanced filtering with enhanced discovery (standard mode)
          const enhancedFiltered = filterContacts(
            extractedContacts, 
            company.name,
            {
              minimumNameScore: config.searchOptions?.minimumNameScore || 65,
              companyNamePenalty: 30,
              filterGenericNames: true
            }
          );
          
          validatedContacts = enhancedFiltered.map(contact => ({
            ...contact,
            // Ensure we have a probability for sorting
            probability: contact.probability || 75
          }));
        } else {
          // Use basic validation
          validatedContacts = extractedContacts.filter(contact => {
            return contact.probability && contact.probability >= minimumConfidence;
          });
        }

        // We definitely want to make sure contacts have the company ID
        validatedContacts = validatedContacts.map(contact => ({
          ...contact,
          companyId: company.id
        }));
        
        // Sort by probability
        validatedContacts.sort((a, b) => (b.probability || 0) - (a.probability || 0));
        
        // Limit to top 10 contacts per company to keep quality high
        const topContacts = validatedContacts.slice(0, 10);

        contacts.push(...topContacts);

        // Calculate validation scores
        for (const contact of topContacts) {
          if (contact.name) {
            validationScores[contact.name] = contact.probability || 0;
          }
        }
      }

      return {
        companies: [], // Decision maker module doesn't modify companies
        contacts,
        metadata: {
          moduleType: 'decision_maker',
          completedSearches,
          validationScores
        }
      };
    } catch (error) {
      console.error('Error in DecisionMakerModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    return result.contacts.length > 0 &&
           result.contacts.every(contact =>
             contact.name &&
             contact.probability &&
             contact.probability >= 30
           );
  }

  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;

    return {
      companies: previous.companies,
      contacts: [
        ...previous.contacts,
        ...current.contacts.filter(newContact =>
          !previous.contacts.some(existingContact =>
            existingContact.name === newContact.name
          )
        )
      ],
      metadata: {
        ...current.metadata,
        completedSearches: [
          ...(previous.metadata.completedSearches || []),
          ...(current.metadata.completedSearches || [])
        ],
        validationScores: {
          ...previous.metadata.validationScores,
          ...current.metadata.validationScores
        }
      }
    };
  }
}

// Email Discovery Module
export class EmailDiscoveryModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    const companies = previousResults?.companies || [];
    const contacts: Array<Partial<Contact>> = [];
    const completedSearches: string[] = [];
    const validationScores: Record<string, number> = {};

    try {
      // Determine if we're using enhanced validation (based on search approach)
      const useEnhancedValidation = config.searchOptions?.useEnhancedValidation || false;
      
      // Pass through existing contacts from previous modules to maintain them
      if (previousResults?.contacts && previousResults.contacts.length > 0) {
        contacts.push(...previousResults.contacts);
      }
      
      for (const company of companies) {
        if (!company.name) continue; // Allow companies without websites to continue
        
        // Execute each enabled search strategy
        const subsearches = config.subsearches || {};
        const searchResults = [];

        for (const [searchId, enabled] of Object.entries(subsearches)) {
          if (!enabled) continue;

          const search = emailDiscoveryModule.searches.find(s => s.id === searchId);
          if (!search?.implementation) continue;

          try {
            // Include existing contacts for pattern prediction
            const existingContacts = previousResults?.contacts?.map(c => ({
              name: c.name || undefined,
              role: c.role || undefined,
              email: c.email || undefined
            })) || [];

            // Skip domain-specific searches if no website available
            if (!company.website && 
                (searchId.includes('domain') || searchId.includes('website') || searchId.includes('pattern'))) {
              continue;
            }
            
            const context = {
              companyName: company.name,
              companyWebsite: company.website,
              companyDomain: company.website ? new URL(company.website).hostname : undefined,
              existingContacts,
              config,
              options: {
                timeout: 30000,
                maxDepth: 2
              }
            };

            // Execute the search implementation
            const result = await search.implementation.execute(context);
            if (result.emails?.length > 0) {
              // Validate emails based on the configured approach
              if (useEnhancedValidation) {
                // Using enhanced validation
                for (const email of result.emails) {
                  if (isPlaceholderEmail(email)) continue;
                  
                  // Apply enhanced validation
                  const validationScore = validateEmailEnhanced(email);
                  
                  // Only include emails that pass validation threshold
                  if (validationScore >= 50) { // Lowered threshold from 65 to 50
                    contacts.push({
                      companyId: company.id,
                      email,
                      name: null, // Could be enriched later
                      probability: validationScore,
                      verificationSource: search.label + ' (Enhanced)',
                      validationMethod: 'enhanced'
                    });

                    validationScores[email] = validationScore;
                  }
                }
              } else {
                // Using standard validation
                const preValidatedEmails = result.emails.filter(email => {
                  const patternScore = validateEmailPattern(email);
                  return patternScore >= 40 && isValidBusinessEmail(email); // Lowered threshold from 50 to 40
                });

                if (preValidatedEmails.length > 0) {
                  // Add validated emails to contacts
                  for (const email of preValidatedEmails) {
                    const validationScore = result.metadata?.validationScore || 50;
                    
                    contacts.push({
                      companyId: company.id,
                      email,
                      name: null, // Could be enriched later
                      probability: validationScore,
                      verificationSource: search.label,
                      validationMethod: 'standard'
                    });

                    validationScores[email] = validationScore;
                  }
                }
              }
            }

            completedSearches.push(searchId);
            searchResults.push(result);

          } catch (error) {
            console.error(`Failed to execute search ${searchId}:`, error);
          }
        }
      }

      return {
        companies: [], // Email discovery module doesn't modify companies
        contacts,
        metadata: {
          moduleType: 'email_discovery',
          completedSearches,
          validationScores
        }
      };

    } catch (error) {
      console.error('Error in EmailDiscoveryModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    return result.contacts.length > 0 &&
           result.contacts.every(contact =>
             contact.email &&
             contact.probability &&
             contact.probability >= 30
           );
  }

  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;

    return {
      companies: previous.companies,
      contacts: [
        ...previous.contacts,
        ...current.contacts.filter(newContact =>
          !previous.contacts.some(existingContact =>
            existingContact.email === newContact.email
          )
        )
      ],
      metadata: {
        ...current.metadata,
        completedSearches: [
          ...(previous.metadata.completedSearches || []),
          ...(current.metadata.completedSearches || [])
        ],
        validationScores: {
          ...previous.metadata.validationScores,
          ...current.metadata.validationScores
        }
      }
    };
  }
}

// Local Sources Module Implementation
export class LocalSourcesModule implements SearchModule {
  async execute({ query, config }: SearchModuleContext): Promise<SearchModuleResult> {
    const completedSearches: string[] = [];
    const contacts: Array<Partial<Contact>> = [];
    const validationScores: Record<string, number> = {};

    try {
      // Execute local business associations search
      const result = await localBusinessAssociationsSearch.execute({
        companyName: query,
        config: config,
        options: {
          timeout: 30000,
          maxDepth: 2
        }
      });

      // Process results
      if (result.length > 0) {
        completedSearches.push('local-business-associations-search');

        // Add any discovered contacts
        const sourceData = result[0].metadata;
        if (sourceData && sourceData.emailDiscoveryEnabled) {
          // Track this search was completed
          completedSearches.push('local-business-associations');
        }
      }

      return {
        companies: [], // Local sources module doesn't modify companies
        contacts,
        metadata: {
          moduleType: 'local_sources',
          completedSearches,
          validationScores
        }
      };
    } catch (error) {
      console.error('Error in LocalSourcesModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    return result.metadata.completedSearches.length > 0;
  }
}

// Define validation strategies
export const VALIDATION_STRATEGIES = {
  strict: {
    company_overview: {
      minimumConfidence: 85,
      companyNamePenalty: 40,
      requireVerification: true
    },
    decision_maker: {
      minimumConfidence: 90,
      nameValidation: {
        minimumScore: 85,
        businessTermPenalty: 40,
        requireRole: true
      }
    },
    email_discovery: {
      minimumConfidence: 95,
      requireVerification: true,
      patternMatchThreshold: 0.9
    }
  },
  moderate: {
    company_overview: {
      minimumConfidence: 75,
      companyNamePenalty: 30,
      requireVerification: true
    },
    decision_maker: {
      minimumConfidence: 80,
      nameValidation: {
        minimumScore: 75,
        businessTermPenalty: 30,
        requireRole: true
      }
    },
    email_discovery: {
      minimumConfidence: 85,
      requireVerification: true,
      patternMatchThreshold: 0.8
    }
  },
  lenient: {
    company_overview: {
      minimumConfidence: 65,
      companyNamePenalty: 20,
      requireVerification: false
    },
    decision_maker: {
      minimumConfidence: 70,
      nameValidation: {
        minimumScore: 65,
        businessTermPenalty: 20,
        requireRole: false
      }
    },
    email_discovery: {
      minimumConfidence: 75,
      requireVerification: false,
      patternMatchThreshold: 0.7
    }
  },
  // Special strategy for legacy mode with focus on decision makers
  basic: {
    company_overview: {
      minimumConfidence: 50,
      companyNamePenalty: 10,
      requireVerification: false
    },
    decision_maker: {
      minimumConfidence: 30,
      nameValidation: {
        minimumScore: 30,
        businessTermPenalty: 15,
        requireRole: false,
        leadershipRoleBoost: 20,
        c_level_multiplier: 1.3,
        founder_multiplier: 1.5,
        director_multiplier: 1.2
      }
    },
    email_discovery: {
      minimumConfidence: 40,
      requireVerification: false,
      patternMatchThreshold: 0.5,
      allowPartialData: true
    }
  }
};

// Sequential Search Context
export interface SequentialSearchContext {
  query: string;
  sequence: SearchSequence;
  previousResults?: SequentialSearchResult;
  validationStrategy: keyof typeof VALIDATION_STRATEGIES;
}

// Sequential Search Result
export interface SequentialSearchResult {
  companies: any[];
  contacts: any[];
  emails: any[];
  metadata: {
    completedModules: string[];
    validationScores: Record<string, number>;
    moduleResults: Record<string, any>;
  };
}

// Module Registry
const MODULE_REGISTRY = {
  company_overview: () => new CompanyOverviewModule(),
  decision_maker: () => new DecisionMakerModule(),
  email_discovery: () => new EmailDiscoveryModule(),
  local_sources: () => new LocalSourcesModule()
};

export class SequentialSearchExecutor {
  async execute(context: SequentialSearchContext): Promise<SequentialSearchResult> {
    const { query, sequence, validationStrategy } = context;
    let currentResults: SequentialSearchResult = {
      companies: [],
      contacts: [],
      emails: [],
      metadata: {
        completedModules: [],
        validationScores: {},
        moduleResults: {}
      }
    };

    // Execute each module in sequence
    for (const moduleType of sequence.modules) {
      const module = MODULE_REGISTRY[moduleType]();
      const moduleConfig = sequence.moduleConfigs[moduleType] || {};
      const validationRules = VALIDATION_STRATEGIES[validationStrategy][moduleType];

      const moduleResult = await module.execute({
        query,
        config: {
          ...moduleConfig,
          validationRules: {
            ...moduleConfig.validationRules,
            ...validationRules
          }
        },
        previousResults: currentResults
      });

      // Merge results
      currentResults = this.mergeResults(currentResults, moduleResult, moduleType);

      // Track completion
      currentResults.metadata.completedModules.push(moduleType);
      currentResults.metadata.moduleResults[moduleType] = moduleResult;
    }

    return currentResults;
  }

  private mergeResults(current: SequentialSearchResult, moduleResult: any, moduleType: string): SequentialSearchResult {
    return {
      companies: moduleType === 'company_overview'
        ? [...moduleResult.companies]
        : current.companies,
      contacts: moduleResult.contacts && moduleResult.contacts.length > 0
        ? [...current.contacts, ...moduleResult.contacts.filter((newContact: any) => 
            !current.contacts.some((existingContact: any) => 
              (existingContact.name && newContact.name && existingContact.name === newContact.name) ||
              (existingContact.email && newContact.email && existingContact.email === newContact.email)
            )
          )]
        : current.contacts,
      emails: moduleType === 'email_discovery'
        ? [...current.emails, ...moduleResult.contacts.map((c: any) => c.email).filter(Boolean)]
        : current.emails,
      metadata: {
        ...current.metadata,
        validationScores: {
          ...current.metadata.validationScores,
          ...moduleResult.metadata.validationScores
        }
      }
    };
  }
}

export const sequentialSearchExecutor = new SequentialSearchExecutor();

// Import our module implementations
import { emailEnrichmentModule } from './search-logic/email-enrichment';
import { emailDeepDiveModule } from './search-logic/email-deepdive';
import { getRoleMultiplier, isLeadershipRole } from './search-logic/email-deepdive';

// Email Enrichment Module class
export class EmailEnrichmentModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    const completedSearches: string[] = [];
    const contacts = previousResults?.companies ? [...previousResults.contacts] : [];
    const validationScores: Record<string, number> = {};

    try {
      // Skip if no contacts to enrich
      if (contacts.length === 0) {
        console.log('No contacts to enrich in EmailEnrichmentModule');
        return {
          companies: previousResults?.companies || [],
          contacts: [],
          metadata: {
            moduleType: 'email_enrichment',
            completedSearches: ['empty-contacts'],
            validationScores: {}
          }
        };
      }

      const validatedContacts: Array<Partial<Contact>> = [];

      // Process each contact to validate and enrich their email
      for (const contact of contacts) {
        // Skip contacts without email
        if (!contact.email) continue;

        // Validate the email pattern
        const patternScore = validateEmailPattern(contact.email);
        validationScores[`${contact.name}_pattern`] = patternScore;

        // Check if email is a business domain 
        const businessDomainScore = isValidBusinessEmail(contact.email) ? 100 : 50;
        validationScores[`${contact.name}_domain`] = businessDomainScore;

        // Check if email is a placeholder
        const placeholderCheck = !isPlaceholderEmail(contact.email);
        validationScores[`${contact.name}_placeholder`] = placeholderCheck ? 100 : 0;

        // Calculate final score (weighted average)
        const finalScore = Math.round(
          (patternScore * 0.4) + 
          (businessDomainScore * 0.4) + 
          (placeholderCheck ? 20 : 0)
        );
        
        // Add to validated contacts if meets minimum threshold
        if (finalScore >= (config.validationRules?.minimumConfidence || 70)) {
          validatedContacts.push({
            ...contact,
            probability: finalScore,
            verificationSource: 'email_enrichment',
            verifiedAt: new Date()
          });
          
          // Record the final score
          validationScores[contact.name || 'unknown'] = finalScore;
          completedSearches.push(`validate-${contact.email}`);
        }
      }

      return {
        companies: previousResults?.companies || [],
        contacts: validatedContacts,
        metadata: {
          moduleType: 'email_enrichment',
          completedSearches,
          validationScores
        }
      };
    } catch (error) {
      console.error('Error in EmailEnrichmentModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    return result.contacts.some(contact => 
      contact.email && 
      contact.probability && 
      contact.probability >= 50 &&
      contact.verifiedAt
    );
  }

  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;

    const previousContacts = previous.contacts || [];
    const currentContacts = current.contacts || [];
    
    // Merge contacts, keeping the validated ones
    const mergedContacts = previousContacts.map(prevContact => {
      // Find matching contact in current results
      const matchingContact = currentContacts.find(
        currContact => currContact.email === prevContact.email
      );
      
      // If found a validated contact, merge them favoring the validated data
      if (matchingContact) {
        return {
          ...prevContact,
          ...matchingContact,
          probability: matchingContact.probability || prevContact.probability,
          verificationSource: matchingContact.verificationSource || prevContact.verificationSource,
          verifiedAt: matchingContact.verifiedAt || prevContact.verifiedAt
        };
      }
      
      // Otherwise keep the original contact
      return prevContact;
    });

    return {
      companies: previous.companies,
      contacts: mergedContacts,
      metadata: {
        ...current.metadata,
        completedSearches: [
          ...(previous.metadata.completedSearches || []),
          ...(current.metadata.completedSearches || [])
        ],
        validationScores: {
          ...previous.metadata.validationScores,
          ...current.metadata.validationScores
        }
      }
    };
  }
}

// Email Deepdive Module class
export class EmailDeepDiveModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    const completedSearches: string[] = [];
    const contacts = previousResults?.contacts || [];
    const validationScores: Record<string, number> = {};
    
    try {
      // Skip if no contacts to analyze further
      if (contacts.length === 0) {
        console.log('No contacts to deepdive in EmailDeepDiveModule');
        return {
          companies: previousResults?.companies || [],
          contacts: [],
          metadata: {
            moduleType: 'email_deepdive',
            completedSearches: ['empty-contacts'],
            validationScores: {}
          }
        };
      }

      // Extract company name from query or previous results
      let companyName = query;
      if (previousResults?.companies && previousResults.companies.length > 0) {
        companyName = previousResults.companies[0].name || query;
      }
      
      // Extract company domain from previous contacts
      let companyDomain: string | undefined;
      for (const contact of contacts) {
        if (contact.email) {
          const parts = contact.email.split('@');
          if (parts.length === 2) {
            companyDomain = parts[1];
            break;
          }
        }
      }
      
      // Focus on leadership contacts
      const leadershipContacts = contacts.filter(contact => {
        const role = contact.role?.toLowerCase() || '';
        return isLeadershipRole(role);
      });
      
      // If we have leadership contacts, focus on them, otherwise use all contacts
      const targetContacts = leadershipContacts.length > 0 ? leadershipContacts : contacts;
      const enhancedContacts: Array<Partial<Contact>> = [];
      
      // Deep analysis for each high-value contact
      for (const contact of targetContacts) {
        if (!contact.name) continue;
        
        try {
          // Improve validation for leadership roles with higher confidence
          const roleMultiplier = getRoleMultiplier(contact.role);
          
          // Adjust confidence based on role importance
          const baseScore = contact.probability || 75;
          const adjustedScore = Math.min(Math.round(baseScore * roleMultiplier), 100);
          
          // If email exists, perform domain analysis
          if (contact.email && companyDomain) {
            const emailDomain = contact.email.split('@')[1];
            const domainMatch = emailDomain === companyDomain ? 10 : 0;
            
            // Add to final contact with enhanced confidence
            enhancedContacts.push({
              ...contact,
              probability: Math.min(adjustedScore + domainMatch, 100),
              verificationSource: 'email_deepdive',
              verifiedAt: new Date(),
              enrichedAt: new Date(),
              score: Math.min(adjustedScore + domainMatch, 100),
            });
            
            // Record validation scores
            validationScores[contact.name] = Math.min(adjustedScore + domainMatch, 100);
            completedSearches.push(`deepdive-${contact.email}`);
          } else {
            // Just apply role adjustments if no email
            enhancedContacts.push({
              ...contact,
              probability: adjustedScore,
              score: adjustedScore,
              verificationSource: 'email_deepdive',
              verifiedAt: new Date(),
              enrichedAt: new Date()
            });
            
            validationScores[contact.name] = adjustedScore;
            completedSearches.push(`deepdive-role-analysis`);
          }
        } catch (error) {
          console.error(`Error analyzing contact ${contact.name}:`, error);
        }
      }
      
      return {
        companies: previousResults?.companies || [],
        contacts: enhancedContacts,
        metadata: {
          moduleType: 'email_deepdive',
          completedSearches,
          validationScores
        }
      };
    } catch (error) {
      console.error('Error in EmailDeepDiveModule:', error);
      throw error;
    }
  }

  async validate(result: SearchModuleResult): Promise<boolean> {
    return result.contacts.length > 0;
  }

  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;

    const previousContacts = previous.contacts || [];
    const currentContacts = current.contacts || [];
    
    // For deepdive, we need to merge enhancing the previous contacts with new scores
    const mergedContacts = previousContacts.map(prevContact => {
      // Find matching contact in current deepdive results
      const matchingContact = currentContacts.find(
        currContact => currContact.name === prevContact.name || currContact.email === prevContact.email
      );
      
      if (matchingContact) {
        // Keep the highest confidence/probability score
        const probability = Math.max(
          matchingContact.probability || 0, 
          prevContact.probability || 0
        );
        
        return {
          ...prevContact,
          ...matchingContact,
          // Always keep the higher confidence score
          probability,
          score: probability,
          // Preserve the deepdive verification markers
          verificationSource: matchingContact.verificationSource || prevContact.verificationSource,
          verifiedAt: matchingContact.verifiedAt || prevContact.verifiedAt,
          enrichedAt: matchingContact.enrichedAt || prevContact.enrichedAt
        };
      }
      
      return prevContact;
    });

    return {
      companies: previous.companies,
      contacts: mergedContacts,
      metadata: {
        ...current.metadata,
        completedSearches: [
          ...(previous.metadata.completedSearches || []),
          ...(current.metadata.completedSearches || [])
        ],
        validationScores: {
          ...previous.metadata.validationScores,
          ...current.metadata.validationScores
        }
      }
    };
  }
}

export function createSearchModule(moduleType: string): SearchModule {
    switch (moduleType) {
        case 'company_overview':
            return new CompanyOverviewModule();
        case 'decision_maker':
            return new DecisionMakerModule();
        case 'email_discovery':
            return new EmailDiscoveryModule();
        case 'email_enrichment':
            return new EmailEnrichmentModule();
        case 'email_deepdive':
            return new EmailDeepDiveModule();
        case 'local_sources':
            return new LocalSourcesModule();
        default:
            throw new Error(`Unknown module type: ${moduleType}`);
    }
}