/**
 * Company Utilities
 * 
 * Utility functions for company data validation, scoring, and processing.
 */

// Common franchise terms
const FRANCHISE_TERMS = [
  'franchise', 'franchising', 'mcdonald\'s', 'burger king', 'subway',
  'kfc', 'pizza hut', 'wendy\'s', 'taco bell', 'dunkin\'', 'starbucks',
  '7-eleven', 'ace hardware', 'ups store', 'servicemaster', 'jiffy lube'
];

// Leadership role terms
const LEADERSHIP_TERMS = [
  'ceo', 'cto', 'cfo', 'coo', 'chief', 'president', 'founder', 'co-founder',
  'owner', 'managing director', 'director', 'vp', 'vice president', 'head of',
  'principal', 'partner', 'executive', 'chairman', 'chairwoman', 'chairperson',
  'board member'
];

/**
 * Detect if a company is likely a franchise
 * @param companyName Company name to check
 * @returns Boolean indicating if the company appears to be a franchise
 */
export function isFranchise(companyName: string): boolean {
  if (!companyName) return false;
  
  const nameLower = companyName.toLowerCase();
  
  return FRANCHISE_TERMS.some(term => nameLower.includes(term));
}

/**
 * Detect if a company appears to be locally headquartered
 * @param companyName Company name to check
 * @returns Boolean indicating if the company appears locally headquartered
 */
export function isLocalHeadquarter(companyName: string): boolean {
  if (!companyName) return false;
  
  const nameLower = companyName.toLowerCase();
  
  // Companies with these terms in their names are often not locally headquartered
  const nonLocalTerms = [
    'international', 'global', 'worldwide', 'national', 'america',
    'group', 'holding', 'corporation', 'enterprise', 'industries'
  ];
  
  // If name contains terms suggesting non-local company, return false
  if (nonLocalTerms.some(term => nameLower.includes(term))) {
    return false;
  }
  
  // Companies with location names are often locally headquartered
  const localNamePattern = /\b(north|south|east|west|central|city|town|county|regional|local)\b/i;
  if (localNamePattern.test(nameLower)) {
    return true;
  }
  
  // Default to true (assume local unless evidence suggests otherwise)
  return true;
}

/**
 * Calculate a quality score for a company
 * @param company Company object to score
 * @returns Number between 0-100 representing quality
 */
export function calculateCompanyScore(company: any): number {
  if (!company) return 0;
  
  let score = 0;
  
  // Presence of key fields
  if (company.name) score += 20;
  if (company.website) score += 15;
  if (company.size) score += 10;
  if (company.description || company.services) score += 15;
  
  // Quality of description
  const description = company.description || '';
  if (typeof description === 'string') {
    if (description.length > 200) score += 15;
    else if (description.length > 100) score += 10;
    else if (description.length > 50) score += 5;
  }
  
  // Industry information
  if (company.industry || (company.snapshot && company.snapshot.industry)) score += 10;
  
  // Services information
  if (company.services || (company.snapshot && company.snapshot.services)) score += 10;
  
  // Limit to 100
  return Math.min(100, score);
}

/**
 * Get a multiplier based on the seniority of a role
 * @param role Role or job title
 * @returns Number representing the role's importance (higher = more senior)
 */
export function getRoleMultiplier(role?: string | null): number {
  if (!role) return 1.0;
  
  const roleLower = role.toLowerCase();
  
  // Founder/Owner roles
  if (roleLower.includes('founder') || roleLower.includes('owner') || 
      roleLower.includes('ceo') || roleLower.includes('president')) {
    return 3.0;
  }
  
  // C-level executives
  if (roleLower.includes('chief') || roleLower.includes('cto') || 
      roleLower.includes('cfo') || roleLower.includes('coo')) {
    return 2.5;
  }
  
  // VP level
  if (roleLower.includes('vp') || roleLower.includes('vice president')) {
    return 2.0;
  }
  
  // Director level
  if (roleLower.includes('director') || roleLower.includes('head of')) {
    return 1.75;
  }
  
  // Manager level
  if (roleLower.includes('manager') || roleLower.includes('lead')) {
    return 1.5;
  }
  
  // Default
  return 1.0;
}

/**
 * Determine if a role is a leadership position
 * @param role Role or job title
 * @returns Boolean indicating if this is a leadership role
 */
export function isLeadershipRole(role?: string | null): boolean {
  if (!role) return false;
  
  const roleLower = role.toLowerCase();
  
  return LEADERSHIP_TERMS.some(term => roleLower.includes(term));
}