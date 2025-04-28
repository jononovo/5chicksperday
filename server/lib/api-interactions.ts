import type { Company, Contact } from "@shared/schema";
import { validateNames } from "./results-analysis/contact-ai-name-scorer";
import { isPlaceholderEmail, isValidBusinessEmail, parseEmailDetails } from "./results-analysis/email-analysis";
import { queryPerplexity } from "./api/perplexity-client";
import type { PerplexityMessage } from "./types/perplexity";
import { analyzeWithPerplexity } from "./perplexity";

// Define the SearchOptions type
export interface SearchOptions {
  excludeFranchises?: boolean;
  highValue?: boolean;
  triplePrompt?: boolean;
  focusOnSeniorRoles?: boolean;
  includePatternMatching?: boolean;
  [key: string]: boolean | undefined;
}

// Company search and analysis functions
export async function searchCompanies(query: string, options?: Record<string, boolean>): Promise<string[]> {
  // Prepare system prompt with instructions based on options
  let systemContent = "You are a business intelligence analyst. List exactly 5 real company names that match the search criteria.";
  
  // Apply options to modify the search behavior
  if (options) {
    if (options.excludeFranchises) {
      systemContent += " Do NOT include any franchise businesses in your results.";
    }
    
    if (options.highValue) {
      systemContent += " Focus on higher-value businesses with established presence and good reputation.";
    }
  }
  
  // Always include formatting instructions at the end
  systemContent += " Format your response as a simple list with one company name per line, nothing else.";
  
  // Construct query content with options
  let queryContent = `Find 5 companies that match this criteria: ${query}`;
  
  // Add specific query modifiers based on options
  if (options?.highValue) {
    queryContent += ". Focus on well-established businesses with significant market presence.";
  }
  
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: systemContent
    },
    {
      role: "user",
      content: queryContent
    }
  ];

  // If triplePrompt is enabled, make multiple requests and combine results
  if (options?.triplePrompt) {
    console.log("Using triple prompt approach for better results");
    
    // Make three separate requests with slightly different prompts
    const responses = await Promise.all([
      queryPerplexity(messages),
      queryPerplexity([
        { role: "system", content: systemContent + " Prioritize diversity in business types." },
        { role: "user", content: queryContent + " Include a variety of business sizes and types." }
      ]),
      queryPerplexity([
        { role: "system", content: systemContent + " Look for businesses with online presence." },
        { role: "user", content: queryContent + " Ensure businesses have websites and contact information." }
      ])
    ]);
    
    // Combine and deduplicate results
    const allCompanies = responses.flatMap(response => 
      response.split('\n').filter(line => line.trim())
    );
    
    // Remove duplicates and take top 5
    const uniqueCompanies = [...new Set(allCompanies)];
    return uniqueCompanies.slice(0, 5);
  }
  
  // Standard single request approach
  const response = await queryPerplexity(messages);
  return response.split('\n').filter(line => line.trim()).slice(0, 5);
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

export async function searchContactDetails(
  name: string,
  company: string,
  options?: Record<string, boolean>
): Promise<Partial<Contact>> {
  // Base system content
  let systemContent = `You are a contact information researcher. Find professional information about the specified person. Include:
    1. Role and department
    2. Professional email
    3. LinkedIn URL
    4. Location`;
  
  // Modify based on options
  if (options?.focusOnSeniorRoles) {
    systemContent += `\n\nPrioritize finding information about senior executives, founders, or leadership team members.`;
  }
  
  if (options?.includePatternMatching) {
    systemContent += `\n\nIf you cannot find the exact email, predict it based on common email patterns for the company.`;
  }
  
  // Always format as JSON
  systemContent += `\n\nFormat your response in JSON.`;
  
  // Customize query based on options
  let queryContent = `Find professional contact information for ${name} at ${company}.`;
  
  if (options?.focusOnSeniorRoles) {
    queryContent += ` If ${name} is not in a leadership role, identify a senior decision maker instead.`;
  }
  
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: systemContent
    },
    {
      role: "user",
      content: queryContent
    }
  ];

  const response = await queryPerplexity(messages);
  const parsedDetails = parseEmailDetails(response);
  
  // Enhanced validation for emails if pattern matching is enabled
  if (options?.includePatternMatching && parsedDetails.email) {
    // Ensure emails follow common patterns if they were predicted
    const emailParts = parsedDetails.email.split('@');
    if (emailParts.length === 2) {
      const [username, domain] = emailParts;
      
      // Apply additional confidence scoring for pattern-matched emails
      if (parsedDetails.probability !== null) {
        // If using pattern matching, we might be less certain about the email
        parsedDetails.probability = Math.min(parsedDetails.probability, 0.85);
      }
    }
  }
  
  return parsedDetails;
}

export { validateNames };