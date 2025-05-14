import { storage } from "../storage";
import { InsertCompany, InsertContact, SearchConfiguration } from "@shared/schema";
import { log } from "../vite";

/**
 * SearchExecutor is responsible for running a search based on a specific configuration
 */
export class SearchExecutor {
  private config: SearchConfiguration;
  private userId: number;
  private configId: number;
  private searchData: Record<string, any>;
  
  constructor(configId: number, userId: number, searchData: Record<string, any>) {
    this.userId = userId;
    this.configId = configId;
    this.searchData = searchData;
    this.config = {} as SearchConfiguration;
  }
  
  /**
   * Initialize the executor by loading the configuration
   */
  async initialize(): Promise<boolean> {
    try {
      const config = await storage.getSearchConfiguration(this.configId, this.userId);
      if (!config) {
        log(`Configuration with ID ${this.configId} not found for user ${this.userId}`, "search-executor");
        return false;
      }
      
      this.config = config;
      return true;
    } catch (error) {
      log(`Error initializing search executor: ${(error as Error).message}`, "search-executor");
      return false;
    }
  }
  
  /**
   * Execute the company search phase
   */
  async executeCompanySearch(): Promise<InsertCompany[]> {
    try {
      log(`Executing company search with approach: ${this.config.companyConfig.coreApproach}`, "search-executor");
      
      // Prepare search parameters
      const baseParameters = {
        query: this.searchData.query,
        companyName: this.searchData.companyName,
        industry: this.searchData.industry,
        location: this.searchData.location,
        employeeCount: this.searchData.employeeCount,
        ...this.searchData.additionalParameters
      };
      
      // Add custom parameters from configuration
      const customParameters: Record<string, any> = {};
      for (const param of this.config.companyConfig.customParameters) {
        customParameters[param.name] = param.value;
      }
      
      const searchParams = {
        ...baseParameters,
        ...customParameters,
        promptAdditions: this.config.companyConfig.promptAdditions
      };
      
      // Execute primary search based on configuration
      let companies: InsertCompany[] = [];
      switch (this.config.companyConfig.coreApproach) {
        case "single":
          companies = await this.executeSingleCompanySearch(searchParams);
          break;
        case "double":
          companies = await this.executeDoubleCompanySearch(searchParams);
          break;
        case "triple":
          companies = await this.executeTripleCompanySearch(searchParams);
          break;
        case "perplexity":
          companies = await this.executePerplexityCompanySearch(searchParams);
          break;
        default:
          companies = await this.executeSingleCompanySearch(searchParams);
      }
      
      // Apply secondary searches if enabled
      if (this.config.companyConfig.secondarySearch) {
        const secondary = this.config.companyConfig.secondarySearch;
        
        // Example secondary searches
        if (secondary.fireCrawlStandard) {
          companies = await this.enhanceWithFireCrawlStandard(companies);
        }
        
        if (secondary.fireCrawlExtract) {
          companies = await this.enhanceWithFireCrawlExtract(companies);
        }
        
        if (secondary.serpApi) {
          companies = await this.enhanceWithSerpApi(companies);
        }
        
        if (secondary.googleMyBusiness) {
          companies = await this.enhanceWithGoogleMyBusiness(companies);
        }
      }
      
      // Apply scoring rules to sort companies
      companies = this.applyCompanyScoringRules(companies);
      
      return companies;
    } catch (error) {
      log(`Error executing company search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  /**
   * Execute the contact search phase
   */
  async executeContactSearch(companyId: number): Promise<InsertContact[]> {
    try {
      log(`Executing contact search with approach: ${this.config.contactConfig.coreApproach}`, "search-executor");
      
      // Get company to search for contacts
      const company = await storage.getCompany(companyId, this.userId);
      if (!company) {
        log(`Company with ID ${companyId} not found`, "search-executor");
        return [];
      }
      
      // Prepare search parameters
      const baseParameters = {
        companyName: company.name,
        companyDomain: company.domain,
        industry: company.industry,
        location: company.location,
        ...this.searchData.contactParameters
      };
      
      // Add custom parameters from configuration
      const customParameters: Record<string, any> = {};
      for (const param of this.config.contactConfig.customParameters) {
        customParameters[param.name] = param.value;
      }
      
      const searchParams = {
        ...baseParameters,
        ...customParameters,
        promptAdditions: this.config.contactConfig.promptAdditions
      };
      
      // Execute primary search based on configuration
      let contacts: InsertContact[] = [];
      switch (this.config.contactConfig.coreApproach) {
        case "single":
          contacts = await this.executeSingleContactSearch(searchParams, company);
          break;
        case "double":
          contacts = await this.executeDoubleContactSearch(searchParams, company);
          break;
        case "triple":
          contacts = await this.executeTripleContactSearch(searchParams, company);
          break;
        case "perplexity":
          contacts = await this.executePerplexityContactSearch(searchParams, company);
          break;
        default:
          contacts = await this.executeSingleContactSearch(searchParams, company);
      }
      
      // Apply secondary searches if enabled
      if (this.config.contactConfig.secondarySearch) {
        const secondary = this.config.contactConfig.secondarySearch;
        
        if (secondary.searchGraphApi) {
          contacts = await this.enhanceWithSearchGraphApi(contacts, company);
        }
        
        if (secondary.hunterIo) {
          contacts = await this.enhanceWithHunterIo(contacts, company);
        }
        
        if (secondary.zoomInfo) {
          contacts = await this.enhanceWithZoomInfo(contacts, company);
        }
      }
      
      // Apply scoring rules to sort contacts
      contacts = this.applyContactScoringRules(contacts);
      
      return contacts;
    } catch (error) {
      log(`Error executing contact search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  /**
   * Execute the email discovery phase
   */
  async executeEmailSearch(contactId: number): Promise<InsertContact | null> {
    try {
      log(`Executing email search with approach: ${this.config.emailConfig.coreApproach}`, "search-executor");
      
      // Get contact to find email
      const contact = await storage.getContact(contactId, this.userId);
      if (!contact) {
        log(`Contact with ID ${contactId} not found`, "search-executor");
        return null;
      }
      
      // Get company information for context
      const company = await storage.getCompany(contact.companyId, this.userId);
      if (!company) {
        log(`Company with ID ${contact.companyId} not found`, "search-executor");
        return null;
      }
      
      // Prepare search parameters
      const baseParameters = {
        firstName: contact.firstName,
        lastName: contact.lastName,
        jobTitle: contact.title,
        companyName: company.name,
        companyDomain: company.domain,
        ...this.searchData.emailParameters
      };
      
      // Add custom parameters from configuration
      const customParameters: Record<string, any> = {};
      for (const param of this.config.emailConfig.customParameters) {
        customParameters[param.name] = param.value;
      }
      
      const searchParams = {
        ...baseParameters,
        ...customParameters,
        promptAdditions: this.config.emailConfig.promptAdditions
      };
      
      // Execute primary search based on configuration
      let updatedContact = { ...contact };
      switch (this.config.emailConfig.coreApproach) {
        case "single":
          updatedContact = await this.executeSingleEmailSearch(searchParams, contact, company);
          break;
        case "double":
          updatedContact = await this.executeDoubleEmailSearch(searchParams, contact, company);
          break;
        case "triple":
          updatedContact = await this.executeTripleEmailSearch(searchParams, contact, company);
          break;
        case "perplexity":
          updatedContact = await this.executePerplexityEmailSearch(searchParams, contact, company);
          break;
        default:
          updatedContact = await this.executePerplexityEmailSearch(searchParams, contact, company);
      }
      
      // Apply secondary searches if enabled
      if (this.config.emailConfig.secondarySearch) {
        const secondary = this.config.emailConfig.secondarySearch;
        
        if (secondary.smtpVerification && updatedContact.email) {
          updatedContact = await this.verifyEmailWithSMTP(updatedContact);
        }
        
        if (secondary.aeroLeads) {
          updatedContact = await this.enhanceWithAeroLeads(updatedContact, company);
        }
      }
      
      // Save the updated contact
      if (updatedContact.email) {
        return await storage.updateContact(contactId, updatedContact);
      }
      
      return updatedContact;
    } catch (error) {
      log(`Error executing email search: ${(error as Error).message}`, "search-executor");
      return null;
    }
  }
  
  // Implementation of search methods (placeholder implementations)
  private async executeSingleCompanySearch(params: any): Promise<InsertCompany[]> {
    try {
      // First, use the 'query' parameter from searchData if available
      const query = params.query || "";
      if (!query) {
        log("No query provided for single company search", "search-executor");
        return [];
      }
      
      // Add any prompt additions from the configuration
      const enhancedQuery = params.promptAdditions ? `${query} ${params.promptAdditions}` : query;
      
      log(`Executing single company search for query: ${enhancedQuery}`, "search-executor");
      
      // Import the searchCompanies function
      const { searchCompanies } = await import("../lib/search-logic");
      
      // Use the existing search implementation
      const companyNames = await searchCompanies(enhancedQuery);
      
      // Convert to InsertCompany objects
      return companyNames.map(name => ({
        name,
        userId: this.userId,
        source: "single_search",
        confidence: 75
      }));
    } catch (error) {
      log(`Error in single company search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  private async executeDoubleCompanySearch(params: any): Promise<InsertCompany[]> {
    // TODO: Implement actual search logic
    return [];
  }
  
  private async executeTripleCompanySearch(params: any): Promise<InsertCompany[]> {
    // TODO: Implement actual search logic
    return [];
  }
  
  private async executePerplexityCompanySearch(params: any): Promise<InsertCompany[]> {
    try {
      // First, use the 'query' parameter from searchData if available
      const query = params.query || "";
      if (!query) {
        log("No query provided for Perplexity company search", "search-executor");
        return [];
      }
      
      // Add any prompt additions from the configuration
      const enhancedQuery = params.promptAdditions ? `${query} ${params.promptAdditions}` : query;
      
      log(`Executing Perplexity company search for query: ${enhancedQuery}`, "search-executor");
      
      // Import the searchCompanies function
      const { searchCompanies } = await import("../lib/search-logic");
      
      // Use the existing search implementation
      const companyNames = await searchCompanies(enhancedQuery);
      
      // Convert to InsertCompany objects
      return companyNames.map(name => ({
        name,
        userId: this.userId,
        source: "perplexity",
        confidence: 70
      }));
    } catch (error) {
      log(`Error in Perplexity company search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  private async executeSingleContactSearch(params: any, company: any): Promise<InsertContact[]> {
    try {
      const companyName = company.name || '';
      const industry = company.industry || '';
      const location = company.location || '';
      const domain = company.domain || company.website || '';
      
      if (!companyName) {
        log("No company name provided for single contact search", "search-executor");
        return [];
      }
      
      // Create a detailed prompt based on company information
      let prompt = `Find 3-5 key decision makers at ${companyName}`;
      
      // Add domain information if available
      if (domain) {
        prompt += ` (website: ${domain})`;
      }
      
      // Add location and industry if available
      if (location) {
        prompt += ` based in ${location}`;
      }
      
      if (industry) {
        prompt += ` in the ${industry} industry`;
      }
      
      // Add any prompt additions from the configuration
      if (params.promptAdditions) {
        prompt += `. ${params.promptAdditions}`;
      }
      
      // Finalize the prompt with response formatting instructions
      prompt += `. Please provide full names and job titles. Format the response as a valid JSON array of objects with 'name' and 'title' properties. Only return the JSON array, no additional text.`;
      
      log(`Executing single contact search for company: ${companyName}`, "search-executor");
      
      // Make request to Perplexity API (using the same API as the perplexity method)
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at finding key decision makers at companies. Always return data as a valid JSON array.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
          }
        }
      );
      
      // Parse the response
      const content = response.data.choices[0].message.content;
      
      // Extract JSON array from response
      let contactData: Array<{name: string, title: string}> = [];
      try {
        // First, try to parse the content directly
        contactData = JSON.parse(content);
      } catch (error) {
        // If direct parsing fails, look for array pattern in the response
        const match = content.match(/\[.*\]/s);
        if (match) {
          try {
            contactData = JSON.parse(match[0]);
          } catch (innerError) {
            log(`Failed to parse JSON array from match: ${innerError}`, "search-executor");
          }
        } else {
          log(`Could not extract contacts from Perplexity response`, "search-executor");
          return [];
        }
      }
      
      // Convert to InsertContact objects
      return contactData.map(contact => ({
        name: contact.name,
        companyId: company.id,
        userId: this.userId,
        role: contact.title || null,
        source: "single_search",
        probability: 75,
        completedSearches: ["ai_search"]
      }));
    } catch (error) {
      log(`Error in single contact search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  private async executeDoubleContactSearch(params: any, company: any): Promise<InsertContact[]> {
    // TODO: Implement actual search logic
    return [];
  }
  
  private async executeTripleContactSearch(params: any, company: any): Promise<InsertContact[]> {
    // TODO: Implement actual search logic
    return [];
  }
  
  private async executePerplexityContactSearch(params: any, company: any): Promise<InsertContact[]> {
    try {
      const companyName = company.name || '';
      const industry = company.industry || '';
      const location = company.location || '';
      const domain = company.domain || company.website || '';
      
      if (!companyName) {
        log("No company name provided for Perplexity contact search", "search-executor");
        return [];
      }
      
      // Create a detailed prompt based on company information
      let prompt = `Find 3-5 key decision makers at ${companyName}`;
      
      // Add domain information if available
      if (domain) {
        prompt += ` (website: ${domain})`;
      }
      
      // Add location and industry if available
      if (location) {
        prompt += ` based in ${location}`;
      }
      
      if (industry) {
        prompt += ` in the ${industry} industry`;
      }
      
      // Add any prompt additions from the configuration
      if (params.promptAdditions) {
        prompt += `. ${params.promptAdditions}`;
      }
      
      // Finalize the prompt with response formatting instructions
      prompt += `. Please provide full names and job titles. Format the response as a valid JSON array of objects with 'name' and 'title' properties. Only return the JSON array, no additional text.`;
      
      log(`Executing Perplexity contact search for company: ${companyName}`, "search-executor");
      
      // Make request to Perplexity API
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at finding key decision makers at companies. Always return data as a valid JSON array.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 1000,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
          }
        }
      );
      
      // Parse the response
      const content = response.data.choices[0].message.content;
      
      // Extract JSON array from response
      let contactData: Array<{name: string, title: string}> = [];
      try {
        // First, try to parse the content directly
        contactData = JSON.parse(content);
      } catch (error) {
        // If direct parsing fails, look for array pattern in the response
        const match = content.match(/\[.*\]/s);
        if (match) {
          try {
            contactData = JSON.parse(match[0]);
          } catch (innerError) {
            log(`Failed to parse JSON array from match: ${innerError}`, "search-executor");
          }
        } else {
          log(`Could not extract contacts from Perplexity response`, "search-executor");
          return [];
        }
      }
      
      // Convert to InsertContact objects
      return contactData.map(contact => ({
        name: contact.name,
        companyId: company.id,
        userId: this.userId,
        role: contact.title || null,
        source: "perplexity",
        probability: 70,
        completedSearches: ["ai_search"]
      }));
    } catch (error) {
      log(`Error in Perplexity contact search: ${(error as Error).message}`, "search-executor");
      return [];
    }
  }
  
  private async executeSingleEmailSearch(params: any, contact: any, company: any): Promise<InsertContact> {
    try {
      const contactName = contact.name || '';
      const contactRole = contact.role || '';
      const companyName = company.name || '';
      const companyDomain = company.domain || company.website || '';
      
      if (!contactName || !companyName) {
        log("Missing required data for single email search", "search-executor");
        return contact;
      }
      
      // Create a detailed prompt based on contact and company information
      let prompt = `Find the work email address for ${contactName}`;
      
      // Add role information if available
      if (contactRole) {
        prompt += `, who is the ${contactRole}`;
      }
      
      prompt += ` at ${companyName}`;
      
      // Add domain information if available
      if (companyDomain) {
        prompt += ` (company website: ${companyDomain})`;
      }
      
      // Add any prompt additions from the configuration
      if (params.promptAdditions) {
        prompt += `. ${params.promptAdditions}`;
      }
      
      // Finalize the prompt with response formatting instructions
      prompt += `. Only return a valid email address without any additional text. If you can't find a specific email, provide the most likely pattern based on the company's email format.`;
      
      log(`Executing single email search for contact: ${contactName} at ${companyName}`, "search-executor");
      
      // Make request to Perplexity API
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at finding corporate email addresses. Only respond with the email address, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 100,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
          }
        }
      );
      
      // Extract the email from the response
      const content = response.data.choices[0].message.content.trim();
      
      // Simple regex to validate if the content is an email
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      // Check if we got a valid email
      if (emailRegex.test(content)) {
        // Update the contact with the email
        return {
          ...contact,
          email: content,
          source: contact.source ? `${contact.source},single_email` : "single_email",
          completedSearches: [...(contact.completedSearches || []), "email_search"],
          lastValidated: new Date()
        };
      } else {
        log(`Single search did not return a valid email format: "${content}"`, "search-executor");
        return contact;
      }
    } catch (error) {
      log(`Error in single email search: ${(error as Error).message}`, "search-executor");
      return contact;
    }
  }
  
  private async executeDoubleEmailSearch(params: any, contact: any, company: any): Promise<InsertContact> {
    // TODO: Implement actual search logic
    return contact;
  }
  
  private async executeTripleEmailSearch(params: any, contact: any, company: any): Promise<InsertContact> {
    // TODO: Implement actual search logic
    return contact;
  }
  
  private async executePerplexityEmailSearch(params: any, contact: any, company: any): Promise<InsertContact> {
    try {
      const contactName = contact.name || '';
      const contactRole = contact.role || '';
      const companyName = company.name || '';
      const companyDomain = company.domain || company.website || '';
      
      if (!contactName || !companyName) {
        log("Missing required data for Perplexity email search", "search-executor");
        return contact;
      }
      
      // Create a detailed prompt based on contact and company information
      let prompt = `Find the work email address for ${contactName}`;
      
      // Add role information if available
      if (contactRole) {
        prompt += `, who is the ${contactRole}`;
      }
      
      prompt += ` at ${companyName}`;
      
      // Add domain information if available
      if (companyDomain) {
        prompt += ` (company website: ${companyDomain})`;
      }
      
      // Add any prompt additions from the configuration
      if (params.promptAdditions) {
        prompt += `. ${params.promptAdditions}`;
      }
      
      // Finalize the prompt with response formatting instructions
      prompt += `. Only return a valid email address without any additional text. If you can't find a specific email, provide the most likely pattern based on the company's email format.`;
      
      log(`Executing Perplexity email search for contact: ${contactName} at ${companyName}`, "search-executor");
      
      // Make request to Perplexity API
      const { default: axios } = await import('axios');
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at finding corporate email addresses. Only respond with the email address, no additional text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 100,
          stream: false
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
          }
        }
      );
      
      // Extract the email from the response
      const content = response.data.choices[0].message.content.trim();
      
      // Simple regex to validate if the content is an email
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      // Check if we got a valid email
      if (emailRegex.test(content)) {
        // Update the contact with the email
        return {
          ...contact,
          email: content,
          source: contact.source ? `${contact.source},perplexity_email` : "perplexity_email",
          completedSearches: [...(contact.completedSearches || []), "email_search"],
          lastValidated: new Date()
        };
      } else {
        log(`Perplexity did not return a valid email format: "${content}"`, "search-executor");
        return contact;
      }
    } catch (error) {
      log(`Error in Perplexity email search: ${(error as Error).message}`, "search-executor");
      return contact;
    }
  }
  
  // Secondary search enhancement methods
  private async enhanceWithFireCrawlStandard(companies: InsertCompany[]): Promise<InsertCompany[]> {
    // TODO: Implement enhancement logic
    return companies;
  }
  
  private async enhanceWithFireCrawlExtract(companies: InsertCompany[]): Promise<InsertCompany[]> {
    // TODO: Implement enhancement logic
    return companies;
  }
  
  private async enhanceWithSerpApi(companies: InsertCompany[]): Promise<InsertCompany[]> {
    // TODO: Implement enhancement logic
    return companies;
  }
  
  private async enhanceWithGoogleMyBusiness(companies: InsertCompany[]): Promise<InsertCompany[]> {
    // TODO: Implement enhancement logic
    return companies;
  }
  
  private async enhanceWithSearchGraphApi(contacts: InsertContact[], company: any): Promise<InsertContact[]> {
    // TODO: Implement enhancement logic
    return contacts;
  }
  
  private async enhanceWithHunterIo(contacts: InsertContact[], company: any): Promise<InsertContact[]> {
    // TODO: Implement enhancement logic
    return contacts;
  }
  
  private async enhanceWithZoomInfo(contacts: InsertContact[], company: any): Promise<InsertContact[]> {
    // TODO: Implement enhancement logic
    return contacts;
  }
  
  private async verifyEmailWithSMTP(contact: InsertContact): Promise<InsertContact> {
    // TODO: Implement verification logic
    return contact;
  }
  
  private async enhanceWithAeroLeads(contact: InsertContact, company: any): Promise<InsertContact> {
    // TODO: Implement enhancement logic
    return contact;
  }
  
  // Scoring rules application
  private applyCompanyScoringRules(companies: InsertCompany[]): InsertCompany[] {
    if (!this.config.companyConfig.scoringRules.length) {
      return companies;
    }
    
    // Calculate scores for each company
    const scoredCompanies = companies.map(company => {
      let score = 50; // Default score
      
      for (const rule of this.config.companyConfig.scoringRules) {
        // Skip rules that don't apply
        if (!(rule.parameter in company)) continue;
        
        const companyValue = (company as any)[rule.parameter];
        const ruleValue = rule.value;
        
        let matches = false;
        switch (rule.condition) {
          case "equals":
            matches = companyValue === ruleValue;
            break;
          case "notEquals":
            matches = companyValue !== ruleValue;
            break;
          case "greaterThan":
            matches = companyValue > ruleValue;
            break;
          case "lessThan":
            matches = companyValue < ruleValue;
            break;
          case "contains":
            matches = String(companyValue).includes(String(ruleValue));
            break;
          case "notContains":
            matches = !String(companyValue).includes(String(ruleValue));
            break;
        }
        
        if (matches) {
          score += rule.score;
        }
      }
      
      return { ...company, score };
    });
    
    // Sort by score (highest first)
    return scoredCompanies.sort((a: any, b: any) => b.score - a.score);
  }
  
  private applyContactScoringRules(contacts: InsertContact[]): InsertContact[] {
    if (!this.config.contactConfig.scoringRules.length) {
      return contacts;
    }
    
    // Calculate scores for each contact
    const scoredContacts = contacts.map(contact => {
      let score = 50; // Default score
      
      for (const rule of this.config.contactConfig.scoringRules) {
        // Skip rules that don't apply
        if (!(rule.parameter in contact)) continue;
        
        const contactValue = (contact as any)[rule.parameter];
        const ruleValue = rule.value;
        
        let matches = false;
        switch (rule.condition) {
          case "equals":
            matches = contactValue === ruleValue;
            break;
          case "notEquals":
            matches = contactValue !== ruleValue;
            break;
          case "greaterThan":
            matches = contactValue > ruleValue;
            break;
          case "lessThan":
            matches = contactValue < ruleValue;
            break;
          case "contains":
            matches = String(contactValue).includes(String(ruleValue));
            break;
          case "notContains":
            matches = !String(contactValue).includes(String(ruleValue));
            break;
        }
        
        if (matches) {
          score += rule.score;
        }
      }
      
      return { ...contact, score };
    });
    
    // Sort by score (highest first)
    return scoredContacts.sort((a: any, b: any) => b.score - a.score);
  }
}