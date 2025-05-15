import type { Company, Contact } from "@shared/schema";
import { queryPerplexity } from "./api/perplexity-client";
import type { PerplexityMessage } from "./types/perplexity";
import { validateEmailPattern, isValidBusinessEmail, isPlaceholderEmail } from "./results-analysis/email-analysis";

/**
 * Core Perplexity AI interaction module
 * Handles direct interactions with the Perplexity API for company and contact analysis
 */

export async function analyzeWithPerplexity(
  prompt: string,
  systemPrompt: string,
  responseFormat?: string
): Promise<string> {
  const messages: PerplexityMessage[] = [
    {
      role: "system",
      content: systemPrompt + (responseFormat ? `\n\nFormat your response as JSON:\n${responseFormat}` : '')
    },
    {
      role: "user",
      content: prompt
    }
  ];

  return queryPerplexity(messages);
}

export interface EmailValidationResult {
  score: number;
  validationDetails?: {
    aiConfidence?: number;
    patternScore: number;
    businessDomainScore: number;
    placeholderCheck: boolean;
  };
}

export async function validateEmails(emails: string[]): Promise<EmailValidationResult> {
  try {
    // First perform local validation
    let patternScore = 0;
    let businessDomainScore = 0;
    let placeholderCheck = false;

    for (const email of emails) {
      if (!email) continue;

      // Check pattern validity
      patternScore = validateEmailPattern(email);

      // Check if it's a business email
      if (isValidBusinessEmail(email)) {
        businessDomainScore = 40;
      }

      // Check for placeholder emails
      placeholderCheck = isPlaceholderEmail(email);
      if (placeholderCheck) {
        patternScore = Math.max(0, patternScore - 50);
      }
    }

    // If we have valid emails, use Perplexity AI for additional validation
    if (emails.length > 0 && patternScore > 0) {
      const messages: PerplexityMessage[] = [
        {
          role: "system",
          content: `You are an email validation service. Analyze the provided email addresses and return a confidence score (0-100) considering:
            1. Business email patterns
            2. Domain reputation
            3. Role-based vs personal patterns

            Return JSON format:
            {
              "score": number,
              "analysis": string
            }`
        },
        {
          role: "user",
          content: `Validate these email addresses: ${JSON.stringify(emails)}`
        }
      ];

      const response = await queryPerplexity(messages);
      let aiConfidence = 0;

      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          aiConfidence = result.score || 0;
        }
      } catch (e) {
        console.error('Failed to parse AI validation response:', e);
      }

      // Combine scores with weights
      const finalScore = Math.min(100, Math.floor(
        (patternScore * 0.4) +
        (businessDomainScore * 0.3) +
        (aiConfidence * 0.3)
      ));

      return {
        score: finalScore,
        validationDetails: {
          aiConfidence,
          patternScore,
          businessDomainScore,
          placeholderCheck
        }
      };
    }

    // Return local validation results if AI validation wasn't performed
    return {
      score: Math.min(100, patternScore + businessDomainScore),
      validationDetails: {
        patternScore,
        businessDomainScore,
        placeholderCheck
      }
    };

  } catch (error) {
    console.error('Error in email validation:', error);
    return {
      score: 0,
      validationDetails: {
        patternScore: 0,
        businessDomainScore: 0,
        placeholderCheck: true
      }
    };
  }
}

// Re-export essential analysis functions
export { parseCompanyData } from "./results-analysis/company-parser";
export type { PerplexityMessage };

/**
 * Direct contact discovery with Perplexity
 * Simplified approach that directly asks Perplexity for contacts without complex validation
 */
export async function discoverContactsDirectly(
  companyName: string,
  prompt?: string,
  includeEmails: boolean = true
): Promise<Partial<Contact>[]> {
  try {
    console.log(`Starting direct contact discovery for ${companyName}`);
    
    // Default prompt if none provided
    const systemPrompt = prompt || 
      `Analyze the company structure to identify key decision makers with accurate information.
       Focus on C-level executives, founders, and directors. Ensure each name is accurate and
       represents a real person at the company.`;
    
    // Technical prompt with structured response format
    const technicalPrompt = `Find the key decision makers at ${companyName}.
      ${includeEmails ? 'Include business email addresses when available.' : ''}`;
    
    const responseFormat = `{
      "contacts": [
        {
          "name": "Full name of the contact",
          "role": "Their specific job title",
          "email": ${includeEmails ? '"Their email if known"' : 'null'},
          "confidence": "High/Medium/Low based on data certainty"
        }
      ]
    }`;
    
    // Make the request to Perplexity
    const result = await analyzeWithPerplexity(
      technicalPrompt,
      systemPrompt,
      responseFormat
    );
    
    try {
      // Extract JSON response from the text
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in Perplexity response');
        return [];
      }
      
      const parsedData = JSON.parse(jsonMatch[0]);
      
      if (!parsedData.contacts || !Array.isArray(parsedData.contacts)) {
        console.warn('No contacts array found in parsed data');
        return [];
      }
      
      // Map to Contact structure with simple confidence scoring
      return parsedData.contacts.map((contact: {
        name: string;
        role?: string;
        email?: string;
        confidence?: string;
      }) => {
        // Simple confidence scoring based on Perplexity's confidence
        let probability = 70; // Default medium confidence
        
        if (contact.confidence) {
          const confidenceStr = contact.confidence.toLowerCase();
          if (confidenceStr.includes('high')) probability = 90;
          else if (confidenceStr.includes('medium')) probability = 70;
          else if (confidenceStr.includes('low')) probability = 50;
        }
        
        return {
          name: contact.name,
          role: contact.role || null,
          email: contact.email || null,
          probability,
          nameConfidenceScore: probability,
          lastValidated: new Date(),
          completedSearches: ['perplexity_direct']
        };
      });
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Error in direct contact discovery:', error);
    return [];
  }
}