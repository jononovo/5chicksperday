import { Contact } from "@shared/schema";
import { analyzeWithPerplexity } from "../perplexity/perplexity-utils";
import { extractDomainFromContext } from "../analysis/email-analysis";
import { applyCustomRoleAffinityScoring } from "../analysis/custom-role-affinity-scorer";
import { SmartFallbackManager } from "./fallback-manager";
import { SearchPerformanceLogger } from "./performance-logger";

// ============================================================================
// EXTRACTED ACTIVE FUNCTIONS FROM ANALYSIS FOLDER
// These functions were moved here from the analysis folder during cleanup
// to consolidate actively used code with the contact finder functionality.
// ============================================================================

/**
 * Standard placeholder names that should always be filtered out
 */
const PLACEHOLDER_NAMES = new Set([
  'john doe', 'jane doe', 'john smith', 'jane smith',
  'test user', 'demo user', 'example user',
  'admin user', 'guest user', 'unknown user'
]);

/**
 * Checks if a name is a known placeholder or test name
 * @param name The name to check
 * @returns true if the name is a placeholder name
 */
function isPlaceholderName(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return PLACEHOLDER_NAMES.has(normalizedName) || 
         normalizedName.includes('test') || 
         normalizedName.includes('demo') ||
         normalizedName.includes('example') ||
         normalizedName.includes('admin') ||
         normalizedName.includes('guest') ||
         normalizedName.includes('user');
}

/**
 * Dictionary of industry-specific professional titles by sector
 * These are legitimate role titles that should boost confidence scores
 */
const INDUSTRY_PROFESSIONAL_TITLES: Record<string, string[]> = {
  "technology": [
    "software engineer", "systems architect", "cto", "developer", "devops engineer", 
    "product manager", "scrum master", "data scientist", "full stack", "frontend", 
    "backend", "qa engineer", "information security", "cloud architect", "engineer"
  ],
  "healthcare": [
    "physician", "surgeon", "medical director", "nurse practitioner", "chief medical", 
    "healthcare administrator", "medical officer", "clinical director", "doctor", 
    "specialist", "head of radiology", "chief of staff", "pharmacist"
  ],
  "financial": [
    "investment banker", "financial advisor", "financial analyst", "portfolio manager", 
    "wealth manager", "fund manager", "chief financial", "controller", "treasurer", 
    "actuary", "underwriter", "financial planner", "credit analyst"
  ],
  "legal": [
    "attorney", "lawyer", "legal counsel", "partner", "associate", "legal director", 
    "general counsel", "law partner", "chief legal", "litigator", "solicitor", 
    "barrister", "compliance officer", "judge"
  ],
  "construction": [
    "project manager", "general contractor", "construction manager", "site supervisor", 
    "architect", "civil engineer", "structural engineer", "estimator", "surveyor", 
    "superintendent", "foreman", "master plumber", "master electrician"
  ],
  "retail": [
    "store manager", "retail director", "merchandising manager", "buyer", "category manager", 
    "regional manager", "visual merchandiser", "sales associate", "operations manager", 
    "ecommerce director", "supply chain manager"
  ],
  "education": [
    "principal", "headmaster", "dean", "professor", "department chair", "superintendent", 
    "academic director", "provost", "faculty head", "curriculum director", "school administrator", 
    "teacher", "instructor"
  ],
  "manufacturing": [
    "plant manager", "production manager", "quality control", "industrial engineer", 
    "operations director", "manufacturing engineer", "supply chain", "procurement manager", 
    "facilities manager", "lean manufacturing", "master craftsman"
  ],
  "consulting": [
    "managing partner", "engagement manager", "consulting director", "principal consultant", 
    "management consultant", "senior advisor", "strategy consultant", "transformation lead", 
    "senior partner", "practice leader", "business consultant"
  ]
};

/**
 * Validation result interface for name validation
 */
interface NameValidationResult {
  score: number;
  isGeneric: boolean;
  confidence: number;
  name: string;
  context?: string;
  aiScore?: number;
  validationSteps: ValidationStepResult[];
}

interface ValidationStepResult {
  name: string;
  score: number;
  weight: number;
  reason?: string;
}

interface ValidationOptions {
  useLocalValidation?: boolean;
  localValidationWeight?: number;
  minimumScore?: number;
  companyNamePenalty?: number;
  searchPrompt?: string;
  searchTermPenalty?: number;
  aiScore?: number;
  industry?: string;
  requireRole?: boolean;
  roleMinimumScore?: number;
}

// Centralized scoring weights
const VALIDATION_WEIGHTS = {
  formatAndStructure: 0.25,
  genericTerms: 0.20,
  aiValidation: 0.30,
  contextAnalysis: 0.15,
  domainKnowledge: 0.10
};

const MAX_SCORE = 95;

/**
 * Validates a contact name using multiple validation steps
 * @param name The name to validate
 * @param context Optional context string around the name
 * @param companyName Optional company name for additional validation
 * @param options Validation options
 * @returns Validation result with score and confidence
 */
function validateName(
  name: string,
  context: string = "",
  companyName?: string | null,
  options: ValidationOptions = {}
): NameValidationResult {
  const validationSteps: ValidationStepResult[] = [];
  let totalScore = 0;

  // Step 1: Format and Structure Validation (25% weight)
  const formatScore = validateNameFormat(name);
  validationSteps.push({
    name: "Format Validation",
    score: formatScore,
    weight: VALIDATION_WEIGHTS.formatAndStructure
  });

  // Step 2: Generic Terms Check (20% weight)
  const genericScore = validateGenericTerms(name);
  validationSteps.push({
    name: "Generic Terms Check",
    score: genericScore,
    weight: VALIDATION_WEIGHTS.genericTerms
  });

  // Step 3: AI Validation Score (30% weight)
  const aiScore = options.aiScore || 50;
  validationSteps.push({
    name: "AI Validation",
    score: aiScore,
    weight: VALIDATION_WEIGHTS.aiValidation
  });

  // Step 4: Context Analysis (15% weight)
  const contextScore = validateContext(name, context, companyName);
  validationSteps.push({
    name: "Context Analysis",
    score: contextScore,
    weight: VALIDATION_WEIGHTS.contextAnalysis
  });

  // Step 5: Domain Knowledge Rules (10% weight)
  const domainScore = validateDomainRules(name, context, options);
  validationSteps.push({
    name: "Domain Rules",
    score: domainScore,
    weight: VALIDATION_WEIGHTS.domainKnowledge,
    reason: options?.industry ? `Industry context: ${options.industry}` : undefined
  });

  // Calculate weighted total
  totalScore = validationSteps.reduce((acc, step) => {
    return acc + (step.score * step.weight);
  }, 0);

  // Apply penalties for generic terms more aggressively
  const genericTermCount = countGenericTerms(name);
  if (genericTermCount > 0) {
    const genericPenalty = genericTermCount * 25;
    totalScore = Math.max(20, totalScore - genericPenalty);
    validationSteps.push({
      name: "Generic Term Penalty",
      score: -genericPenalty,
      weight: 1,
      reason: `Contains ${genericTermCount} generic terms`
    });
  }

  // Apply search term penalties
  if (options.searchPrompt) {
    const searchTermPenalty = calculateSearchTermPenalty(name, options.searchPrompt);
    totalScore = Math.max(20, totalScore - searchTermPenalty);
    validationSteps.push({
      name: "Search Term Penalty",
      score: -searchTermPenalty,
      weight: 1,
      reason: "Contains search terms"
    });
  }

  // Apply company name penalties
  if (companyName && isNameSimilarToCompany(name, companyName)) {
    if (!isFounderOrOwner(context, companyName)) {
      const penalty = options.companyNamePenalty || 20;
      totalScore = Math.max(20, totalScore - penalty);
      validationSteps.push({
        name: "Company Name Penalty",
        score: -penalty,
        weight: 1,
        reason: "Similar to company name"
      });
    }
  }

  // Ensure score stays within bounds
  totalScore = Math.max(options.minimumScore || 20, Math.min(MAX_SCORE, totalScore));

  return {
    score: Math.round(totalScore),
    isGeneric: genericScore < 40,
    confidence: calculateConfidence(validationSteps),
    name,
    context,
    aiScore: options.aiScore,
    validationSteps
  };
}

// Helper functions for validateName
function validateNameFormat(name: string): number {
  let score = 50;
  
  const namePattern = /^[A-Z][a-z]+(?:(?:\s+[A-Z](?:\.|\s+))?(?:\s+[A-Z][a-z]+){1,2})$/;
  const nameParts = name.split(/\s+/).filter(part => part.length > 0);
  
  if (namePattern.test(name)) {
    score += 35;
  } else {
    score -= 30;
  }
  
  if (name === name.toUpperCase() && name.length > 2) {
    score -= 40;
  }
  
  const validPartCount = nameParts.length >= 2 && nameParts.length <= 4;
  if (!validPartCount) {
    score -= 25;
  }
  
  if (nameParts.length === 2) {
    score += 20;
  } else if (nameParts.length === 3) {
    score += 15;
  } else if (nameParts.length > 4) {
    score -= 15 * (nameParts.length - 4);
  }
  
  const hasReasonableLengths = nameParts.every(part =>
    part.length >= 2 && part.length <= 20
  );
  
  if (hasReasonableLengths) {
    score += 15;
  } else {
    score -= 25;
  }
  
  const hasInvalidChars = /[0-9@#$%^&*()+=\[\]{}|\\/<>~`_]/.test(name);
  if (hasInvalidChars) {
    score -= 40;
  }
  
  const prefixes = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
  if (prefixes.includes(nameParts[0])) {
    score += 5;
  }
  
  return Math.min(95, Math.max(10, score));
}

function validateGenericTerms(name: string): number {
  let score = 80;

  const genericCount = countGenericTerms(name);

  if (genericCount > 0) {
    score -= genericCount * 25;
  }

  if (/\b(department|team|group|division|office|support|sales|service|info)\b/i.test(name)) {
    score -= 50;
  }
  
  if (/\b(contact|inquiry|question|help|service|request|consult|about)\b/i.test(name)) {
    score -= 45;
  }
  
  if (/\b(manager|director|president|chief|officer|ceo|cfo|cto|owner|founder)\b/i.test(name)) {
    if (!name.includes(',') && !name.includes('(') && !name.includes('-')) {
      score -= 40;
    }
  }
  
  if (name.includes('@') || /\b(email|mail)\b/i.test(name)) {
    score -= 75;
  }

  return Math.min(95, Math.max(0, score));
}

function validateContext(name: string, context: string, companyName?: string | null): number {
  let score = 60;

  if (/\b(ceo|cto|cfo|founder|president|director)\b/i.test(context)) {
    if (isFounderOrOwner(context, companyName || '')) {
      score += 20;
    }
  }

  if (/\b(manages|leads|heads|directs)\b/i.test(context)) {
    score += 10;
  }

  if (/\b(intern|temporary|contractor)\b/i.test(context)) {
    score -= 10;
  }

  return Math.min(95, Math.max(20, score));
}

function validateDomainRules(name: string, context: string, options?: ValidationOptions): number {
  let score = 70;

  if (/Dr\.|Prof\.|PhD/i.test(name)) {
    score += 10;
  }

  if (/^[A-Z]\.\s[A-Z][a-z]+$/.test(name)) {
    score -= 15;
  }

  if (options?.industry) {
    // Simple industry-specific adjustment
    const industryTitles = INDUSTRY_PROFESSIONAL_TITLES[options.industry.toLowerCase()];
    if (industryTitles) {
      const hasIndustryTitle = industryTitles.some(title => 
        context.toLowerCase().includes(title.toLowerCase())
      );
      if (hasIndustryTitle) {
        score += 10;
      }
    }
  }

  return Math.min(95, Math.max(20, score));
}

function calculateConfidence(steps: ValidationStepResult[]): number {
  const totalWeight = steps.reduce((acc, step) => acc + step.weight, 0);
  const weightedConfidence = steps.reduce((acc, step) => {
    const stepConfidence = step.score > 80 ? 90 : step.score > 60 ? 70 : 50;
    return acc + (stepConfidence * step.weight);
  }, 0);

  return Math.round(weightedConfidence / totalWeight);
}

function countGenericTerms(name: string): number {
  const genericTerms = new Set([
    'chief', 'executive', 'officer', 'ceo', 'cto', 'cfo', 'coo', 'president',
    'director', 'manager', 'head', 'lead', 'senior', 'junior', 'principal',
    'sales', 'marketing', 'finance', 'accounting', 'hr', 'operations', 'it',
    'support', 'customer', 'service', 'product', 'project', 'team', 'department',
    'admin', 'professional', 'consultant', 'company', 'business', 'office'
  ]);
  
  const nameLower = name.toLowerCase();
  const words = nameLower.split(/[\s-]+/);
  
  return words.filter(word => genericTerms.has(word)).length;
}

function calculateSearchTermPenalty(name: string, searchPrompt: string): number {
  const searchTerms = searchPrompt.toLowerCase().split(/\s+/);
  const normalizedName = name.toLowerCase();

  const matchingTerms = searchTerms.filter(term =>
    term.length >= 4 && normalizedName.includes(term)
  );

  return matchingTerms.length * 25;
}

function isNameSimilarToCompany(name: string, companyName: string): boolean {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedCompany = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const cleanCompany = normalizedCompany
    .replace(/(inc|llc|ltd|corp|co|company|group|holdings)$/, '')
    .trim();

  if (normalizedName === cleanCompany) return true;

  const nameWords = normalizedName.split(/\s+/);
  const companyWords = cleanCompany.split(/\s+/);

  const matchingWords = nameWords.filter(word =>
    companyWords.includes(word) && word.length > 3
  );

  if (matchingWords.length >= 2) return true;

  if (normalizedName.length > 4) {
    if (cleanCompany.includes(normalizedName)) {
      return true;
    }
    if (normalizedName.includes(cleanCompany)) {
      return true;
    }
  }

  return false;
}

function isFounderOrOwner(context?: string, companyName?: string): boolean {
  if (!context) return false;

  const normalizedContext = context.toLowerCase();
  const normalizedCompany = companyName ? companyName.toLowerCase() : '';

  const founderPatterns = [
    /\b(?:founder|co-founder|founding)\b/i,
    /\b(?:owner|proprietor)\b/i,
    /\bceo\b/i,
    /\b(?:president|chief\s+executive)\b/i,
    /\b(?:managing\s+director|managing\s+partner)\b/i
  ];

  if (companyName) {
    const contextWindow = 100;
    const companyIndex = normalizedContext.indexOf(normalizedCompany);
    if (companyIndex >= 0) {
      const start = Math.max(0, companyIndex - contextWindow);
      const end = Math.min(normalizedContext.length, companyIndex + normalizedCompany.length + contextWindow);
      const nearbyContext = normalizedContext.slice(start, end);

      for (const pattern of founderPatterns) {
        if (pattern.test(nearbyContext)) {
          return true;
        }
      }
    }
  }

  return founderPatterns.some(pattern => pattern.test(normalizedContext));
}

// ============================================================================
// END OF EXTRACTED FUNCTIONS
// ============================================================================

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
      
      // Check if we should continue searching
      const willContinue = SmartFallbackManager.shouldContinueSearching(allContacts, 'department heads');
      
      if (!willContinue) {
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
    
    // 4. Custom search - determine which custom search is active
    const customStartTime = Date.now();
    const activeCustomTarget = mergedOptions.enableCustomSearch2 
      ? mergedOptions.customSearchTarget2 
      : mergedOptions.customSearchTarget;
    
    const isCustomSearchActive = (mergedOptions.enableCustomSearch || mergedOptions.enableCustomSearch2) && activeCustomTarget?.trim();
    
    if (isCustomSearchActive && activeCustomTarget &&
        SmartFallbackManager.shouldContinueSearching(allContacts, 'custom search')) {
      console.log(`Running custom search for "${activeCustomTarget}" at ${companyName}`);
      const customContacts = await searchCustomTarget(companyName, activeCustomTarget!, industry);
      allContacts.push(...customContacts);
      
      SearchPerformanceLogger.logSearchPhase(
        sessionId, 
        'Custom Search', 
        true, 
        true, 
        customContacts, 
        Date.now() - customStartTime
      );
      
      // No rate limiting delay needed - this is the final phase
    } else if (isCustomSearchActive) {
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
      if (isCustomSearchActive && activeCustomTarget) {
        const customScoredContacts = await applyCustomRoleAffinityScoring(optimizedContacts, {
          customSearchTarget: activeCustomTarget,
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
 * Search for marketing leaders
 */
async function searchDepartmentHeads(
  companyName: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying marketing leadership and key marketing personnel at companies.
Your task is to identify marketing leaders and decision-makers at the specified company.`;

  let industryContext = "";
  let departmentFocus = `
- Chief Marketing Officer (CMO)
- VP of Marketing
- Marketing Directors
- Head of Growth/Growth Marketing
- Head of Digital Marketing
- Brand Marketing Leaders
- Product Marketing Leaders`;

  // Industry-specific marketing roles
  if (industry) {
    switch (industry.toLowerCase()) {
      case "technology":
        departmentFocus = `
- CMO / Chief Marketing Officer
- VP of Marketing
- VP of Growth
- Head of Product Marketing
- Head of Demand Generation
- Director of Marketing Operations
- Head of Brand Marketing`;
        break;
      case "healthcare":
        departmentFocus = `
- CMO / Chief Marketing Officer
- VP of Marketing
- Director of Healthcare Marketing
- Head of Patient Engagement
- Medical Marketing Director
- Digital Health Marketing Leader`;
        break;
      case "financial":
        departmentFocus = `
- CMO / Chief Marketing Officer
- VP of Marketing
- Head of Financial Services Marketing
- Director of Digital Marketing
- Brand Marketing Director
- Customer Acquisition Leader`;
        break;
      // Default marketing roles for other industries
      default:
        // Keep default marketing focus
        break;
    }
    industryContext = `This company is in the ${industry} industry. Focus on marketing leaders specific to this industry.`;
  }

  const userPrompt = `Identify the key marketing leaders and decision-makers at ${companyName}. Focus specifically on marketing roles:
${departmentFocus}

${industryContext}

For each person, provide their:
- Full name (first and last name)
- Current role/position

IMPORTANT: If you cannot find data, return an empty array. Do NOT make up data.`;

  const responseFormat = `{ 
  "marketingLeaders": [
    {
      "name": "Jane Doe", 
      "role": "Chief Marketing Officer"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'marketing', companyName);
  } catch (error) {
    console.error(`Error in searchDepartmentHeads:`, error);
    return [];
  }
}



/**
 * Search for CTO and technical leadership
 */
async function searchMiddleManagement(
  companyName: string,
  industry?: string
): Promise<Partial<Contact>[]> {
  const systemPrompt = `You are an expert in identifying technical leadership and engineering leaders at companies.
Your task is to identify the CTO and other key technical decision-makers at the specified company.`;

  let userPrompt = `Identify the CTO and key technical leaders at ${companyName}. Focus on:
1. Chief Technology Officer (CTO)
2. VP of Engineering
3. VP of Technology
4. Head of Engineering
5. Technical Directors

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
  "technicalLeaders": [
    {
      "name": "Alice Johnson", 
      "role": "Chief Technology Officer"
    }
  ]
}`;

  try {
    const result = await analyzeWithPerplexity(userPrompt, systemPrompt, responseFormat);
    return parseContactsFromResponse(result, 'technical_leadership', companyName);
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