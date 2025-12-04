import { queryPerplexity } from '../perplexity/perplexity-client';
import type { PerplexityMessage } from '../perplexity/perplexity-types';
import type { ParsedIndividualQuery, IndividualDiscoveryResult } from './types';
import { formatSearchContext } from './query-parser';

const INDIVIDUAL_DISCOVERY_SYSTEM_PROMPT = `You are a professional researcher helping to find information about a specific person.

Your task is to find the person's CURRENT professional information:
- Their full name
- Their CURRENT company (not past employers)
- Their CURRENT job title/role
- The company's website
- Their LinkedIn profile URL (if available)

IMPORTANT GUIDELINES:
1. The user may provide historical hints about location or past roles - use these only to help IDENTIFY the right person, not as requirements for their current position
2. People change jobs and locations frequently - focus on finding their CURRENT employer
3. If the person has a common name, use any provided context (location, past role) to identify the correct individual
4. If you cannot find the person with high confidence, indicate low confidence

Return your findings in this exact JSON format:
{
  "personName": "Full Name",
  "currentCompany": "Company Name",
  "currentRole": "Job Title",
  "companyWebsite": "https://example.com",
  "linkedinUrl": "https://linkedin.com/in/username",
  "confidence": 85,
  "notes": "Optional notes about the search"
}

Return ONLY valid JSON, no additional text.`;

export async function discoverIndividual(
  parsed: ParsedIndividualQuery
): Promise<IndividualDiscoveryResult | null> {
  const searchContext = formatSearchContext(parsed);
  
  const userPrompt = `Find the current professional information for:

${searchContext}

Search for this person and return their CURRENT company and role. The location and role hints are from the past - the person may have changed jobs or moved. Use these hints only to identify the correct person.`;

  const messages: PerplexityMessage[] = [
    { role: 'system', content: INDIVIDUAL_DISCOVERY_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    console.log(`[IndividualSearch] Discovering individual: ${parsed.personName}`);
    
    const responseContent = await queryPerplexity(messages);

    if (!responseContent) {
      console.error('[IndividualSearch] Empty response from Perplexity');
      return null;
    }

    const content = responseContent.trim();
    
    let jsonStr = content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const result = JSON.parse(jsonStr) as IndividualDiscoveryResult;
    
    if (!result.personName || !result.currentCompany) {
      console.error('[IndividualSearch] Missing required fields in response');
      return null;
    }

    console.log(`[IndividualSearch] Found: ${result.personName} at ${result.currentCompany} (confidence: ${result.confidence}%)`);
    
    return result;

  } catch (error) {
    console.error('[IndividualSearch] Error discovering individual:', error);
    return null;
  }
}

export async function enrichIndividualWithEmail(
  contactId: number,
  companyId: number,
  userId: number
): Promise<void> {
  try {
    const { parallelTieredEmailSearch } = await import('../services/parallel-email-search');
    const { storage } = await import('../../storage');
    
    const contact = await storage.getContact(contactId, userId);
    const company = await storage.getCompany(companyId, userId);
    
    if (!contact || !company) {
      console.error('[IndividualSearch] Contact or company not found for email enrichment');
      return;
    }

    console.log(`[IndividualSearch] Starting email enrichment for ${contact.name} at ${company.name}`);

    const contactsForSearch = [{
      id: contact.id,
      name: contact.name,
      role: contact.role,
      probability: contact.probability,
      companyId: company.id,
      completedSearches: contact.completedSearches
    }];

    const emailResults = await parallelTieredEmailSearch(
      contactsForSearch,
      company,
      userId
    );

    console.log(`[IndividualSearch] Email enrichment complete. Found ${emailResults.length} results`);

  } catch (error) {
    console.error('[IndividualSearch] Error enriching with email:', error);
  }
}
