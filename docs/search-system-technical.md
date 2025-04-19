# Technical Documentation: Search & Refinement System

This document provides a detailed technical breakdown of the three main data processing flows with exact code snippets showing the implementation of each step.

## Table of Contents
1. [Company Search Process](#company-search-process)
2. [Key Contact Identification Process](#key-contact-identification-process)
3. [Email Discovery Process](#email-discovery-process)

## Company Search Process

### 1. Input Processing
The search begins with processing user input and selecting the appropriate search module:

```typescript
// server/lib/search-logic.ts
export async function searchCompanies(query: string): Promise<string[]> {
  try {
    // Default module is company overview
    const moduleType = SEARCH_MODULES.COMPANY_OVERVIEW;
    const moduleConfig = getModuleConfig(moduleType);
    
    // Create search module instance based on type
    const searchModule = createSearchModule(moduleType);
    
    // Execute search with query and config
    const results = await searchModule.execute({
      query,
      config: moduleConfig,
    });
    
    // Validate results against module's validation rules
    const isValid = await searchModule.validate(results);
    
    if (!isValid) {
      console.error("Search results did not pass validation");
      return [];
    }
    
    // Extract and format company names from results
    return results.companies.map((company) => company.name || "Unknown Company");
  } catch (error) {
    console.error("Error searching companies:", error);
    return [];
  }
}
```

### 2. Search Execution
The selected module (e.g., CompanyOverviewModule) executes the search strategy:

```typescript
// server/lib/search-modules.ts
export class CompanyOverviewModule implements SearchModule {
  async execute({ query, config }: SearchModuleContext): Promise<SearchModuleResult> {
    console.log(`Executing company overview search for: ${query}`);
    
    // Initialize result structure
    const result: SearchModuleResult = {
      companies: [],
      contacts: [],
      metadata: {
        moduleType: SEARCH_MODULES.COMPANY_OVERVIEW,
        completedSearches: [],
        validationScores: {},
      },
    };
    
    try {
      // Execute primary company search through API
      const companyResults = await this.executeSubsearches(query, config);
      
      if (companyResults.length > 0) {
        // Process and add companies to results
        result.companies = companyResults.map((companyData) => ({
          name: companyData.name,
          website: companyData.website,
          description: companyData.description,
          industry: companyData.industry,
          size: companyData.size,
          location: companyData.location,
          validationScore: companyData.validationScore || 0,
        }));
        
        // Record which searches were completed
        result.metadata.completedSearches.push('companyOverview');
      }
      
      return result;
    } catch (error) {
      console.error("Error in CompanyOverviewModule execution:", error);
      return result;
    }
  }
  
  private async executeSubsearches(query: string, config: SearchModuleConfig): Promise<any[]> {
    // Extract search sections from config
    const { searchSections } = config;
    const companySearchSection = searchSections.companySearch;
    
    if (!companySearchSection) {
      return [];
    }
    
    // Execute all defined searches in the section
    const searchPromises = companySearchSection.searches.map(async (search) => {
      // Construct prompt for the search
      const prompt = `${search.promptPrefix} ${query} ${search.promptSuffix || ''}`;
      
      // Call API to perform the search
      return analyzeWithPerplexity(prompt, search.analysisModel || 'default');
    });
    
    const searchResults = await Promise.all(searchPromises);
    
    // Process raw search results into structured company data
    return processCompanyResults(searchResults, query);
  }
  
  async validate(result: SearchModuleResult): Promise<boolean> {
    // Implement validation logic to ensure results meet quality standards
    if (result.companies.length === 0) {
      return false;
    }
    
    // Check that essential fields are present
    const validCompanies = result.companies.filter(
      (company) => company.name && company.website
    );
    
    // Ensure validation score meets minimum threshold
    const sufficientValidation = validCompanies.some(
      (company) => (company.validationScore || 0) >= 60
    );
    
    return validCompanies.length > 0 && sufficientValidation;
  }
}
```

### 3. API Integration
Perplexity API is called to retrieve company information:

```typescript
// server/lib/perplexity.ts
export async function analyzeWithPerplexity(
  prompt: string,
  model: string = "sonar-medium-online"
): Promise<any> {
  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY environment variable is not set");
    }

    const data = {
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful AI that provides detailed and accurate business intelligence."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    };

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error in Perplexity API call:", error);
    throw error;
  }
}
```

### 4. Company Analysis
Raw data is processed to extract structured information:

```typescript
// server/lib/results-analysis/company-analysis.ts
export function analyzeCompanyData(rawData: string): CompanyAnalysisResult {
  // Parse the raw text into structured data
  const extractedData = extractCompanyDetails(rawData);
  
  // Normalize and clean the extracted data
  const normalizedData = normalizeCompanyData(extractedData);
  
  // Validate the data for completeness and consistency
  const validationScore = validateCompanyData(normalizedData);
  
  return {
    ...normalizedData,
    validationScore,
    rawAnalysis: rawData
  };
}

function extractCompanyDetails(text: string): Partial<Company> {
  // Extract company name using regex or NLP techniques
  const nameMatch = text.match(/Company Name:[\s\n]*([^\n]+)/i);
  const name = nameMatch ? nameMatch[1].trim() : undefined;
  
  // Extract website
  const websiteMatch = text.match(/Website:[\s\n]*([^\n]+)/i) || 
                       text.match(/URL:[\s\n]*([^\n]+)/i) ||
                       text.match(/(https?:\/\/[^\s]+)/i);
  const website = websiteMatch ? websiteMatch[1].trim() : undefined;
  
  // Extract other fields similarly
  // ...
  
  return {
    name,
    website,
    // Other extracted fields
  };
}

function validateCompanyData(company: Partial<Company>): number {
  let score = 0;
  const maxScore = 100;
  
  // Score based on presence of crucial fields
  if (company.name) score += 20;
  if (company.website) score += 20;
  if (company.industry) score += 15;
  if (company.description && company.description.length > 100) score += 15;
  if (company.location) score += 15;
  if (company.size) score += 15;
  
  // Additional validation rules
  // ...
  
  return Math.min(score, maxScore);
}
```

### 5. Filtering & Scoring
Companies are filtered and scored based on various criteria:

```typescript
// server/lib/results-analysis/prospect-filtering.ts
export function filterProspects(
  companies: Partial<Company>[],
  filterCriteria: FilterCriteria
): Partial<Company>[] {
  return companies.filter(company => {
    // Apply industry filter
    if (filterCriteria.industries && filterCriteria.industries.length > 0) {
      const industryMatch = company.industry && 
        filterCriteria.industries.some(ind => 
          company.industry?.toLowerCase().includes(ind.toLowerCase())
        );
      if (!industryMatch) return false;
    }
    
    // Apply company size filter
    if (filterCriteria.companySize) {
      const sizeCriteria = filterCriteria.companySize;
      const companySize = parseCompanySize(company.size || "");
      
      if (companySize.min < sizeCriteria.min || companySize.max > sizeCriteria.max) {
        return false;
      }
    }
    
    // Apply location filter
    if (filterCriteria.locations && filterCriteria.locations.length > 0) {
      const locationMatch = company.location &&
        filterCriteria.locations.some(loc => 
          company.location?.toLowerCase().includes(loc.toLowerCase())
        );
      if (!locationMatch) return false;
    }
    
    // Apply validation score threshold
    if (filterCriteria.minValidationScore && 
        (company.validationScore || 0) < filterCriteria.minValidationScore) {
      return false;
    }
    
    return true;
  });
}

// server/lib/results-analysis/score-combination.ts
export function calculateCompositScore(
  company: Partial<Company>,
  weights: ScoreWeights
): number {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Calculate validation score component
  if (company.validationScore !== undefined) {
    totalScore += company.validationScore * weights.validation;
    totalWeight += weights.validation;
  }
  
  // Calculate relevance score component
  if (company.relevanceScore !== undefined) {
    totalScore += company.relevanceScore * weights.relevance;
    totalWeight += weights.relevance;
  }
  
  // Calculate data completeness score
  const completenessScore = calculateDataCompleteness(company);
  totalScore += completenessScore * weights.completeness;
  totalWeight += weights.completeness;
  
  // Calculate final normalized score
  return totalWeight > 0 ? (totalScore / totalWeight) : 0;
}

function calculateDataCompleteness(company: Partial<Company>): number {
  const requiredFields = ['name', 'website', 'industry', 'description', 'location', 'size'];
  const presentFields = requiredFields.filter(field => !!company[field as keyof typeof company]);
  
  return (presentFields.length / requiredFields.length) * 100;
}
```

## Key Contact Identification Process

### 1. Contact Search Initiation
The process starts after a company has been identified:

```typescript
// server/lib/search-modules.ts
export class DecisionMakerModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    console.log(`Executing decision maker search for: ${query}`);
    
    // Initialize result structure using previous results if available
    const result: SearchModuleResult = {
      companies: previousResults?.companies || [],
      contacts: previousResults?.contacts || [],
      metadata: {
        moduleType: SEARCH_MODULES.DECISION_MAKER,
        completedSearches: [],
        validationScores: {},
      },
    };
    
    // Use company context from previous results if available
    const companyContext = previousResults?.companies && previousResults.companies.length > 0
      ? previousResults.companies[0]
      : null;
      
    if (!companyContext?.name) {
      console.error("Decision maker module requires company context");
      return result;
    }
    
    try {
      // Execute contact search based on company context
      const contactResults = await this.searchContacts(companyContext, config);
      
      if (contactResults.length > 0) {
        // Add new contacts to results
        result.contacts = [...result.contacts, ...contactResults];
        
        // Record which searches were completed
        result.metadata.completedSearches.push('decisionMakerSearch');
      }
      
      return result;
    } catch (error) {
      console.error("Error in DecisionMakerModule execution:", error);
      return result;
    }
  }
  
  private async searchContacts(
    company: Partial<Company>,
    config: SearchModuleConfig
  ): Promise<Partial<Contact>[]> {
    // Extract search sections from config
    const { searchSections } = config;
    const contactSearchSection = searchSections.contactSearch;
    
    if (!contactSearchSection) {
      return [];
    }
    
    // Construct search query using company details
    const searchQuery = `${company.name} ${company.website || ''} leadership team executive contacts`;
    
    // Execute the contact search through API
    const searchResults = await searchContactDetails(searchQuery, company);
    
    // Process and validate contact results
    return processContactResults(searchResults, company);
  }
  
  async validate(result: SearchModuleResult): Promise<boolean> {
    // Validate that sufficient contacts were found
    if (result.contacts.length === 0) {
      return false;
    }
    
    // Check that essential contact fields are present
    const validContacts = result.contacts.filter(
      (contact) => contact.name && contact.role
    );
    
    // Check that at least one contact has a decision-making role
    const hasDecisionMaker = validContacts.some(
      (contact) => isDecisionMakingRole(contact.role || '')
    );
    
    return validContacts.length > 0 && hasDecisionMaker;
  }
  
  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;
    
    // Combine metadata
    const combinedMetadata = {
      moduleType: current.metadata.moduleType,
      completedSearches: [
        ...new Set([
          ...(previous.metadata.completedSearches || []),
          ...(current.metadata.completedSearches || [])
        ])
      ],
      validationScores: {
        ...(previous.metadata.validationScores || {}),
        ...(current.metadata.validationScores || {})
      }
    };
    
    // Merge contact lists, avoiding duplicates
    const existingContactIds = new Set(
      previous.contacts.map(c => c.id).filter(Boolean) as number[]
    );
    
    const newContacts = current.contacts.filter(
      c => !c.id || !existingContactIds.has(c.id)
    );
    
    return {
      companies: current.companies.length > 0 ? current.companies : previous.companies,
      contacts: [...previous.contacts, ...newContacts],
      metadata: combinedMetadata
    };
  }
}
```

### 2. Leadership Discovery
The system searches for leadership and decision-makers:

```typescript
// server/lib/api-interactions.ts
export async function searchContactDetails(
  query: string,
  companyContext: Partial<Company>
): Promise<any> {
  try {
    // Construct prompt for contact search
    const prompt = `
      Find key decision makers and leadership contacts for the company: ${companyContext.name}.
      
      Include the following details for each contact:
      - Full name
      - Title/role
      - Department
      - Level of seniority (C-level, VP, Director, etc.)
      - LinkedIn profile URL if available
      - Email address pattern if known
      
      Company context:
      ${JSON.stringify(companyContext, null, 2)}
      
      Return results in a structured format with name, role, department, seniority, and contact information.
    `;
    
    // Call Perplexity API for detailed analysis
    const response = await analyzeWithPerplexity(prompt);
    
    // Parse the structured response
    return parseContactSearchResponse(response);
  } catch (error) {
    console.error("Error searching contact details:", error);
    throw error;
  }
}

function parseContactSearchResponse(response: string): any {
  try {
    // Attempt to parse as JSON if response is in JSON format
    return JSON.parse(response);
  } catch (e) {
    // If not JSON, use regex or other parsing methods to extract structured data
    const contacts = [];
    
    // Extract contact blocks from text
    const contactBlocks = response.split(/(?:\r?\n){2,}/);
    
    for (const block of contactBlocks) {
      // Extract name, role, etc. using regex
      const nameMatch = block.match(/Name:[\s\n]*([^\n]+)/i);
      const roleMatch = block.match(/Title|Role:[\s\n]*([^\n]+)/i);
      const departmentMatch = block.match(/Department:[\s\n]*([^\n]+)/i);
      const emailMatch = block.match(/Email:[\s\n]*([^\n]+)/i);
      
      if (nameMatch) {
        contacts.push({
          name: nameMatch[1].trim(),
          role: roleMatch ? roleMatch[1].trim() : undefined,
          department: departmentMatch ? departmentMatch[1].trim() : undefined,
          email: emailMatch ? emailMatch[1].trim() : undefined,
        });
      }
    }
    
    return contacts;
  }
}
```

### 3. Name Validation
Each contact name is validated for legitimacy:

```typescript
// server/lib/results-analysis/contact-name-validation.ts
export interface ValidationOptions {
  allowCompanyNames: boolean;
  allowDepartmentNames: boolean;
  minimumNameLength: number;
  requireFullName: boolean;
}

export async function validateContactName(
  name: string,
  options: ValidationOptions = {
    allowCompanyNames: false,
    allowDepartmentNames: false,
    minimumNameLength: 4,
    requireFullName: true
  }
): Promise<{ isValid: boolean; confidenceScore: number; reasons: string[] }> {
  if (!name || typeof name !== 'string') {
    return { isValid: false, confidenceScore: 0, reasons: ['Name is empty or invalid'] };
  }
  
  const cleanName = name.trim();
  const reasons: string[] = [];
  
  // Check minimum length
  if (cleanName.length < options.minimumNameLength) {
    reasons.push(`Name is too short (${cleanName.length} chars)`);
    return { isValid: false, confidenceScore: 0, reasons };
  }
  
  // Check for generic terms
  const genericTerms = [
    'info', 'sales', 'support', 'contact', 'hello', 'admin',
    'webmaster', 'service', 'manager', 'team', 'help', 'general'
  ];
  
  if (genericTerms.some(term => cleanName.toLowerCase() === term)) {
    reasons.push('Name appears to be a generic term');
    return { isValid: false, confidenceScore: 0, reasons };
  }
  
  // Check if it looks like a department name
  if (!options.allowDepartmentNames) {
    const departmentTerms = [
      'department', 'division', 'sales', 'marketing', 'finance',
      'hr', 'support', 'customer', 'service', 'team'
    ];
    
    if (departmentTerms.some(term => 
      cleanName.toLowerCase().includes(term)
    )) {
      reasons.push('Name appears to be a department');
      return { isValid: false, confidenceScore: 10, reasons };
    }
  }
  
  // Check if it's a company name
  if (!options.allowCompanyNames) {
    const companyIndicators = [
      'inc', 'llc', 'ltd', 'corporation', 'corp', 'company',
      'group', 'gmbh', 'limited', 'holdings', 'enterprises'
    ];
    
    if (companyIndicators.some(term => 
      cleanName.toLowerCase().includes(term)
    )) {
      reasons.push('Name appears to be a company name');
      return { isValid: false, confidenceScore: 20, reasons };
    }
  }
  
  // Check for full name pattern (first last)
  if (options.requireFullName) {
    const nameParts = cleanName.split(/\s+/).filter(Boolean);
    
    if (nameParts.length < 2) {
      reasons.push('Not a full name (missing surname)');
      return { isValid: false, confidenceScore: 30, reasons };
    }
  }
  
  // Calculate confidence score
  let confidenceScore = 100;
  
  // Reduce score for suspicious patterns
  if (cleanName.includes('@')) confidenceScore -= 40;
  if (cleanName.includes('http')) confidenceScore -= 50;
  if (/^\d+$/.test(cleanName)) confidenceScore -= 80;
  
  // Adjust score based on name characteristics
  const nameWords = cleanName.split(/\s+/).filter(Boolean);
  if (nameWords.length > 4) confidenceScore -= 20; // Unusually long name
  
  // Check capitalization pattern (proper names typically have capital first letters)
  const properCapitalization = nameWords.every(word => 
    word.length > 0 && word[0] === word[0].toUpperCase()
  );
  
  if (!properCapitalization) confidenceScore -= 15;
  
  // Final validation
  const isValid = confidenceScore >= 70;
  
  if (!isValid && reasons.length === 0) {
    reasons.push('Failed generic name validation checks');
  }
  
  return {
    isValid,
    confidenceScore: Math.max(0, confidenceScore),
    reasons
  };
}
```

### 4. Role Classification
The system classifies roles to identify decision-makers:

```typescript
// server/lib/results-analysis/contact-analysis.ts
export function classifyRole(role: string): {
  department: string;
  seniority: number;
  isDecisionMaker: boolean;
} {
  if (!role) {
    return { department: 'Unknown', seniority: 0, isDecisionMaker: false };
  }
  
  const roleLC = role.toLowerCase();
  
  // Classify department
  let department = 'General';
  
  if (roleLC.includes('ceo') || roleLC.includes('chief executive') || roleLC.includes('president')) {
    department = 'Executive';
  } else if (roleLC.includes('cto') || roleLC.includes('tech') || roleLC.includes('developer') || roleLC.includes('engineer')) {
    department = 'Technology';
  } else if (roleLC.includes('cfo') || roleLC.includes('finance') || roleLC.includes('accounting')) {
    department = 'Finance';
  } else if (roleLC.includes('cmo') || roleLC.includes('market') || roleLC.includes('brand')) {
    department = 'Marketing';
  } else if (roleLC.includes('sales') || roleLC.includes('account') || roleLC.includes('business development')) {
    department = 'Sales';
  } else if (roleLC.includes('hr') || roleLC.includes('human resource') || roleLC.includes('talent')) {
    department = 'HR';
  } else if (roleLC.includes('product') || roleLC.includes('design')) {
    department = 'Product';
  } else if (roleLC.includes('operation')) {
    department = 'Operations';
  }
  
  // Determine seniority level (0-100)
  let seniority = 0;
  
  if (roleLC.includes('chief') || roleLC.includes('ceo') || roleLC.includes('cto') || roleLC.includes('cfo') || roleLC.includes('c-suite')) {
    seniority = 100;
  } else if (roleLC.includes('president') || roleLC.includes('founder') || roleLC.includes('owner')) {
    seniority = 95;
  } else if (roleLC.includes('vice president') || roleLC.includes('vp')) {
    seniority = 85;
  } else if (roleLC.includes('director')) {
    seniority = 75;
  } else if (roleLC.includes('head of')) {
    seniority = 70;
  } else if (roleLC.includes('senior') || roleLC.includes('sr.') || roleLC.includes('lead')) {
    seniority = 60;
  } else if (roleLC.includes('manager')) {
    seniority = 50;
  } else if (roleLC.includes('specialist') || roleLC.includes('consultant')) {
    seniority = 40;
  } else if (roleLC.includes('associate') || roleLC.includes('assistant')) {
    seniority = 30;
  } else if (roleLC.includes('intern')) {
    seniority = 10;
  }
  
  // Determine decision-making capacity
  const isDecisionMaker = seniority >= 70;
  
  return { department, seniority, isDecisionMaker };
}

export function enrichContactRoleData(contact: Partial<Contact>): Partial<Contact> {
  if (!contact.role) {
    return contact;
  }
  
  const { department, seniority, isDecisionMaker } = classifyRole(contact.role);
  
  return {
    ...contact,
    department: contact.department || department,
    seniority,
    isDecisionMaker
  };
}
```

### 5. Contact Enrichment
Contact data is enriched with additional information:

```typescript
// server/storage/contacts.ts
async enrichContact(
  id: number,
  contactData: Partial<Contact>
): Promise<Contact> {
  // Retrieve the existing contact
  const existingContact = await this.getContact(id);
  
  if (!existingContact) {
    throw new Error(`Contact with ID ${id} not found`);
  }
  
  // Calculate validation scores for the contact data
  const validationResult = await validateContactData(contactData);
  
  // Update confidence score based on new data
  const newConfidenceScore = calculateContactConfidenceScore(
    existingContact,
    contactData,
    validationResult
  );
  
  // Merge existing data with new data, prioritizing higher quality information
  const mergedData = mergeContactData(existingContact, contactData, validationResult);
  
  // Update the contact in the database
  const updatedContact = await this.db
    .update(contacts)
    .set({
      ...mergedData,
      confidenceScore: newConfidenceScore,
      lastUpdated: new Date(),
      validationStatus: 'enriched',
    })
    .where(eq(contacts.id, id))
    .returning()
    .then((res) => res[0]);
    
  return updatedContact;
}

function calculateContactConfidenceScore(
  existingContact: Contact,
  newData: Partial<Contact>,
  validation: any
): number {
  // Start with existing confidence score
  let score = existingContact.confidenceScore || 0;
  
  // Adjust based on validation results
  if (validation.nameValidation?.confidenceScore) {
    // Weight name validation at 30% of total score
    score = (score * 0.7) + (validation.nameValidation.confidenceScore * 0.3);
  }
  
  // Add points for newly added fields
  if (newData.email && !existingContact.email) score += 15;
  if (newData.phone && !existingContact.phone) score += 10;
  if (newData.linkedin && !existingContact.linkedin) score += 8;
  
  // Cap at 100
  return Math.min(Math.round(score), 100);
}

function mergeContactData(
  existing: Contact,
  newData: Partial<Contact>,
  validation: any
): Partial<Contact> {
  // Create the merged data object starting with existing data
  const merged: Partial<Contact> = { ...existing };
  
  // For each field in newData, apply merging rules
  Object.entries(newData).forEach(([key, value]) => {
    // Skip empty values
    if (value === null || value === undefined || value === '') {
      return;
    }
    
    const existingValue = existing[key as keyof Contact];
    
    // If field doesn't exist in the original, use new value
    if (!existingValue) {
      merged[key as keyof Contact] = value as any;
      return;
    }
    
    // Apply specific merging rules based on field type
    switch (key) {
      case 'name':
        // Use higher confidence name
        if ((validation.nameValidation?.confidenceScore || 0) > 
            (existing.nameConfidenceScore || 0)) {
          merged.name = value as string;
          merged.nameConfidenceScore = validation.nameValidation.confidenceScore;
        }
        break;
        
      case 'email':
        // Use validated email over unvalidated email
        if ((validation.emailValidation?.score || 0) > 
            (existing.emailValidationScore || 0)) {
          merged.email = value as string;
          merged.emailValidationScore = validation.emailValidation.score;
        }
        break;
        
      // Similar logic for other fields
      // ...
        
      default:
        // For other fields, prefer new value if it's more complete
        if (typeof value === 'string' && typeof existingValue === 'string' &&
            value.length > existingValue.length) {
          merged[key as keyof Contact] = value as any;
        }
    }
  });
  
  return merged;
}
```

## Email Discovery Process

### 1. Pattern Detection
The system identifies probable email patterns:

```typescript
// server/lib/search-modules.ts
export class EmailDiscoveryModule implements SearchModule {
  async execute({ query, config, previousResults }: SearchModuleContext): Promise<SearchModuleResult> {
    console.log(`Executing email discovery for: ${query}`);
    
    // Initialize result structure using previous results if available
    const result: SearchModuleResult = {
      companies: previousResults?.companies || [],
      contacts: previousResults?.contacts || [],
      metadata: {
        moduleType: SEARCH_MODULES.EMAIL_DISCOVERY,
        completedSearches: [],
        validationScores: {},
      },
    };
    
    // Use company and contact context from previous results
    const company = previousResults?.companies && previousResults.companies.length > 0
      ? previousResults.companies[0]
      : null;
      
    const contacts = previousResults?.contacts || [];
    
    if (!company || !contacts.length) {
      console.error("Email discovery module requires company and contact context");
      return result;
    }
    
    try {
      // Extract domain from company website
      const domain = extractDomainFromWebsite(company.website);
      
      if (!domain) {
        console.error("Could not extract domain from company website");
        return result;
      }
      
      // Detect common email patterns for the company
      const patterns = await this.detectEmailPatterns(company, contacts, domain);
      
      // Generate and validate email addresses
      const updatedContacts = await this.generateEmails(contacts, patterns, domain);
      
      if (updatedContacts.length > 0) {
        // Update contacts with discovered emails
        result.contacts = updatedContacts;
        
        // Record which searches were completed
        result.metadata.completedSearches.push('emailDiscovery');
      }
      
      return result;
    } catch (error) {
      console.error("Error in EmailDiscoveryModule execution:", error);
      return result;
    }
  }
  
  private async detectEmailPatterns(
    company: Partial<Company>,
    contacts: Partial<Contact>[],
    domain: string
  ): Promise<string[]> {
    // Common email patterns to check
    const commonPatterns = [
      "first.last@domain",
      "first@domain",
      "flast@domain",
      "firstl@domain",
      "first_last@domain",
      "last.first@domain",
      "lastf@domain"
    ];
    
    // If we already have some email addresses, analyze them for patterns
    const existingEmails = contacts
      .filter(c => c.email && c.email.includes('@') && c.email.includes(domain))
      .map(c => c.email) as string[];
    
    if (existingEmails.length > 0) {
      // Detect patterns from existing emails
      return detectPatternsFromExistingEmails(existingEmails, contacts);
    }
    
    // If no existing emails, search for common patterns
    const prompt = `
      Find the email pattern used by ${company.name} (domain: ${domain}).
      
      Consider these common patterns:
      ${commonPatterns.join('\n')}
      
      Company details:
      ${JSON.stringify(company, null, 2)}
      
      Return the most likely email pattern used by this company.
    `;
    
    const response = await analyzeWithPerplexity(prompt);
    
    // Parse the response to extract the detected pattern
    const detectedPattern = extractEmailPatternFromResponse(response);
    
    return detectedPattern ? [detectedPattern] : commonPatterns.slice(0, 3);
  }
  
  private async generateEmails(
    contacts: Partial<Contact>[],
    patterns: string[],
    domain: string
  ): Promise<Partial<Contact>[]> {
    // Generate and validate email addresses for each contact
    const updatedContacts = await Promise.all(contacts.map(async (contact) => {
      // Skip contacts that already have validated emails
      if (contact.email && contact.emailValidationScore && contact.emailValidationScore > 70) {
        return contact;
      }
      
      // Generate candidate emails based on patterns
      const candidateEmails = generateCandidateEmails(contact, patterns, domain);
      
      if (candidateEmails.length === 0) {
        return contact;
      }
      
      // Validate the candidate emails
      const validationResult = await validateEmails(candidateEmails);
      
      // Select the best email based on validation results
      const bestEmail = selectBestEmail(candidateEmails, validationResult);
      
      if (!bestEmail) {
        return contact;
      }
      
      // Return contact with the discovered email
      return {
        ...contact,
        email: bestEmail,
        emailValidationScore: validationResult.score,
        emailValidationDetails: validationResult.validationDetails
      };
    }));
    
    return updatedContacts;
  }
  
  async validate(result: SearchModuleResult): Promise<boolean> {
    // Ensure we have contacts with email addresses
    const contactsWithEmails = result.contacts.filter(
      contact => contact.email && contact.email.includes('@')
    );
    
    if (contactsWithEmails.length === 0) {
      return false;
    }
    
    // Check that emails have sufficient validation scores
    const validatedEmails = contactsWithEmails.filter(
      contact => (contact.emailValidationScore || 0) >= 50
    );
    
    // Successful if at least some percentage of contacts have validated emails
    const successRate = validatedEmails.length / result.contacts.length;
    return successRate >= 0.3; // At least 30% success rate
  }
  
  merge(current: SearchModuleResult, previous?: SearchModuleResult): SearchModuleResult {
    if (!previous) return current;
    
    // Create a map of contacts by ID or name for quick lookup
    const previousContactsMap = new Map<string, Partial<Contact>>();
    
    previous.contacts.forEach(contact => {
      const key = contact.id ? `id:${contact.id}` : `name:${contact.name}`;
      previousContactsMap.set(key, contact);
    });
    
    // Merge contacts, updating with new email information when available
    const mergedContacts = current.contacts.map(currentContact => {
      // Find matching contact in previous results
      const key = currentContact.id 
        ? `id:${currentContact.id}` 
        : `name:${currentContact.name}`;
      
      const previousContact = previousContactsMap.get(key);
      
      if (!previousContact) {
        return currentContact;
      }
      
      // If current contact has a better email, use it
      if (currentContact.email && currentContact.emailValidationScore &&
          (!previousContact.email || 
           !previousContact.emailValidationScore ||
           currentContact.emailValidationScore > previousContact.emailValidationScore)) {
        
        return {
          ...previousContact,
          email: currentContact.email,
          emailValidationScore: currentContact.emailValidationScore,
          emailValidationDetails: currentContact.emailValidationDetails
        };
      }
      
      // Otherwise, keep the previous contact data
      return previousContact;
    });
    
    // Add any contacts from previous that aren't in current
    previous.contacts.forEach(previousContact => {
      const key = previousContact.id 
        ? `id:${previousContact.id}` 
        : `name:${previousContact.name}`;
      
      const exists = mergedContacts.some(c => {
        const cKey = c.id ? `id:${c.id}` : `name:${c.name}`;
        return cKey === key;
      });
      
      if (!exists) {
        mergedContacts.push(previousContact);
      }
    });
    
    return {
      companies: current.companies.length > 0 ? current.companies : previous.companies,
      contacts: mergedContacts,
      metadata: {
        moduleType: current.metadata.moduleType,
        completedSearches: [
          ...new Set([
            ...(previous.metadata.completedSearches || []),
            ...(current.metadata.completedSearches || [])
          ])
        ],
        validationScores: {
          ...(previous.metadata.validationScores || {}),
          ...(current.metadata.validationScores || {})
        }
      }
    };
  }
}
```

### 2. Email Generation
The system generates email addresses based on patterns:

```typescript
// server/lib/search-logic/email-discovery/email-generator.ts
function generateCandidateEmails(
  contact: Partial<Contact>,
  patterns: string[],
  domain: string
): string[] {
  if (!contact.name) {
    return [];
  }
  
  // Parse the name into components
  const nameParts = parseContactName(contact.name);
  
  if (!nameParts.firstName || !nameParts.lastName) {
    return [];
  }
  
  // Generate emails based on each pattern
  return patterns.map(pattern => {
    const email = applyEmailPattern(pattern, nameParts, domain);
    return email;
  }).filter(Boolean) as string[];
}

function parseContactName(name: string): {
  firstName: string;
  lastName: string;
  middleName?: string;
  initials: {
    first: string;
    middle?: string;
    last: string;
  };
} {
  // Split the name into parts
  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '', initials: { first: '', last: '' } };
  }
  
  if (parts.length === 1) {
    // Just one name part
    return {
      firstName: parts[0],
      lastName: '',
      initials: {
        first: parts[0].charAt(0).toLowerCase(),
        last: ''
      }
    };
  }
  
  // Multiple parts
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  
  let middleName;
  if (parts.length > 2) {
    middleName = parts.slice(1, parts.length - 1).join(' ');
  }
  
  return {
    firstName,
    lastName,
    middleName,
    initials: {
      first: firstName.charAt(0).toLowerCase(),
      middle: middleName ? middleName.charAt(0).toLowerCase() : undefined,
      last: lastName.charAt(0).toLowerCase()
    }
  };
}

function applyEmailPattern(
  pattern: string,
  nameParts: ReturnType<typeof parseContactName>,
  domain: string
): string | null {
  // Normalize and clean the name parts
  const first = nameParts.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = nameParts.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstInitial = nameParts.initials.first;
  const lastInitial = nameParts.initials.last;
  
  if (!first || !last) {
    return null;
  }
  
  let localPart;
  
  switch (pattern) {
    case 'first.last@domain':
      localPart = `${first}.${last}`;
      break;
    case 'first@domain':
      localPart = first;
      break;
    case 'flast@domain':
      localPart = `${firstInitial}${last}`;
      break;
    case 'firstl@domain':
      localPart = `${first}${lastInitial}`;
      break;
    case 'first_last@domain':
      localPart = `${first}_${last}`;
      break;
    case 'last.first@domain':
      localPart = `${last}.${first}`;
      break;
    case 'lastf@domain':
      localPart = `${last}${firstInitial}`;
      break;
    default:
      // Custom pattern handling
      localPart = customPatternHandler(pattern, nameParts);
  }
  
  if (!localPart) {
    return null;
  }
  
  return `${localPart}@${domain}`;
}

function customPatternHandler(
  pattern: string,
  nameParts: ReturnType<typeof parseContactName>
): string | null {
  // Handle custom patterns with placeholders
  let result = pattern;
  
  // Replace placeholders with actual values
  result = result
    .replace('first', nameParts.firstName.toLowerCase())
    .replace('last', nameParts.lastName.toLowerCase())
    .replace('f', nameParts.initials.first)
    .replace('l', nameParts.initials.last);
    
  // Remove the domain part if present
  result = result.replace('@domain', '');
  
  // Clean up any remaining invalid characters
  result = result.replace(/[^a-z0-9._-]/g, '');
  
  return result;
}
```

### 3. Email Validation
Each email is validated through a multi-step process:

```typescript
// server/lib/perplexity.ts
export async function validateEmails(emails: string[]): Promise<EmailValidationResult> {
  try {
    // Filter out obviously invalid emails
    const validEmails = emails.filter(email => {
      return email && email.includes('@') && email.includes('.');
    });
    
    if (validEmails.length === 0) {
      return { score: 0 };
    }
    
    // Calculate baseline scores using pattern validation
    const validationDetails = {
      patternScore: calculatePatternScore(validEmails[0]),
      businessDomainScore: calculateBusinessDomainScore(validEmails[0]),
      placeholderCheck: isPlaceholderEmail(validEmails[0])
    };
    
    // For high-value contacts, use AI to further validate
    if (validEmails.length > 0) {
      const aiConfidence = await validateEmailWithAI(validEmails[0]);
      validationDetails.aiConfidence = aiConfidence;
    }
    
    // Calculate composite score
    const score = calculateCompositeEmailScore(validationDetails);
    
    return {
      score,
      validationDetails
    };
  } catch (error) {
    console.error("Error validating emails:", error);
    return { score: 0 };
  }
}

function calculatePatternScore(email: string): number {
  if (!email) return 0;
  
  // Basic syntactic validation
  if (!email.includes('@') || !email.includes('.')) return 0;
  
  const [localPart, domain] = email.split('@');
  
  if (!localPart || !domain) return 0;
  
  let score = 50; // Starting score
  
  // Check for valid format
  if (/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    score += 20;
  }
  
  // Check for common local part patterns
  if (/^[a-z]+\.[a-z]+$/.test(localPart)) score += 10; // first.last
  if (/^[a-z]+[0-9]?$/.test(localPart)) score += 5; // first or first1
  if (/^[a-z][a-z]+$/.test(localPart)) score += 5; // flast
  
  // Penalize suspicious patterns
  if (localPart.length < 3) score -= 10; // Too short
  if (localPart.length > 30) score -= 20; // Too long
  if (/^\d+$/.test(localPart)) score -= 30; // All numbers
  if (/[^a-zA-Z0-9._-]/.test(localPart)) score -= 20; // Unusual characters
  
  return Math.max(0, Math.min(100, score));
}

function calculateBusinessDomainScore(email: string): number {
  if (!email) return 0;
  
  const domain = email.split('@')[1];
  
  if (!domain) return 0;
  
  let score = 50; // Starting score
  
  // Penalize common free email providers
  const freeEmailProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'aol.com',
    'outlook.com', 'icloud.com', 'mail.com', 'protonmail.com'
  ];
  
  if (freeEmailProviders.some(provider => domain.toLowerCase() === provider)) {
    score -= 40; // Significant penalty for free email providers
  }
  
  // Check domain structure
  const domainParts = domain.split('.');
  
  if (domainParts.length >= 2) {
    const tld = domainParts[domainParts.length - 1].toLowerCase();
    
    // Common business TLDs get bonus
    if (['com', 'org', 'net', 'io', 'co'].includes(tld)) {
      score += 10;
    }
    
    // Country-specific business domains are good
    if (tld.length === 2 && tld !== 'to' && tld !== 'tk') {
      score += 5;
    }
  }
  
  // Penalize suspicious domains
  if (domain.includes('temp') || domain.includes('fake') || domain.includes('mail')) {
    score -= 20;
  }
  
  return Math.max(0, Math.min(100, score));
}

function isPlaceholderEmail(email: string): boolean {
  if (!email) return true;
  
  const placeholderPatterns = [
    /placeholder/i,
    /example/i,
    /test@/i,
    /sample/i,
    /[a-z]+@example\.(com|org|net)/i,
    /user@/i,
    /info@/i,
    /admin@/i,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(email));
}

async function validateEmailWithAI(email: string): Promise<number> {
  const prompt = `
    Analyze this email address: ${email}
    
    1. Is this likely a valid, working email address?
    2. Does it follow common business email patterns?
    3. Does the domain appear to be a legitimate business domain?
    4. Is there anything suspicious about this email?
    
    Provide a confidence score (0-100) on how likely this is to be a real, working email address.
  `;
  
  try {
    const response = await analyzeWithPerplexity(prompt);
    
    // Extract confidence score from response
    const scoreMatch = response.match(/confidence score:?\s*(\d+)/i) ||
                      response.match(/score:?\s*(\d+)/i) ||
                      response.match(/(\d{1,3})\/100/);
    
    if (scoreMatch && scoreMatch[1]) {
      const score = parseInt(scoreMatch[1], 10);
      return isNaN(score) ? 50 : score;
    }
    
    // If no explicit score, search for sentiment indicators
    const positiveIndicators = [
      /likely valid/i,
      /appears legitimate/i,
      /high confidence/i,
      /probably real/i,
      /seems valid/i
    ];
    
    const negativeIndicators = [
      /suspicious/i,
      /unlikely/i,
      /probably not/i,
      /low confidence/i,
      /fake/i,
      /invalid/i
    ];
    
    let sentimentScore = 50;
    
    positiveIndicators.forEach(pattern => {
      if (pattern.test(response)) sentimentScore += 10;
    });
    
    negativeIndicators.forEach(pattern => {
      if (pattern.test(response)) sentimentScore -= 10;
    });
    
    return Math.max(0, Math.min(100, sentimentScore));
  } catch (error) {
    console.error("Error in AI email validation:", error);
    return 50; // Default to neutral score on error
  }
}

function calculateCompositeEmailScore(validationDetails: {
  patternScore: number;
  businessDomainScore: number;
  placeholderCheck: boolean;
  aiConfidence?: number;
}): number {
  // Start with pattern score (40% weight)
  let score = validationDetails.patternScore * 0.4;
  
  // Add business domain score (30% weight)
  score += validationDetails.businessDomainScore * 0.3;
  
  // Incorporate AI confidence if available (30% weight)
  if (validationDetails.aiConfidence !== undefined) {
    score += validationDetails.aiConfidence * 0.3;
  } else {
    // If no AI score, distribute weight to other factors
    score = (validationDetails.patternScore * 0.55) + (validationDetails.businessDomainScore * 0.45);
  }
  
  // Apply penalties for placeholder emails
  if (validationDetails.placeholderCheck) {
    score *= 0.3; // 70% reduction for placeholder emails
  }
  
  return Math.round(Math.max(0, Math.min(100, score)));
}
```

### 4. Enrichment & Verification
The system enriches contact data with verified information:

```typescript
// server/lib/results-analysis/email-analysis.ts
export async function analyzeAndEnrichEmail(
  email: string,
  contactContext: Partial<Contact>,
  companyContext: Partial<Company>
): Promise<EmailAnalysisResult> {
  try {
    // Basic validation
    const basicValidation = validateBasicEmailFormat(email);
    
    if (!basicValidation.isValid) {
      return {
        isValid: false,
        validationScore: 0,
        validationSource: 'pattern',
        validationDetails: basicValidation.details
      };
    }
    
    // Perform multi-stage validation
    const patternValidation = validateEmailPattern(email, contactContext);
    const domainValidation = validateEmailDomain(email, companyContext);
    
    // Calculate initial score from pattern and domain validation
    let score = (patternValidation.score * 0.6) + (domainValidation.score * 0.4);
    
    // Additional verification through API (if high initial score)
    let verificationResult = null;
    let validationSource = 'pattern';
    
    if (score >= 60) {
      try {
        verificationResult = await performExternalEmailVerification(email);
        validationSource = 'api_verification';
        
        // Incorporate verification result into score
        score = (score * 0.7) + (verificationResult.score * 0.3);
      } catch (error) {
        console.error("Email verification API error:", error);
        // Continue without API verification
      }
    }
    
    // Compile validation details
    const validationDetails = {
      patternValidation,
      domainValidation,
      verificationResult,
      compositeScore: Math.round(score)
    };
    
    return {
      isValid: score >= 70,
      validationScore: Math.round(score),
      validationSource,
      validationDetails
    };
  } catch (error) {
    console.error("Error in email analysis:", error);
    return {
      isValid: false,
      validationScore: 0,
      validationSource: 'error',
      validationDetails: { error: String(error) }
    };
  }
}

function validateBasicEmailFormat(email: string): { 
  isValid: boolean; 
  details: { reason?: string; score: number; } 
} {
  if (!email || typeof email !== 'string') {
    return { 
      isValid: false, 
      details: { reason: 'Email is empty or invalid type', score: 0 } 
    };
  }
  
  // Basic regex check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { 
      isValid: false, 
      details: { reason: 'Invalid email format', score: 0 } 
    };
  }
  
  // Check for common invalid patterns
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return { 
      isValid: false, 
      details: { reason: 'Invalid dot pattern', score: 20 } 
    };
  }
  
  // Check for reasonable length
  if (email.length < 5 || email.length > 255) {
    return { 
      isValid: false, 
      details: { reason: 'Email length out of reasonable range', score: 30 } 
    };
  }
  
  return { isValid: true, details: { score: 100 } };
}

function validateEmailPattern(
  email: string,
  contactContext: Partial<Contact>
): { score: number; details: any } {
  if (!contactContext.name) {
    return { score: 50, details: { reason: 'No contact name for comparison' } };
  }
  
  const localPart = email.split('@')[0].toLowerCase();
  const nameParts = parseContactName(contactContext.name);
  
  let score = 50; // Start with neutral score
  const details: any = {};
  
  // Check for presence of name components in email
  const firstName = nameParts.firstName.toLowerCase();
  const lastName = nameParts.lastName.toLowerCase();
  const firstInitial = firstName.charAt(0);
  const lastInitial = lastName.charAt(0);
  
  // Common email patterns matching
  if (localPart === `${firstName}.${lastName}`) {
    score += 30;
    details.pattern = 'first.last';
  } else if (localPart === `${firstName}${lastName}`) {
    score += 25;
    details.pattern = 'firstlast';
  } else if (localPart === `${firstName}${lastInitial}`) {
    score += 20;
    details.pattern = 'firstl';
  } else if (localPart === `${firstInitial}${lastName}`) {
    score += 20;
    details.pattern = 'flast';
  } else if (localPart === `${lastName}.${firstName}`) {
    score += 20;
    details.pattern = 'last.first';
  } else if (localPart === firstName) {
    score += 15;
    details.pattern = 'first';
  } else if (localPart === lastName) {
    score += 15;
    details.pattern = 'last';
  }
  
  // Check for partial matches (name components appearing in email)
  if (score === 50) {
    if (localPart.includes(firstName) || localPart.includes(lastName)) {
      score += 10;
      details.pattern = 'partial_name_match';
    } else if (localPart.includes(firstInitial) && localPart.includes(lastInitial)) {
      score += 5;
      details.pattern = 'initials_present';
    }
  }
  
  return { score, details };
}

function validateEmailDomain(
  email: string,
  companyContext: Partial<Company>
): { score: number; details: any } {
  if (!email.includes('@')) {
    return { score: 0, details: { reason: 'Missing @ symbol' } };
  }
  
  const domain = email.split('@')[1].toLowerCase();
  const details: any = { domain };
  
  // Start with neutral score
  let score = 50;
  
  // Check if domain matches company website
  if (companyContext.website) {
    const companyDomain = extractDomainFromWebsite(companyContext.website);
    
    if (companyDomain && domain === companyDomain) {
      score += 40;
      details.match = 'exact_company_domain';
    } else if (companyDomain && domain.includes(companyDomain)) {
      score += 30;
      details.match = 'subdomain_of_company';
    } else if (companyDomain && companyDomain.includes(domain)) {
      score += 20;
      details.match = 'domain_is_substring_of_company';
    }
  }
  
  // Check for common free email providers (lower confidence for business contacts)
  const freeEmailProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
    'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'
  ];
  
  if (freeEmailProviders.includes(domain)) {
    score -= 30;
    details.free_email_provider = true;
  }
  
  // Check for suspicious or temporary domains
  const suspiciousDomains = [
    'tempmail', 'throwaway', 'mailinator', 'guerrilla', 
    'fakeinbox', 'yopmail', 'example.com'
  ];
  
  if (suspiciousDomains.some(d => domain.includes(d))) {
    score -= 80;
    details.suspicious_domain = true;
  }
  
  return { score, details };
}

async function performExternalEmailVerification(email: string): Promise<{ 
  score: number; 
  details: any;
}> {
  // This is a placeholder for an external verification service
  // In a real implementation, this would call an email verification API
  
  // For now, we'll simulate verification based on email structure
  const [localPart, domain] = email.split('@');
  
  // Simulate API response
  const apiResponse = {
    deliverable: domain.includes('.') && domain.split('.').length >= 2,
    syntax: { valid: true },
    mx: { valid: !domain.includes('invalid') },
    disposable: domain.includes('temp') || domain.includes('disposable'),
    role_address: localPart === 'info' || localPart === 'admin' || localPart === 'sales',
  };
  
  let score = 50;
  
  // Calculate score based on simulated verification
  if (apiResponse.deliverable) score += 30;
  if (apiResponse.syntax.valid) score += 10;
  if (apiResponse.mx.valid) score += 20;
  if (apiResponse.disposable) score -= 40;
  if (apiResponse.role_address) score -= 20;
  
  return {
    score: Math.max(0, Math.min(100, score)),
    details: apiResponse
  };
}
```

### 5. Feedback Integration
The system integrates user feedback into the contact validation:

```typescript
// server/storage/contacts.ts
async addContactFeedback(feedback: InsertContactFeedback): Promise<ContactFeedback> {
  // Insert feedback record
  const result = await this.db
    .insert(contactFeedback)
    .values(feedback)
    .returning();
    
  const newFeedback = result[0];
  
  // Update contact based on feedback
  const contact = await this.getContact(feedback.contactId);
  
  if (contact) {
    // Recalculate confidence score based on feedback
    let newScore = contact.confidenceScore || 50;
    
    // Adjust score based on feedback type
    switch (feedback.feedbackType) {
      case 'confirm_email':
        newScore = Math.min(100, newScore + 20);
        break;
      case 'reject_email':
        newScore = Math.max(0, newScore - 30);
        break;
      case 'confirm_role':
        newScore = Math.min(100, newScore + 10);
        break;
      case 'update_info':
        // Depends on which fields were updated
        newScore = Math.min(100, newScore + 15);
        break;
    }
    
    // Update the contact with new score and status
    await this.db
      .update(contacts)
      .set({
        confidenceScore: newScore,
        validationStatus: 'user_validated',
        lastUpdated: new Date()
      })
      .where(eq(contacts.id, feedback.contactId));
  }
  
  return newFeedback;
}

async updateContactValidationStatus(id: number): Promise<void> {
  // Get current contact data
  const contact = await this.getContact(id);
  
  if (!contact) {
    throw new Error(`Contact with ID ${id} not found`);
  }
  
  // Get feedback for this contact
  const feedbackList = await this.getContactFeedback(id);
  
  // Determine validation status based on feedback and confidence score
  let validationStatus = contact.validationStatus || 'unvalidated';
  
  if (feedbackList.length > 0) {
    // If user has provided any feedback, consider it user-validated
    validationStatus = 'user_validated';
  } else if (contact.confidenceScore && contact.confidenceScore >= 80) {
    validationStatus = 'system_validated_high';
  } else if (contact.confidenceScore && contact.confidenceScore >= 60) {
    validationStatus = 'system_validated_medium';
  } else if (contact.confidenceScore && contact.confidenceScore >= 40) {
    validationStatus = 'system_validated_low';
  }
  
  // Update the contact status
  await this.db
    .update(contacts)
    .set({ validationStatus })
    .where(eq(contacts.id, id));
}
```

This technical documentation provides a detailed overview of the three main data processing flows: company search, key contact identification, and email discovery. The code snippets demonstrate exactly how each part of the system works, from initial API calls to validation and storage of the final results.