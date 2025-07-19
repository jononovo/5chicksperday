import type { Company, Contact } from "@shared/schema";
import { queryPerplexity } from "./api/perplexity-client";
import type { PerplexityMessage } from "./types/perplexity";
import { validateEmailPattern, isValidBusinessEmail, isPlaceholderEmail } from "./results-analysis/email-analysis";
import type { ValidationOptions } from "./results-analysis/contact-name-validation";

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
export { extractContacts } from "./results-analysis/email-extraction-format";
export { parseCompanyData } from "./results-analysis/company-parser";
export type { PerplexityMessage };