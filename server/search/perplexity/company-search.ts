import type { Company, Contact } from "@shared/schema";
import { queryPerplexity } from "./perplexity-client";
import type { PerplexityMessage } from "./perplexity-types";
import { analyzeWithPerplexity } from "./perplexity-utils";
import { findKeyDecisionMakers } from "../contacts/finder";
import { cleanPerplexityResponse } from "../../lib/utils";

// Core search functions

// Fast discovery - just get names and websites for immediate display (5-7 seconds)
export async function discoverCompanies(query: string): Promise<Array<{name: string, website: string | null}>> {
  console.log(`[PERPLEXITY API CALL] discoverCompanies called with query: "${query}"`);
  console.log(`[PERPLEXITY API CALL] Timestamp: ${new Date().toISOString()}`);
  
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: "Be precise and concise. Return results immediately. Website: Only include the official domain." 
    },
    {
      role: "user",
      content: `List 7 companies matching: ${query}
Return ONLY company names and websites. Be concise.
Format: JSON array with "name" and "website" fields.`
    }
  ];

  const startTime = Date.now();
  let response = '';
  
  try {
    console.log(`[PERPLEXITY API CALL] Making fast discovery request to Perplexity`);
    response = await queryPerplexity(messages);
    const elapsed = Date.now() - startTime;
    console.log(`[PERPLEXITY API CALL] Discovery completed in ${elapsed}ms`);
    console.log('Raw Perplexity discovery response:', response);
    
    const cleanedResponse = cleanPerplexityResponse(response);
    const jsonMatch = cleanedResponse.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    const jsonString = jsonMatch ? jsonMatch[1] : cleanedResponse;
    
    try {
      const parsed = JSON.parse(jsonString);
      const companiesArray = Array.isArray(parsed) ? parsed : 
                          (parsed.companies && Array.isArray(parsed.companies) ? parsed.companies : null);
      
      if (companiesArray) {
        const companies = companiesArray.slice(0, 7).map((company: {name: string, website?: string}) => ({
          name: company.name,
          website: company.website || null
        }));
        console.log(`Successfully discovered ${companies.length} companies in ${elapsed}ms`);
        return companies;
      }
    } catch (jsonError) {
      console.error('JSON parsing failed in discovery:', jsonError);
    }
    
    // Fallback parsing for just names and websites
    const nameMatches = cleanedResponse.match(/"name":\s*"([^"]*)"/g) || [];
    const websiteMatches = cleanedResponse.match(/"website":\s*"([^"]*)"/g) || [];
    
    const companies = [];
    for (let i = 0; i < nameMatches.length && companies.length < 7; i++) {
      const nameMatch = nameMatches[i].match(/"name":\s*"([^"]*)"/);
      if (nameMatch && nameMatch[1]) {
        let website = null;
        if (i < websiteMatches.length) {
          const websiteMatch = websiteMatches[i].match(/"website":\s*"([^"]*)"/);
          website = websiteMatch && websiteMatch[1] ? websiteMatch[1].trim() : null;
        }
        companies.push({
          name: nameMatch[1].trim(),
          website: website
        });
      }
    }
    
    if (companies.length > 0) {
      console.log(`Extracted ${companies.length} companies using fallback in ${elapsed}ms`);
      return companies;
    }
    
    return [];
  } catch (error) {
    console.error('Error in company discovery:', error);
    return [];
  }
}

// Enrichment - get descriptions (can run in parallel with contact search)
export async function enrichCompanyDetails(companies: Array<{name: string, website: string | null}>): Promise<Array<{name: string, description: string | null}>> {
  if (!companies.length) {
    return [];
  }
  
  console.log(`[PERPLEXITY API CALL] enrichCompanyDetails called for ${companies.length} companies`);
  
  const companyList = companies.map(c => `${c.name}${c.website ? ` (${c.website})` : ''}`).join(', ');
  
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: "Provide concise 1-2 sentence descriptions of what each company does." 
    },
    {
      role: "user",
      content: `For these companies: ${companyList}
Provide a brief description (1-2 sentences) for each.
Format: JSON array with "name" and "description" fields.`
    }
  ];

  const startTime = Date.now();
  
  try {
    console.log(`[PERPLEXITY API CALL] Making enrichment request to Perplexity`);
    const response = await queryPerplexity(messages);
    const elapsed = Date.now() - startTime;
    console.log(`[PERPLEXITY API CALL] Enrichment completed in ${elapsed}ms`);
    
    const cleanedResponse = cleanPerplexityResponse(response);
    const jsonMatch = cleanedResponse.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    const jsonString = jsonMatch ? jsonMatch[1] : cleanedResponse;
    
    try {
      const parsed = JSON.parse(jsonString);
      const enrichedArray = Array.isArray(parsed) ? parsed : 
                          (parsed.companies && Array.isArray(parsed.companies) ? parsed.companies : []);
      
      const enrichedData = enrichedArray.map((item: {name: string, description?: string}) => ({
        name: item.name,
        description: item.description || null
      }));
      
      console.log(`Successfully enriched ${enrichedData.length} companies in ${elapsed}ms`);
      return enrichedData;
    } catch (jsonError) {
      console.error('Failed to parse enrichment response:', jsonError);
      // Return empty descriptions on failure
      return companies.map(c => ({ name: c.name, description: null }));
    }
  } catch (error) {
    console.error('Error enriching company details:', error);
    // Return empty descriptions on failure
    return companies.map(c => ({ name: c.name, description: null }));
  }
}

// Legacy function - kept for backward compatibility
export async function searchCompanies(query: string): Promise<Array<{name: string, website: string | null, description: string | null}>> {
  console.log(`[PERPLEXITY API CALL] searchCompanies called with query: "${query}"`);
  console.log(`[PERPLEXITY API CALL] Timestamp: ${new Date().toISOString()}`);
  
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: "Be precise and concise. Website: Only include the official domain, otherwise leave empty." 
    },
    {
      role: "user",
      content: `Find companies that match this criteria: ${query}. 
Please output a JSON array containing 7 objects, where each object has exactly three fields:
"name" (the company name),
"website" (the company's official domain), and
"description" (a 1-2 sentence description of what the company does).`
    }
  ];

  // Declare response variable in outer scope for error handling
  let response = '';
  
  try {
    // Get response from Perplexity API
    console.log(`[PERPLEXITY API CALL] Making external API request to Perplexity`);
    response = await queryPerplexity(messages);
    console.log('Raw Perplexity response:', response);
    console.log(`[PERPLEXITY API CALL] Successfully received response from Perplexity`);
    
    // Clean the response to handle any unexpected formatting
    const cleanedResponse = cleanPerplexityResponse(response);
    
    // Extract a JSON array if present
    const jsonMatch = cleanedResponse.match(/(\[\s*\{[\s\S]*?\}\s*\])/);
    const jsonString = jsonMatch ? jsonMatch[1] : cleanedResponse;
    
    try {
      // Parse the JSON response
      const parsed = JSON.parse(jsonString);
      
      // Handle either a direct array or a nested "companies" property
      const companiesArray = Array.isArray(parsed) ? parsed : 
                          (parsed.companies && Array.isArray(parsed.companies) ? parsed.companies : null);
      
      if (companiesArray) {
        // Map to our standard format and return up to 7 companies
        const companies = companiesArray.slice(0, 7).map((company: {name: string, website?: string, description?: string}) => ({
          name: company.name,
          website: company.website || null,
          description: company.description || null
        }));
        console.log('Successfully parsed companies:', companies);
        return companies;
      }
    } catch (jsonError) {
      console.error('JSON parsing failed:', jsonError);
    }
    
    // If we couldn't parse JSON properly, use a simple regex extraction as fallback
    console.log('Falling back to regex extraction');
    const nameMatches = cleanedResponse.match(/"name":\s*"([^"]*)"/g) || [];
    const websiteMatches = cleanedResponse.match(/"website":\s*"([^"]*)"/g) || [];
    const descriptionMatches = cleanedResponse.match(/"description":\s*"([^"]*)"/g) || [];
    
    const companies = [];
    for (let i = 0; i < nameMatches.length && companies.length < 7; i++) {
      const nameMatch = nameMatches[i].match(/"name":\s*"([^"]*)"/);
      if (nameMatch && nameMatch[1]) {
        // Find corresponding website if available
        let website = null;
        if (i < websiteMatches.length) {
          const websiteMatch = websiteMatches[i].match(/"website":\s*"([^"]*)"/);
          website = websiteMatch && websiteMatch[1] ? websiteMatch[1].trim() : null;
        }
        
        // Find corresponding description if available
        let description = null;
        if (i < descriptionMatches.length) {
          const descriptionMatch = descriptionMatches[i].match(/"description":\s*"([^"]*)"/);
          description = descriptionMatch && descriptionMatch[1] ? descriptionMatch[1].trim() : null;
        }
        
        companies.push({
          name: nameMatch[1].trim(),
          website: website,
          description: description
        });
      }
    }
    
    if (companies.length > 0) {
      console.log('Extracted companies using regex fallback:', companies);
      return companies;
    }
    
    // If no companies found, return empty array
    return [];
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    
    // Try to extract company names from the JSON-like structure even if parsing failed
    try {
      const companyLines = response.split('\n')
        .filter((line: string) => line.trim() && !line.includes('```') && !line.includes('[') && !line.includes(']'))
        .filter((line: string) => line.includes('"name":'))
        .map((line: string) => {
          const nameMatch = line.match(/"name":\s*"([^"]+)"/);
          // Try to find a website in the same line
          const websiteMatch = line.match(/"website":\s*"([^"]*)"/);
          const website = websiteMatch && websiteMatch[1] ? websiteMatch[1] : null;
          
          return {
            name: nameMatch ? nameMatch[1] : line,
            website: website,
            description: null
          };
        })
        .slice(0, 5);
        
      if (companyLines.length > 0) {
        console.log('Extracted companies from JSON lines after parse error:', companyLines);
        return companyLines;
      }
    } catch (extractError) {
      console.error('Error extracting company names from lines:', extractError);
    }
    
    // Last resort fallback to original parsing method
    const companies = response.split('\n')
      .filter((line: string) => line.trim())
      .slice(0, 5)
      .map((name: string) => ({ name, website: null, description: null }));
      
    console.log('Fallback company data after JSON parse error:', companies);
    return companies;
  }
}