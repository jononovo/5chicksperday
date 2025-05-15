import type { Company, Contact } from "@shared/schema";
import { queryPerplexity } from "./api/perplexity-client";
import type { PerplexityMessage } from "./types/perplexity";
import { 
  analyzeWithPerplexity, 
  discoverContactsDirectly 
} from "./perplexity";
import { 
  analyzeCompanySize, 
  analyzeDifferentiators,
  calculateCompanyScore 
} from "./results-analysis/company-analysis";

// Core search functions
export async function searchCompanies(query: string): Promise<string[]> {
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: `You are a business intelligence analyst. Return ONLY a list of 5 real company names that match this search criteria. Each company should be:
      1. A real, verifiable business entity
      2. Not a generic business term or category
      3. Not a department or division name
      4. Return full company names (e.g. "Microsoft Corporation" not just "Microsoft")

      Format your response as a simple list with one company name per line, nothing else.`
    },
    {
      role: "user",
      content: `Find 5 companies that match this criteria: ${query}`
    }
  ];

  const response = await queryPerplexity(messages);
  const companies = response.split('\n')
    .filter(line => line.trim())
    .slice(0, 5);

  // Validate company names
  const validatedCompanies = companies.filter(name => {
    // Remove common suffixes for comparison
    const cleanName = name.toLowerCase()
      .replace(/(inc|llc|ltd|corp|co|company|group|holdings)$/, '')
      .trim();

    // Reject if too short or contains generic terms
    if (cleanName.length < 3 || /\b(sales|service|team|department)\b/.test(cleanName)) {
      return false;
    }

    return true;
  });

  return validatedCompanies;
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

// Export the additional function
export { discoverContactsDirectly };