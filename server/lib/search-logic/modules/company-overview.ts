/**
 * Company Overview Module
 * 
 * This module provides basic company overview functionality.
 * It focuses on gathering general information about companies.
 */

import { BaseSearchModule, type SearchModuleContext, type SearchModuleResult } from '../base-module';
import { analyzeCompany } from '../core-search';
import { isFranchise, isLocalHeadquarter, calculateCompanyScore } from '../utils/company-utils';

/**
 * Module for providing company overviews
 */
export class CompanyOverviewModule extends BaseSearchModule {
  /**
   * Execute the company overview search
   */
  async execute({ query, config }: SearchModuleContext): Promise<SearchModuleResult> {
    // Default response structure for company overviews
    const responseStructure = `{
      "size": "Company size (number of employees)",
      "services": "Main services or products",
      "marketPosition": "Market position and competitive advantages",
      "differentiators": "Key differentiators"
    }`;
    
    // Default prompt template
    const defaultPrompt = `Provide a detailed overview of [COMPANY] including company size, services, market position, and key differentiators.`;
    
    // Use configuration if provided, otherwise defaults
    const promptTemplate = config.promptTemplates?.overview || defaultPrompt;
    const structure = config.responseStructures?.overview || responseStructure;
    
    try {
      // First, attempt to extract company name from query
      let companyName = query;
      
      // Skip companies that match exclusion filters if configured
      if (config.ignoreFranchises && isFranchise(companyName)) {
        return {
          companies: [],
          contacts: [],
          metadata: {
            moduleType: 'company_overview',
            completedSearches: ['franchise_filter'],
            validationScores: {
              franchise_filter: 0
            }
          }
        };
      }
      
      if (config.locallyHeadquartered && !isLocalHeadquarter(companyName)) {
        return {
          companies: [],
          contacts: [],
          metadata: {
            moduleType: 'company_overview',
            completedSearches: ['headquarters_filter'],
            validationScores: {
              headquarters_filter: 0
            }
          }
        };
      }
      
      // Make API request to get company details
      const result = await analyzeCompany(
        companyName,
        promptTemplate,
        "You are a business intelligence analyst providing detailed company information. Focus on accuracy and factual information only.",
        structure
      );
      
      // Parse the result JSON
      let companyData: Record<string, any> = {};
      try {
        companyData = JSON.parse(result);
      } catch (error) {
        // If JSON parsing fails, still proceed with the raw text
        companyData = {
          description: result,
          parseError: true
        };
      }
      
      // Create company object
      const company = {
        name: companyName,
        description: companyData.description || companyData.marketPosition || result,
        size: companyData.size || null,
        services: companyData.services || null,
        snapshot: {
          ...companyData,
          source: 'company_overview_module'
        }
      };
      
      // Calculate a quality score for this company
      const qualityScore = calculateCompanyScore(company);
      
      // Return well-formatted result
      return {
        companies: [company],
        contacts: [],
        metadata: {
          moduleType: 'company_overview',
          completedSearches: ['company_analysis'],
          validationScores: {
            company_quality: qualityScore
          }
        }
      };
    } catch (error) {
      console.error('Error in CompanyOverviewModule', error);
      
      // Return empty result on error
      return {
        companies: [],
        contacts: [],
        metadata: {
          moduleType: 'company_overview',
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
    // No companies found
    if (result.companies.length === 0) {
      return false;
    }
    
    // Check minimum confidence requirement if specified
    const qualityScore = result.metadata?.validationScores?.company_quality || 0;
    const minimumConfidence = 50; // Default minimum confidence
    
    return qualityScore >= minimumConfidence;
  }
}