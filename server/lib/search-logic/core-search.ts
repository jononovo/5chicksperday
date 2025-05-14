/**
 * Core Search Functionality
 * 
 * This module provides the foundational search capabilities used by all modules.
 * It centralizes API interactions and data processing for search operations.
 */

import axios from 'axios';
import { validateNames } from '../api-interactions';

/**
 * Search for companies matching a query
 * @param query Search query string
 * @returns Array of company names
 */
export async function searchCompanies(query: string): Promise<string[]> {
  try {
    // Use appropriate API for company search
    // This is a simplified example - replace with actual implementation
    const response = await axios.post('/api/search/companies', { query });
    
    return response.data.companies || [];
  } catch (error) {
    console.error('Error searching companies:', error);
    return [];
  }
}

/**
 * Analyze a company to get detailed information
 * @param companyName Name of the company to analyze
 * @param promptTemplate Template for the analysis prompt
 * @param systemPrompt Optional system prompt for LLM
 * @param responseStructure Optional structure for the response
 * @returns Detailed company information
 */
export async function analyzeCompany(
  companyName: string,
  promptTemplate: string = 'Provide detailed information about [COMPANY]',
  systemPrompt: string = '',
  responseStructure: string = ''
): Promise<string> {
  try {
    // Replace placeholders in the prompt
    const prompt = promptTemplate.replace('[COMPANY]', companyName);
    
    // Call Perplexity AI or similar service
    const response = await axios.post('/api/ai/analyze', {
      prompt,
      systemPrompt,
      responseStructure
    });
    
    return response.data.result || '';
  } catch (error) {
    console.error('Error analyzing company:', error);
    return '';
  }
}

/**
 * Extract contacts from analysis text or structured data
 * @param analysisText Analysis result from AI
 * @param companyName Company name for context
 * @returns Array of contact objects
 */
export async function extractContacts(analysisText: string, companyName: string): Promise<Array<Partial<any>>> {
  try {
    // Try to parse the result as JSON
    let contactsData;
    try {
      const parsed = JSON.parse(analysisText);
      
      // Handle different structures that might contain contacts
      if (parsed.contacts) {
        contactsData = parsed.contacts;
      } else if (parsed.data?.contacts) {
        contactsData = parsed.data.contacts;
      } else if (parsed.sources) {
        // Flatten contacts from different sources
        contactsData = parsed.sources.flatMap((source: any) => 
          source.contacts || []
        );
      } else {
        // Structure doesn't contain contacts in expected format
        contactsData = [];
      }
    } catch (error) {
      // If parsing fails, try to extract contacts using AI
      const response = await axios.post('/api/ai/extract-contacts', {
        text: analysisText,
        companyName
      });
      
      contactsData = response.data.contacts || [];
    }
    
    // Normalize the contact data structure
    return contactsData.map((contact: any) => ({
      name: contact.name || contact.fullName || 'Unknown',
      role: contact.role || contact.jobTitle || contact.position || null,
      email: contact.email || null,
      linkedinUrl: contact.linkedin || contact.linkedinUrl || null,
      phoneNumber: contact.phone || contact.phoneNumber || null,
      probability: contact.confidence || contact.probability || 0.5,
      notes: contact.notes || contact.description || null
    }));
  } catch (error) {
    console.error('Error extracting contacts:', error);
    return [];
  }
}

/**
 * Search for specific contact details
 * @param companyName Company name
 * @param contactName Contact name
 * @param role Optional role or position
 * @returns Contact details
 */
export async function searchContactDetails(
  companyName: string,
  contactName: string,
  role?: string
): Promise<Partial<any> | null> {
  try {
    // Call appropriate API for contact details
    const response = await axios.post('/api/search/contact-details', {
      companyName,
      contactName,
      role
    });
    
    return response.data.contact || null;
  } catch (error) {
    console.error('Error searching contact details:', error);
    return null;
  }
}