import axios from 'axios';
import { log } from '../vite';
import { check_secrets } from './secrets';

/**
 * Uses Perplexity API to search for companies based on a query
 * @param query The search query
 * @returns Array of company names
 */
export async function searchCompanies(query: string): Promise<string[]> {
  try {
    // Check if we have a Perplexity API key
    const hasKey = await check_secrets(['PERPLEXITY_API_KEY']);
    if (!hasKey) {
      log('No PERPLEXITY_API_KEY found, falling back to default search', 'search');
      return defaultSearchCompanies(query);
    }

    // Construct the prompt for company search
    const prompt = `I'm looking for companies in the following market: "${query}".
    Please provide a list of 5-10 relevant companies that match this criteria.
    Only return the company names as a JSON array of strings. Don't include any explanations or additional text.`;

    // Make request to Perplexity API
    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that provides lists of company names based on search criteria. Only respond with valid JSON arrays of strings containing company names - no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500,
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      }
    );

    // Parse the response
    const content = response.data.choices[0].message.content;
    
    // Extract JSON array from response
    let companyNames: string[] = [];
    try {
      // First, try to parse the content directly
      companyNames = JSON.parse(content);
    } catch (error) {
      // If direct parsing fails, look for array pattern in the response
      const match = content.match(/\[.*\]/s);
      if (match) {
        try {
          companyNames = JSON.parse(match[0]);
        } catch (innerError) {
          log(`Failed to parse JSON array from match: ${innerError}`, 'search');
        }
      } else {
        // Last attempt: split by newlines and filter for company names
        companyNames = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('[') && !line.startsWith(']') && !line.startsWith('{') && !line.startsWith('}'))
          .map(line => {
            // Clean up quotation marks, numbers, and other artifacts
            return line.replace(/^["'`]/, '').replace(/["'`],?$/, '').replace(/^\d+\.\s*/, '');
          });
      }
    }

    return companyNames.filter(name => name.trim() !== '');
  } catch (error) {
    log(`Error searching companies with Perplexity: ${(error as Error).message}`, 'search');
    // Fall back to default search method
    return defaultSearchCompanies(query);
  }
}

/**
 * Fallback search method for when API is not available
 * @param query The search query
 * @returns Array of company names
 */
function defaultSearchCompanies(query: string): string[] {
  log(`Using default search for query: ${query}`, 'search');
  
  // Extract keywords from query to create more targeted results
  const keywords = query.toLowerCase().split(/\s+/);
  
  // Common industries extracted from query
  const industries = [
    'tech', 'technology', 'software', 'hardware', 'finance', 'financial', 'banking',
    'healthcare', 'health', 'medical', 'retail', 'restaurant', 'food', 'manufacturing',
    'construction', 'education', 'consulting', 'marketing', 'advertising', 'media',
    'transportation', 'logistics', 'energy', 'legal', 'real estate', 'property',
    'hospitality', 'tourism', 'entertainment', 'agriculture', 'farming'
  ];
  
  // Common locations that might be in the query
  const locations = [
    'new york', 'san francisco', 'bay area', 'silicon valley', 'los angeles', 'chicago',
    'boston', 'seattle', 'austin', 'denver', 'atlanta', 'dallas', 'houston', 'miami',
    'washington', 'philadelphia', 'toronto', 'london', 'berlin', 'paris', 'tokyo',
    'singapore', 'sydney', 'melbourne', 'bangalore', 'mumbai', 'dublin', 'amsterdam'
  ];
  
  // Detect industry and location from query
  const detectedIndustry = industries.find(industry => keywords.some(keyword => keyword.includes(industry.toLowerCase())));
  const detectedLocation = locations.find(location => query.toLowerCase().includes(location.toLowerCase()));
  
  // Predefined company templates that can be customized based on query
  const companyTemplates = [
    '{Industry} Solutions',
    '{Industry} Innovations',
    '{Location} {Industry} Group',
    'Next Gen {Industry}',
    '{Industry} Experts',
    '{Location} {Industry} Associates',
    'Premier {Industry} Services',
    '{Industry} Connect',
    'Advanced {Industry} Systems',
    '{Industry} Partners',
    'Global {Industry} Ventures',
    '{Location} {Industry} Specialists',
    '{Industry} Direct',
    '{Industry} First',
    '{Industry} Plus'
  ];
  
  // Generate company names based on templates and detected attributes
  const companies = companyTemplates.map(template => {
    const industry = detectedIndustry || getRandomElement(['Tech', 'Finance', 'Healthcare', 'Retail', 'Services']);
    const location = detectedLocation || '';
    
    return template
      .replace('{Industry}', capitalizeFirstLetter(industry))
      .replace('{Location}', capitalizeFirstLetter(location))
      .trim()
      .replace(/\s+/g, ' '); // Clean up spacing
  });
  
  // Filter out duplicates and return
  return [...new Set(companies)].slice(0, 10);
}

/**
 * Helper to capitalize the first letter of a string
 */
function capitalizeFirstLetter(string: string): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Helper to get a random element from an array
 */
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}