import type { Company, Contact } from "@shared/schema";
import { queryPerplexity } from "./api/perplexity-client";
import type { PerplexityMessage } from "./types/perplexity";
import { analyzeWithPerplexity } from "./perplexity";
import { 
  analyzeCompanySize, 
  analyzeDifferentiators,
  calculateCompanyScore 
} from "./results-analysis/company-analysis";
import { validateName } from "./results-analysis/contact-name-validation";
import { extractContacts } from "./results-analysis/email-extraction-format";
import { validateNames } from "./results-analysis/contact-ai-name-scorer";
import { findKeyDecisionMakers } from "./search-logic/contact-discovery/enhanced-contact-finder";
import { cleanPerplexityResponse } from "./utils";

// Core search functions
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

export async function analyzeCompany(
  companyName: string,
  userPrompt: string,
  technicalPrompt?: string | null,
  responseStructure?: string | null
): Promise<string> {
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: technicalPrompt || "You are a business intelligence analyst providing detailed company information."
    },
    {
      role: "user",
      content: (userPrompt || "").replace("[COMPANY]", companyName)
    }
  ];

  if (responseStructure) {
    messages[0].content += `\n\nFormat your response as JSON:\n${responseStructure}`;
  }

  return queryPerplexity(messages);
}

// Export the functions we need
export { validateNames, extractContacts };