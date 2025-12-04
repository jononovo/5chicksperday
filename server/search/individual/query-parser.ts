import type { ParsedIndividualQuery } from './types';

const LOCATION_PATTERNS = [
  /\bin\s+([A-Za-z\s,]+(?:UK|USA|US|CA|AU|DE|FR|IT|ES|NL|BE|CH|AT|SE|NO|DK|FI|IE|NZ|JP|CN|IN|BR|MX|SG|HK))/i,
  /\bin\s+([A-Za-z\s]+,\s*[A-Za-z\s]+)/i,
  /\bfrom\s+([A-Za-z\s,]+)/i,
  /\bbased\s+in\s+([A-Za-z\s,]+)/i,
  /\blocated\s+in\s+([A-Za-z\s,]+)/i,
];

const ROLE_PATTERNS = [
  /\b(CEO|CFO|CTO|COO|CMO|CIO|CISO|CPO|CDO|VP|Director|Manager|Head|Lead|Principal|Senior|Chief|Founder|Owner|Partner|President|Executive|Analyst|Engineer|Developer|Architect|Consultant|Specialist|Coordinator)\b/gi,
  /\b(Financial\s+Analyst|Software\s+Engineer|Product\s+Manager|Data\s+Scientist|Marketing\s+Director|Sales\s+Manager|HR\s+Director|Operations\s+Manager|Business\s+Development)\b/gi,
];

const PREPOSITIONS_TO_REMOVE = [
  'in', 'from', 'based in', 'located in', 'at', 'working at', 'currently at', 'formerly at'
];

export function parseIndividualQuery(query: string): ParsedIndividualQuery {
  let workingQuery = query.trim();
  let locationHint: string | undefined;
  let roleHint: string | undefined;
  
  for (const pattern of LOCATION_PATTERNS) {
    const match = workingQuery.match(pattern);
    if (match && match[1]) {
      locationHint = match[1].trim();
      workingQuery = workingQuery.replace(match[0], ' ').trim();
      break;
    }
  }
  
  const roleMatches: string[] = [];
  for (const pattern of ROLE_PATTERNS) {
    const matches = workingQuery.match(pattern);
    if (matches) {
      roleMatches.push(...matches);
      for (const m of matches) {
        workingQuery = workingQuery.replace(m, ' ');
      }
    }
  }
  if (roleMatches.length > 0) {
    roleHint = roleMatches.join(' ').trim();
  }
  
  for (const prep of PREPOSITIONS_TO_REMOVE) {
    const regex = new RegExp(`\\b${prep}\\b`, 'gi');
    workingQuery = workingQuery.replace(regex, ' ');
  }
  
  workingQuery = workingQuery.replace(/[.,;:!?]+/g, ' ');
  workingQuery = workingQuery.replace(/\s+/g, ' ').trim();
  
  const personName = workingQuery || extractNameFallback(query);
  
  return {
    personName,
    locationHint,
    roleHint,
    originalQuery: query.trim()
  };
}

function extractNameFallback(query: string): string {
  const words = query.trim().split(/\s+/);
  
  const nameWords: string[] = [];
  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z'-]/g, '');
    if (cleaned.length >= 2 && /^[A-Z]/.test(cleaned)) {
      nameWords.push(cleaned);
      if (nameWords.length >= 3) break;
    }
  }
  
  return nameWords.join(' ') || words.slice(0, 2).join(' ');
}

export function formatSearchContext(parsed: ParsedIndividualQuery): string {
  const parts: string[] = [`Person: ${parsed.personName}`];
  
  if (parsed.locationHint) {
    parts.push(`Historical location hint: ${parsed.locationHint} (they may have moved)`);
  }
  
  if (parsed.roleHint) {
    parts.push(`Historical role hint: ${parsed.roleHint} (they may have changed roles)`);
  }
  
  return parts.join('\n');
}
