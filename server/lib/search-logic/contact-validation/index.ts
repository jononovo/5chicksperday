/**
 * Contact Validation Module
 * 
 * Centralizes all contact validation, scoring, and processing logic
 * to ensure consistent handling of contacts throughout the application.
 */

import { analyzeWithPerplexity } from "../../perplexity";
import { Contact } from "../../../../shared/schema";
import { isLeadershipRole, getRoleMultiplier } from "../utils/company-utils";
import { extractContacts as originalExtractContacts } from "../../perplexity";

/**
 * Validate names using the Perplexity AI API
 * Determines if a name is a real human name (not a role, department, or descriptor)
 * 
 * @param names List of names to validate
 * @param companyContext Optional company context for better AI analysis
 * @returns Object mapping each name to a confidence score (0-100)
 */
export async function validateNames(
  names: string[], 
  companyContext?: string
): Promise<Record<string, number>> {
  // Prepare a clear prompt for the AI
  const prompt = `
    For each name in the list below, determine if it is a real human name (not a role, department, or generic descriptor).
    Return a confidence score from 0-100 for each name, where:
    - 0-20: Definitely not a human name (e.g., "Financial Officer", "Key Advisors", "Project Manager", "Department Heads", "Executive Leadership")
    - 21-50: Potentially a human name but unclear or generic sounding
    - 51-80: Likely a human name
    - 81-100: Definitely a human name

    It's very important to identify non-human entries like "Department Heads", "Key Contacts", "Decision Maker", etc. and give them scores below 20.
    Job titles and generic roles should never be considered human names.
    
    Names to evaluate: ${names.join(', ')}
    
    Company context: ${companyContext || 'Unknown'}
    
    For each name, return only the name and the numerical score separated by a colon.
  `;
  
  try {
    // Use the Perplexity API
    const response = await analyzeWithPerplexity(
      prompt,
      "You are an expert at identifying genuine human names versus generic roles or titles."
    );
    
    // Parse the results
    const results: Record<string, number> = {};
    
    names.forEach(name => {
      // Default low score
      results[name] = 30;
      
      // First apply a pre-check pattern for obvious non-human entries
      if (/^(additional|identify|eisenhower|executive|international|middle|east|west|north|south|matrix|information|note|key|task|impact)$/i.test(name) || 
          name.includes('**') || 
          name.includes('including') ||
          name.includes(':') ||
          /^team\s+/i.test(name)) {
        results[name] = 5; // Very low score for obvious non-human entries
        return; // Skip to next name in forEach
      }
      
      // Try to find this name in the response
      const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\s]+(\\d+)`, 'i');
      const match = response.match(pattern);
      
      if (match && match[1]) {
        const score = parseInt(match[1], 10);
        results[name] = isNaN(score) ? 30 : score;
      }
    });
    
    console.log("AI name validation results:", results);
    return results;
    
  } catch (error) {
    console.error("Error validating names with AI:", error);
    
    // Fallback with more sophisticated checks
    const results: Record<string, number> = {};
    names.forEach(name => {
      // First check for non-human patterns
      if (/^(additional|identify|eisenhower|executive|international|middle|east|west|north|south|matrix|information|note|key|task|impact)$/i.test(name) || 
          name.includes('**') || 
          name.includes('including') ||
          name.includes(':') ||
          /^team\s+/i.test(name)) {
        results[name] = 5; // Very low score for obvious non-human entries
        return;
      }
      
      // Check if this looks like a real name (First + Last)
      const words = name.split(/\s+/);
      const hasProperCapitalization = words.every(word => word.length > 0 && word[0] === word[0].toUpperCase());
      const isProperLength = words.length >= 2 && words.length <= 4; // Most real names are 2-4 words
      
      if (hasProperCapitalization && isProperLength) {
        results[name] = 75; // Higher confidence for properly capitalized, multi-word names
      } else if (words.length >= 2) {
        results[name] = 60; // Medium confidence for multi-word names
      } else {
        results[name] = 30; // Lower confidence for single-word entries
      }
    });
    
    return results;
  }
}

/**
 * Score a contact using our hierarchical scoring approach:
 * 1. Base score from real human name validation
 * 2. Additional points for leadership position
 * 3. Additional points for role clarity
 * 4. Small bonus for email
 * 
 * @param contact The contact to score
 * @param nameScores Validation scores for names (from validateNames)
 * @returns The same contact with updated probability score
 */
export function scoreContact(
  contact: Partial<Contact>,
  nameScores: Record<string, number>
): Partial<Contact> {
  if (!contact.name) {
    return { ...contact, probability: 0 };
  }
  
  // 1. Base score from AI name validation (0-45 points)
  let nameScore = 0;
  if (nameScores[contact.name]) {
    // Scale the AI confidence score to range 0-45
    nameScore = Math.min(45, nameScores[contact.name] * 0.45);
  }
  
  // 2. Leadership position score (0-25 points)
  const leadershipScore = getLeadershipScore(contact.role);
  
  // 3. Role clarity score (0-15 points)
  const roleClarity = getRoleClarity(contact.role);
  
  // 4. Email quality bump (0-10 points)
  const emailBonus = getEmailBonus(contact.email);
  
  // Calculate total probability with a cap
  // Even with a perfect score in all categories, it would max at 95
  // This ensures 100 is reserved for exceptional cases only
  const probability = Math.min(95, 
    nameScore + leadershipScore + roleClarity + emailBonus
  );
  
  console.log(`Contact scoring for "${contact.name}":`, {
    nameScore,
    leadershipScore,
    roleClarity,
    emailBonus,
    totalProbability: probability
  });
  
  return {
    ...contact,
    probability: Math.round(probability),
    nameConfidenceScore: nameScores[contact.name] || 0
  };
}

/**
 * Get leadership score based on role
 * @param role Contact's role/title
 * @returns Score between 0-35 (higher for more senior leadership positions)
 */
function getLeadershipScore(role?: string | null): number {
  if (!role) return 0;
  
  const roleLower = role.toLowerCase();
  
  // Primary leaders (CEO, Founder, President) - these are the highest value contacts
  if (/(^|\s)(ceo|chief executive officer|founder|co-founder|president|chairman|chairperson|owner)($|\s)/i.test(roleLower)) {
    return 35; // Increase from 25 to give higher probability to top leadership
  }
  
  // C-Suite/Executive leadership - also highly valuable
  if (/(^|\s)(cto|chief technology|cfo|chief financial|coo|chief operating|chief|executive|vp|vice president)($|\s)/i.test(roleLower)) {
    return 30; // Increase from 20
  }
  
  // Department leaders - decision makers
  if (/(^|\s)(director|head of|lead|senior manager|general manager)($|\s)/i.test(roleLower)) {
    return 25; // Increase from 15
  }
  
  // Manager level - still important
  if (/(^|\s)(manager|business development)($|\s)/i.test(roleLower)) {
    return 15;
  }
  
  // Other leadership mentions
  if (/(^|\s)(partner|principal|senior|leader|specialist|advisor)($|\s)/i.test(roleLower)) {
    return 10;
  }
  
  return 0;
}

/**
 * Assess how clearly defined a role is
 * @param role Contact's role/title
 * @returns Score between 0-15
 */
function getRoleClarity(role?: string | null): number {
  if (!role) return 0;
  
  // Check if role contains specific department or function
  if (/(marketing|sales|engineering|product|finance|hr|operations)/i.test(role)) {
    return 15;
  }
  
  // Check if role is somewhat specific but not departmental
  if (role.length > 5 && !/unknown/i.test(role)) {
    return 10;
  }
  
  return 5;
}

/**
 * Calculate email quality bonus
 * @param email Contact's email address
 * @returns Score between 0-10
 */
function getEmailBonus(email?: string | null): number {
  if (!email) return 0;
  
  // Base score for having any email
  let score = 3;
  
  // Valid email format
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    score += 2;
    
    // Business email (not a common personal provider)
    if (!/(gmail|yahoo|hotmail|outlook|aol|proton|mail)\.com$/i.test(email)) {
      score += 3;
      
      // Company domain matches
      if (email.includes('@') && email.split('@')[1].includes('.')) {
        score += 2;
      }
    }
  }
  
  return score;
}

/**
 * Process and validate a list of contacts
 * Uses AI to validate names and applies hierarchical scoring
 * 
 * @param contacts List of contacts to validate
 * @param companyName Company name for context
 * @param options Optional processing options
 * @returns Filtered and scored contacts
 */
export async function validateContacts(
  contacts: Partial<Contact>[],
  companyName: string,
  options?: {
    minimumScore?: number;
    prioritizeLeadership?: boolean;
  }
): Promise<Partial<Contact>[]> {
  if (!contacts.length) return [];
  
  const minimumScore = options?.minimumScore || 30;
  
  // Extract names for validation
  const names = contacts
    .map(c => c.name)
    .filter((name): name is string => !!name);
  
  // Get name validation scores from AI
  let nameScores: Record<string, number> = {};
  if (names.length > 0) {
    nameScores = await validateNames(names, companyName);
  }
  
  // Score all contacts
  const scoredContacts = contacts.map(contact => 
    scoreContact(contact, nameScores)
  );
  
  // Filter low-quality contacts with enhanced non-human detection
  const validContacts = scoredContacts.filter(contact => {
    if (!contact.name) return false;
    const name = contact.name;
    
    // First check - obvious non-human patterns based on keywords and formatting
    if (/^(additional|identify|eisenhower|executive|international|middle|east|west|north|south|matrix|information|note|key|task|impact)$/i.test(name) || 
        name.includes('**') || 
        name.includes('including') ||
        name.includes(':') ||
        /^team\s+/i.test(name) ||
        name === "Vice President") {  // Special case for "Vice President" without a name
      console.log(`Filtering out non-human text: "${name}" (direct pattern match)`);
      return false;
    }
    
    // Second check - look for sentence fragments and descriptive text
    if (name.toLowerCase().startsWith('he is') || 
        name.toLowerCase().startsWith('she is') || 
        name.toLowerCase().startsWith('they are') ||
        name.includes('to categorize') ||
        name.includes('Note:') ||
        name.toLowerCase().includes('executive officer') ||
        name.toLowerCase().includes('team member')) {
      console.log(`Filtering out sentence fragment: "${name}"`);
      return false;
    }
    
    // Third check - If AI gave a very low score for this name, filter it out
    const nameConfidence = nameScores[name] || 0;
    if (nameConfidence < 20) {
      console.log(`Filtering out non-human name: "${name}" (AI score: ${nameConfidence})`);
      return false;
    }
    
    // Fourth check - leadership titles without names
    if (/^(ceo|cfo|cio|cto|chief|senior|junior|executive|officer|director|head|lead|manager)$/i.test(name)) {
      console.log(`Filtering out title without name: "${name}"`);
      return false;
    }
    
    // Final check - minimum overall score
    const passes = (contact.probability || 0) >= minimumScore;
    if (!passes) {
      console.log(`Filtering out low-probability contact: "${name}" (score: ${contact.probability})`);
    }
    return passes;
  });
  
  // Sort by score if requested to prioritize leadership
  if (options?.prioritizeLeadership) {
    validContacts.sort((a, b) => (b.probability || 0) - (a.probability || 0));
  }
  
  // Log summary for debugging
  console.log(`Contact validation summary for ${companyName}:`, {
    totalContacts: contacts.length,
    validContacts: validContacts.length,
    averageScore: validContacts.reduce((sum, c) => sum + (c.probability || 0), 0) / (validContacts.length || 1),
    highestScore: validContacts.length ? Math.max(...validContacts.map(c => c.probability || 0)) : 0
  });
  
  return validContacts;
}

/**
 * Extract and validate contacts from text analysis
 * 
 * @param analysisResults Results from company analysis
 * @param companyName Company name for context
 * @param options Optional extraction options
 * @returns Validated contacts
 */
export async function extractAndValidateContacts(
  analysisResults: string[],
  companyName: string,
  options?: {
    minimumScore?: number;
    prioritizeLeadership?: boolean;
    searchPrompt?: string;
  }
): Promise<Partial<Contact>[]> {
  // First extract raw contacts using existing method
  const extractedContacts = await originalExtractContacts(
    analysisResults,
    companyName,
    {
      minimumScore: options?.minimumScore || 15, // Use a lower score initially to capture more contacts
      searchPrompt: options?.searchPrompt
    }
  );
  
  // Then validate and score them
  return validateContacts(extractedContacts, companyName, options);
}