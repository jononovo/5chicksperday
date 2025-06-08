import { Contact } from "@shared/schema";
import { analyzeWithPerplexity } from "../../perplexity";
import { isPlaceholderName } from "../../results-analysis/name-filters";
import { validateName } from "../../results-analysis/contact-name-validation";
import { extractDomainFromContext } from "../../results-analysis/email-analysis";
import { INDUSTRY_PROFESSIONAL_TITLES } from "../../results-analysis/name-filters";
import { applyCustomRoleAffinityScoring } from "../../results-analysis/custom-role-affinity-scorer";
import { SmartFallbackManager } from "./smart-fallback-manager";
import { SearchPerformanceLogger } from "./search-performance-logger";

/**
 * Enhanced contact finder that uses industry-specific prompts
 * to discover more decision makers at a company
 */
export interface EnhancedContactFinderOptions {
  minimumConfidence?: number;
  maxContacts?: number;
  includeMiddleManagement?: boolean;
  prioritizeLeadership?: boolean;
  includeEmailPredictions?: boolean;
  useMultipleQueries?: boolean;
  industry?: string;
  // New configuration options from frontend
  enableCoreLeadership?: boolean;
  enableDepartmentHeads?: boolean;
  enableMiddleManagement?: boolean;
  enableCustomSearch?: boolean;
  customSearchTarget?: string;
  enableCustomSearch2?: boolean;
  customSearchTarget2?: string;
}

const DEFAULT_OPTIONS: EnhancedContactFinderOptions = {
  minimumConfidence: 30,
  maxContacts: 10,
  includeMiddleManagement: true,
  prioritizeLeadership: true,
  includeEmailPredictions: true,
  useMultipleQueries: true,
  enableCoreLeadership: true,
  enableDepartmentHeads: true,
  enableMiddleManagement: true,
  enableCustomSearch: false,
  customSearchTarget: "",
  enableCustomSearch2: false,
  customSearchTarget2: ""
};

/**
 * Find key decision makers at a company using multiple specialized queries
 * to improve contact discovery
 */
export async function findKeyDecisionMakers(
  companyName: string,
  options: EnhancedContactFinderOptions = {}
): Promise<Partial<Contact>[]> {
  try {
    // Merge with default options
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Start performance logging session
    const sessionId = SearchPerformanceLogger.startSession(companyName, mergedOptions);
    
    // Initialize empty contacts array
    const allContacts: Partial<Contact>[] = [];
    
    // Run different searches based on context for better coverage
    console.log(`Running enhanced decision maker search for ${companyName}`);
    
    // Get industry-specific roles if available
    const industry = mergedOptions.industry || detectIndustry(companyName);
    console.log(`Detected industry context: ${industry || "unknown"}`);
    
    // 1. Core leadership search - only if enabled, with threshold checking
    const coreStartTime = Date.now();
    if (mergedOptions.enableCoreLeadership) {
      console.log(`Running core leadership search for ${companyName}`);
      const coreLeadership = await searchCoreLeadership(companyName, industry);
      allContacts.push(...coreLeadership);
      
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Core Leadership', 
        true, 
        true, 
        coreLeadership, 
        Date.now() - coreStartTime
      );
      
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check if we should continue searching
      if (!SmartFallbackManager.shouldContinueSearching(allContacts, 'department heads')) {
        console.log(`Early termination: Sufficient contacts found after core leadership search`);
      }
    } else {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Core Leadership', 
        false, 
        false, 
        [], 
        0, 
        'disabled'
      );
    }
    
    // 2. Department heads search - only if enabled and we should continue
    const deptStartTime = Date.now();
    if (mergedOptions.enableDepartmentHeads && SmartFallbackManager.shouldContinueSearching(allContacts, 'department heads')) {
      console.log(`Running department heads search for ${companyName}`);
      const departmentHeads = await searchDepartmentHeads(companyName, industry);
      allContacts.push(...departmentHeads);
      
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Department Heads', 
        true, 
        true, 
        departmentHeads, 
        Date.now() - deptStartTime
      );
      
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    } else if (mergedOptions.enableDepartmentHeads) {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Department Heads', 
        true, 
        false, 
        [], 
        0, 
        'sufficient contacts found'
      );
    } else {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Department Heads', 
        false, 
        false, 
        [], 
        0, 
        'disabled'
      );
    }
    
    // 3. Middle management search - only if enabled and we should continue
    const middleStartTime = Date.now();
    if (mergedOptions.enableMiddleManagement && SmartFallbackManager.shouldContinueSearching(allContacts, 'middle management')) {
      console.log(`Running middle management search for ${companyName}`);
      const middleManagement = await searchMiddleManagement(companyName, industry);
      allContacts.push(...middleManagement);
      
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Middle Management', 
        true, 
        true, 
        middleManagement, 
        Date.now() - middleStartTime
      );
      
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    } else if (mergedOptions.enableMiddleManagement) {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Middle Management', 
        true, 
        false, 
        [], 
        0, 
        'sufficient contacts found'
      );
    } else {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Middle Management', 
        false, 
        false, 
        [], 
        0, 
        'disabled'
      );
    }
    
    // 4. Custom search - only if enabled, target provided, and we should continue
    const customStartTime = Date.now();
    if (mergedOptions.enableCustomSearch && 
        mergedOptions.customSearchTarget?.trim() && 
        SmartFallbackManager.shouldContinueSearching(allContacts, 'custom search')) {
      console.log(`Running custom search for "${mergedOptions.customSearchTarget}" at ${companyName}`);
      const customContacts = await searchCustomTarget(companyName, mergedOptions.customSearchTarget, industry);
      allContacts.push(...customContacts);
      
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Custom Search', 
        true, 
        true, 
        customContacts, 
        Date.now() - customStartTime
      );
      
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 200));
    } else if (mergedOptions.enableCustomSearch && mergedOptions.customSearchTarget?.trim()) {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Custom Search', 
        true, 
        false, 
        [], 
        0, 
        'sufficient contacts found'
      );
    } else {
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Custom Search', 
        false, 
        false, 
        [], 
        0, 
        'disabled or no target specified'
      );
    }
    
    // Deduplicate contacts based on name
    const uniqueContacts = deduplicateContacts(allContacts);
    
    // Filter contacts by confidence score
    const filteredContacts = uniqueContacts.filter(contact => 
      (contact.probability || 0) >= (mergedOptions.minimumConfidence || 30)
    );
    
    // Sort contacts by probability and limit to max contacts
    const sortedContacts = filteredContacts
      .sort((a, b) => (b.probability || 0) - (a.probability || 0))
      .slice(0, mergedOptions.maxContacts || 10);
    
    // Apply smart fallback logic if we don't have enough contacts
    const fallbackAnalysis = SmartFallbackManager.analyzeFallbackNeeds(sortedContacts, mergedOptions);
    
    if (fallbackAnalysis.shouldTriggerFallback) {
      console.log(`Smart fallback triggered: ${fallbackAnalysis.reasoning}`);
      console.log(`Executing fallbacks: ${fallbackAnalysis.recommendedFallbacks.join(', ')}`);
      
      const fallbackStartTime = Date.now();
      const fallbackContacts = await SmartFallbackManager.executeFallbackSearches(
        companyName,
        fallbackAnalysis.recommendedFallbacks,
        industry,
        {
          searchCoreLeadership,
          searchDepartmentHeads
        }
      );
      
      // Log fallback performance
      SearchPerformanceLogger.logFallback(
        sessionId,
        true,
        fallbackAnalysis.reasoning,
        fallbackAnalysis.recommendedFallbacks,
        fallbackContacts.length,
        Date.now() - fallbackStartTime
      );
      
      // Apply validation to fallback contacts
      const validatedFallbacks = fallbackContacts.filter(contact => 
        (contact.probability || 0) >= (mergedOptions.minimumConfidence || 30)
      );
      
      // Combine and optimize all contacts
      const optimizedContacts = SmartFallbackManager.optimizeContactResults(
        sortedContacts,
        validatedFallbacks,
        mergedOptions.maxContacts || 10
      );
      
      // Apply custom role affinity scoring if enabled
      if (mergedOptions.enableCustomSearch && mergedOptions.customSearchTarget?.trim()) {
        const customScoredContacts = await applyCustomRoleAffinityScoring(optimizedContacts, {
          customSearchTarget: mergedOptions.customSearchTarget,
          enableCustomScoring: true
        });
        
        const finalContacts = customScoredContacts
          .sort((a, b) => (b.probability || 0) - (a.probability || 0))
          .slice(0, mergedOptions.maxContacts || 10);
        
        // End session and return
        SearchPerformanceLogger.endSession(sessionId, finalContacts);
        console.log(`Smart fallback + custom scoring complete: ${sortedContacts.length} → ${finalContacts.length} contacts for ${companyName}`);
        return finalContacts;
      }
      
      // End session and return
      SearchPerformanceLogger.endSession(sessionId, optimizedContacts);
      console.log(`Smart fallback complete: ${sortedContacts.length} → ${optimizedContacts.length} contacts for ${companyName}`);
      return optimizedContacts;
    } else {
      // Log that no fallback was needed
      SearchPerformanceLogger.logFallback(
        sessionId,
        false,
        'Sufficient contacts found - no fallback needed',
        [],
        0,
        0
      );
    }
    
    // No fallback needed - apply custom role affinity scoring if enabled
    if (mergedOptions.enableCustomSearch && mergedOptions.customSearchTarget?.trim()) {
      const customScoredContacts = await applyCustomRoleAffinityScoring(sortedContacts, {
        customSearchTarget: mergedOptions.customSearchTarget,
        enableCustomScoring: true
      });
      
      const finalContacts = customScoredContacts
        .sort((a, b) => (b.probability || 0) - (a.probability || 0))
        .slice(0, mergedOptions.maxContacts || 10);
      
      // End session and return
      SearchPerformanceLogger.endSession(sessionId, finalContacts);
      console.log(`Found ${finalContacts.length} validated contacts for ${companyName} with custom role affinity scoring`);
      return finalContacts;
    }
    
    // End session and return
    SearchPerformanceLogger.endSession(sessionId, sortedContacts);
    console.log(`Found ${sortedContacts.length} validated contacts for ${companyName}`);
    return sortedContacts;
  } catch (error) {
    console.error(`Error in findKeyDecisionMakers for ${companyName}:`, error);
    return [];
  }
}

/**
 * Search for core leadership team (C-level, founders, directors)
 */
async function searchCoreLeadership(
  companyName: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying key leadership personnel at companies. 
Your task is to identify the leadership team members at the specified company.`;

  let userPrompt = `Identify the core leadership team at ${companyName}. Focus on:
1. C-level executives (CEO, CTO, CFO, COO, etc.)
2. Founders and co-founders
3. Board members and directors
4. Division/department heads

For each person, provide their:
- Full name (first and last name)
- Current role/position

IMPORTANT: If you cannot find data, return an empty array. Do NOT make up data.`;

  // Add industry context if available
  if (industry) {
    userPrompt += `\nThis company is in the ${industry} industry. Focus on industry-specific leadership roles.`;
  }

  const responseFormat = `{ 
  "leaders": [
    {
      "name": "John Smith", 
      "role": "Chief Executive Officer"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'leadership', companyName);
  } catch (error) {
    console.error(`Error in searchCoreLeadership:`, error);
    return [];
  }
}

/**
 * Search for department heads
 */
async function searchDepartmentHeads(
  companyName: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying department leaders at companies.
Your task is to identify key people leading various departments at the specified company.`;

  let industryContext = "";
  let departmentFocus = `
- Engineering/Development/IT
- Sales/Business Development
- Marketing/Communications
- Finance/Accounting
- Operations
- Human Resources
- Product Management`;

  // Customize departments based on industry
  if (industry) {
    switch (industry.toLowerCase()) {
      case "technology":
        departmentFocus = `
- Engineering/Development
- Product Management
- Customer Success
- Data Science
- Information Security
- Technical Operations
- UX/Design`;
        break;
      case "healthcare":
        departmentFocus = `
- Medical Affairs
- Clinical Operations
- Patient Services
- Healthcare Administration
- Medical Research
- Regulatory Affairs
- Care Management`;
        break;
      case "financial":
        departmentFocus = `
- Investment Banking
- Asset Management
- Risk Management
- Wealth Management
- Trading
- Financial Analysis
- Credit Operations`;
        break;
      // Add more industry-specific departments as needed
    }
    industryContext = `This company is in the ${industry} industry. Focus on industry-specific department leaders.`;
  }

  const userPrompt = `Identify the key department leaders at ${companyName}. Focus on these departments:
${departmentFocus}

${industryContext}

For each person, provide their:
- Full name (first and last name)
- Current role/position

IMPORTANT: If you cannot find data, return an empty array. Do NOT make up data.`;

  const responseFormat = `{ 
  "departmentLeaders": [
    {
      "name": "Jane Doe", 
      "role": "Head of Marketing"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'department_head', companyName);
  } catch (error) {
    console.error(`Error in searchDepartmentHeads:`, error);
    return [];
  }
}



/**
 * Search for middle management and key technical staff
 */
async function searchMiddleManagement(
  companyName: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying influential middle managers and technical leaders at companies.
Your task is to identify key people who make important decisions but may not be in the C-suite.`;

  let userPrompt = `Identify important middle managers and key technical leaders at ${companyName}. Focus on:
1. Team leads
2. Senior managers
3. Project managers
4. Technical specialists with authority
5. Key decision-makers below C-level

For each person, provide their:
- Full name (first and last name)
- Current role/position

IMPORTANT: If you cannot find data, return an empty array. Do NOT make up data.`;

  // Add industry context if available
  if (industry) {
    const industryRoles = getIndustrySpecificRoles(industry);
    userPrompt += `\nThis company is in the ${industry} industry. Focus especially on these roles:
${industryRoles.join("\n")}`;
  }

  const responseFormat = `{ 
  "managers": [
    {
      "name": "Alice Johnson", 
      "role": "Senior Product Manager"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'middle_management', companyName);
  } catch (error) {
    console.error(`Error in searchMiddleManagement:`, error);
    return [];
  }
}

/**
 * Search for custom target roles specified by the user
 */
async function searchCustomTarget(
  companyName: string,
  targetRole: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying specific professionals at companies.
Your task is to find people with the specific role or position requested at the specified company.`;

  let userPrompt = `Find people at ${companyName} who have roles related to: ${targetRole}

Look for variations and similar positions, such as:
- Direct matches to "${targetRole}"
- Related roles and titles
- People who might handle responsibilities related to ${targetRole}

For each person, provide their:
- Full name (first and last name)
- Current role/position

IMPORTANT: If you cannot find data, return an empty array. Do NOT make up data.`;

  // Add industry context if available
  if (industry) {
    userPrompt += `\nThis company is in the ${industry} industry. Consider industry-specific variations of this role.`;
  }

  const responseFormat = `{ 
  "targetContacts": [
    {
      "name": "John Smith", 
      "role": "${targetRole} or related position"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'custom_target', companyName);
  } catch (error) {
    console.error(`Error in searchCustomTarget:`, error);
    return [];
  }
}

/**
 * Parse contacts from Perplexity API response
 */
function parseContactsFromResponse(
  response: string,
  source: string,
  companyName: string
): Partial<Contact>[] {
  try {
    const contacts: Partial<Contact>[] = [];
    
    // Extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`No valid JSON found in response from ${source}`);
      return [];
    }
    
    const json = JSON.parse(jsonMatch[0]);
    
    // Find the array of people - could be under different keys
    let people: any[] = [];
    
    if (json.leaders) {
      people = json.leaders;
    } else if (json.departmentLeaders) {
      people = json.departmentLeaders;
    } else if (json.managers) {
      people = json.managers;
    } else if (json.targetContacts) {
      people = json.targetContacts;
    } else {
      // Try to find any array in the response
      for (const key in json) {
        if (Array.isArray(json[key])) {
          people = json[key];
          break;
        }
      }
    }
    
    if (!people || people.length === 0) {
      console.log(`No contacts found in ${source} response`);
      return [];
    }
    
    console.log(`Found ${people.length} potential contacts from ${source}`);
    
    // Process each person
    for (const person of people) {
      const { name, role } = person;
      
      // Skip if name is missing or a placeholder
      if (!name || isPlaceholderName(name)) continue;
      
      // Validate name using our existing validation logic
      const validationResult = validateName(name, role || "", companyName, {
        minimumScore: 20, // Lower threshold for validation
        companyNamePenalty: 20,
        industry: detectIndustry(companyName)
      });
      
      // Adjust probability score based on source
      let probability = validationResult.score;
      
      // Boost scores for leadership positions
      if (source === 'leadership' && role && isLeadershipRole(role)) {
        probability = Math.min(95, probability + 15);
      }
      
      // Apply industry-specific score adjustments
      if (role) {
        const industry = detectIndustry(companyName);
        if (industry && isIndustrySpecificRole(role, industry)) {
          probability = Math.min(92, probability + 10);
        }
      }
      
      contacts.push({
        name,
        role: role || null,
        probability,
        nameConfidenceScore: validationResult.score,
        verificationSource: `ai_${source}`,
        lastValidated: new Date(),
        completedSearches: ['perplexity_decision_maker']
      });
    }
    
    return contacts;
  } catch (error) {
    console.error(`Error parsing contacts from ${source} response:`, error);
    return [];
  }
}

/**
 * Deduplicate contacts based on name
 */
function deduplicateContacts(contacts: Partial<Contact>[]): Partial<Contact>[] {
  const uniqueContacts: Partial<Contact>[] = [];
  const nameMap = new Map<string, Partial<Contact>>();
  
  for (const contact of contacts) {
    if (!contact.name) continue;
    
    const normalizedName = contact.name.toLowerCase();
    
    // If this name already exists with a higher probability, skip
    if (nameMap.has(normalizedName)) {
      const existing = nameMap.get(normalizedName)!;
      
      // Keep the contact with higher probability score
      if ((contact.probability || 0) > (existing.probability || 0)) {
        nameMap.set(normalizedName, contact);
      }
      
      continue;
    }
    
    nameMap.set(normalizedName, contact);
  }
  
  // Convert back to array
  return Array.from(nameMap.values());
}

/**
 * Check if a role is a leadership position
 */
function isLeadershipRole(role: string): boolean {
  const leadershipPatterns = [
    /\b(ceo|cto|cfo|coo|cmo|cio|chief)\b/i,
    /\b(president|founder|co-founder|owner)\b/i,
    /\b(chairman|chairwoman|chair)\b/i,
    /\b(director|head|lead)\b/i,
    /\b(vp|vice president)\b/i,
    /\b(partner|principal)\b/i
  ];
  
  return leadershipPatterns.some(pattern => pattern.test(role));
}

/**
 * Check if a role is industry-specific
 */
function isIndustrySpecificRole(role: string, industry: string): boolean {
  const industryTitles = INDUSTRY_PROFESSIONAL_TITLES[industry.toLowerCase()];
  
  if (!industryTitles) return false;
  
  return industryTitles.some(title => 
    role.toLowerCase().includes(title.toLowerCase())
  );
}

/**
 * Get industry-specific roles for specialized queries
 */
function getIndustrySpecificRoles(industry: string): string[] {
  const industryTitles = INDUSTRY_PROFESSIONAL_TITLES[industry.toLowerCase()];
  
  if (!industryTitles || industryTitles.length === 0) {
    return [
      "Team Lead",
      "Senior Manager",
      "Project Manager",
      "Director"
    ];
  }
  
  return industryTitles.map(title => `- ${title.charAt(0).toUpperCase() + title.slice(1)}`);
}

/**
 * Detect company industry from name and keywords
 */
function detectIndustry(companyName: string): string | undefined {
  const nameLower = companyName.toLowerCase();
  
  // Technology industry
  if (nameLower.includes('tech') || nameLower.includes('software') || 
      nameLower.includes('digital') || nameLower.includes('data') ||
      nameLower.includes('cyber') || nameLower.includes('computer') ||
      nameLower.includes('ai') || nameLower.includes('app')) {
    return 'technology';
  }
  
  // Healthcare industry
  if (nameLower.includes('health') || nameLower.includes('medical') || 
      nameLower.includes('pharma') || nameLower.includes('care') ||
      nameLower.includes('hospital') || nameLower.includes('clinic') ||
      nameLower.includes('therapeutics')) {
    return 'healthcare';
  }
  
  // Financial industry
  if (nameLower.includes('financ') || nameLower.includes('bank') || 
      nameLower.includes('invest') || nameLower.includes('capital') ||
      nameLower.includes('wealth') || nameLower.includes('asset') ||
      nameLower.includes('fund')) {
    return 'financial';
  }
  
  // Legal industry
  if (nameLower.includes('law') || nameLower.includes('legal') || 
      nameLower.includes('attorney') || nameLower.includes('advocate') ||
      nameLower.includes('counsel')) {
    return 'legal';
  }
  
  // Construction industry
  if (nameLower.includes('construct') || nameLower.includes('build') || 
      nameLower.includes('architect') || nameLower.includes('engineer') ||
      nameLower.includes('development') || nameLower.includes('property')) {
    return 'construction';
  }
  
  // Retail industry
  if (nameLower.includes('retail') || nameLower.includes('shop') || 
      nameLower.includes('store') || nameLower.includes('market') ||
      nameLower.includes('consumer')) {
    return 'retail';
  }
  
  // Education industry
  if (nameLower.includes('educat') || nameLower.includes('school') || 
      nameLower.includes('academy') || nameLower.includes('learn') ||
      nameLower.includes('university') || nameLower.includes('college')) {
    return 'education';
  }
  
  // Manufacturing industry
  if (nameLower.includes('manufact') || nameLower.includes('factory') || 
      nameLower.includes('product') || nameLower.includes('industrial') ||
      nameLower.includes('good')) {
    return 'manufacturing';
  }
  
  // Consulting industry
  if (nameLower.includes('consult') || nameLower.includes('advisor') || 
      nameLower.includes('partner') || nameLower.includes('service') ||
      nameLower.includes('solution')) {
    return 'consulting';
  }
  
  return undefined;
}