import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { queryPerplexity } from './perplexity-client';
import type { PerplexityMessage } from '../perplexity';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables.');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

interface FunctionCallResult {
  type: 'conversation' | 'product_summary' | 'email_strategy' | 'sales_approach' | 'progressive_strategy';
  message: string;
  data?: any;
  initialTarget?: string;
  refinedTarget?: string;
  needsProgressiveGeneration?: boolean;
}

// Perplexity-powered report generation functions
async function generateProductSummary(params: any, productContext: any): Promise<any> {
  const productData = params.productData || productContext;
  
  if (!productData || !productData.productService) {
    throw new Error('Product data is required for summary generation');
  }
  
  const perplexityPrompt = `
Analyze this product and create a concise summary (max 200 words, bullet points):

Product: ${productData.productService}
Customer Feedback: ${productData.customerFeedback || 'Not provided'}
Website: ${productData.website || 'Not provided'}

Required structure:
• **What it is**: [Product description]
• **Problem it solves**: [Customer pain point]  
• **Competitive advantage**: [Why superior]
• **Customer benefit**: [Selling approach advantage]

Focus on differentiation and value. Maximum 200 words.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a product analyst. Create concise, bullet-pointed summaries focused on competitive advantage." },
    { role: "user", content: perplexityPrompt }
  ]);

  return {
    title: "Product Analysis Summary",
    content: result,
    wordCount: result.split(' ').length
  };
}

// Sequential strategy generation functions
export async function generateBoundaryOptions(params: any, productContext: any): Promise<string[]> {
  const { initialTarget, refinedTarget } = params;
  
  // Create 3 different strategic approaches
  const prompts = [
    // Geographic-focused approach
    `Create a 90-day lead-generation target segment boundary for SELLING this product: ${productContext.productService}. 
Here are Target Customer Examples that the company sells to: ${initialTarget} or ${refinedTarget}.

Focus on BROADER GEOGRAPHIC expansion. Expand beyond the current location to include multiple cities, states, or regions to reach ~700 companies across 6 sprints.
Max 10 words.

Examples: mid-level rated, irish bars in NY state
Return only the boundary statement, no additional text.`,

    // Niche-focused approach  
    `Create a 90-day lead-generation target segment boundary for SELLING this product: ${productContext.productService}. 
Here are Target Customer Examples that the company sells to: ${initialTarget} or ${refinedTarget}.

Focus on DEEP NICHE specialization. Identify a specific industry subset or customer type that would highly value this product. If the niche is very specific, expand geography to reach ~700 companies across 6 sprints.
Max 10 words.

Examples: STEM tutoring companies in South America
Return only the boundary statement, no additional text.`,

    // Hybrid approach
    `Create a 90-day lead-generation target segment boundary for SELLING this product: ${productContext.productService}. 
Here are Target Customer Examples that the company sells to: ${initialTarget} or ${refinedTarget}.

Focus on MARKET SIZE optimization. Balance geographic reach with niche targeting to efficiently reach exactly ~700 companies across 6 sprints.
Max 10 words.

Examples: FinTech companies in India
Return only the boundary statement, no additional text.`
  ];

  const systemMessage: PerplexityMessage = { role: "system", content: "You are a market strategy expert. Create focused, strategic boundaries for sales campaigns." };
  
  // Generate all 3 options
  const results = await Promise.all(
    prompts.map(prompt => 
      queryPerplexity([systemMessage, { role: "user", content: prompt } as PerplexityMessage])
    )
  );

  return results.map(result => result.trim());
}

// Keep original function for backwards compatibility
export async function generateBoundary(params: any, productContext: any): Promise<string> {
  const options = await generateBoundaryOptions(params, productContext);
  return options[0]; // Return first option as default
}

export async function generateSprintPrompt(boundary: string, params: any, productContext: any): Promise<string> {
  const { refinedTarget } = params;
  
  const perplexityPrompt = `
Create a sprint planning prompt for ${productContext.productService}:
90-Day Strategic Boundary: ${boundary}
Current Refined Target: ${refinedTarget}

Define an "exampleSprintPlanningPrompt" - a Sprint Search Statement that guides in defining 8-10 daily search prompts needed to source contacts every day for two weeks.

Create this statement by defining a sub-set of, or niche within, the "${boundary}" and also using the ${refinedTarget} to stay relevant (even if in a different sector or geography).

The sprint prompt should segment a part of the 90-Day target boundary, in order to generate 8 "daily search queries" that will each result in 7-10 companies.

Return only the sprint prompt statement, no additional text.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a sales sprint planning expert. Create focused sprint strategies that segment broader market boundaries." },
    { role: "user", content: perplexityPrompt }
  ]);

  return result.trim();
}

export async function generateDailyQueries(boundary: string, sprintPrompt: string, productContext: any): Promise<string[]> {
  const perplexityPrompt = `
Generate 8 daily search queries for ${productContext.productService}:
90-Day Strategic Boundary: ${boundary}
Sprint Focus: ${sprintPrompt}
 
Create a list of specific search prompts (max 8 words each) that will generate 5-10 targeted results each. Usually one per day is generated. Usually either:
- geo-local (section of large city: Fintech in Brooklyn)
- niche (niche of a niche: horse-brush manufacturers)
- Medium-level combination of niche + local (real-estate lawyers in Miami)
 
List one per line without numbers. Keep concise. No introductions or extra sections.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a lead generation expert. Create highly specific, actionable daily search queries." },
    { role: "user", content: perplexityPrompt }
  ]);

  // Split by newlines and filter out empty lines
  const queries = result
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  return queries;
}

export async function generateEmailStrategy(params: any, productContext: any): Promise<any> {
  // Sequential generation with actual interdependence
  const boundary = await generateBoundary(params, productContext);
  const sprintPrompt = await generateSprintPrompt(boundary, params, productContext);
  const dailyQueries = await generateDailyQueries(boundary, sprintPrompt, productContext);
  
  // Format full report
  const content = `## 1. TARGET BOUNDARY
${boundary}

## 2. SPRINT PROMPT
${sprintPrompt}

## 3. DAILY QUERIES
${dailyQueries.join('\n')}`;

  return {
    title: "90-Day Email Strategy",
    boundary,
    sprintPrompt,
    dailyQueries,
    content
  };
}

// Parsing functions to extract structured components
function extractBoundary(content: string): string {
  const match = content.match(/## 1\. TARGET BOUNDARY\s*\n(.*?)(?=\n\n|\n##|$)/s);
  return match ? match[1].trim() : '';
}

function extractSprintPrompt(content: string): string {
  const match = content.match(/## 2\. SPRINT PROMPT\s*\n(.*?)(?=\n\n|\n##|$)/s);
  return match ? match[1].trim() : '';
}

function extractDailyQueries(content: string): string[] {
  const match = content.match(/## 3\. DAILY QUERIES\s*\n(.*?)$/s);
  if (!match) return [];
  
  const queriesText = match[1].trim();
  // Split by newlines and filter out empty lines
  const queries = queriesText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('Keep concise'));
  
  return queries;
}

async function generateSalesApproach(params: any, productContext: any): Promise<any> {
  const { strategyContext } = params;
  const productData = productContext;
  
  const perplexityPrompt = `
Create a strategic email approach guide (max 200 words) for ${productContext.productService}.

Format exactly as:

**RELATIONSHIP INITIATION APPROACHES:**
• **Standard**: [Traditional approach]
• **Innovation 1**: [Creative method]
• **Innovation 2**: [Unique technique] 
• **Innovation 3**: [Unconventional strategy]

**SUBJECT LINE FORMATS:**
• **Standard**: [Professional format]
• **Innovation 1**: [Curiosity approach]
• **Innovation 2**: [Value-focused technique]
• **Innovation 3**: [Personalized format]

High-level strategic guidance for email generation.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a sales strategy expert. Create structured, high-level email approach guidance." },
    { role: "user", content: perplexityPrompt }
  ]);

  return {
    title: "Sales Approach Strategy",
    content: result,
    sections: {
      approaches: "4 relationship initiation methods",
      subjectLines: "4 subject line formats"
    }
  };
}

export async function queryOpenAI(
  messages: ChatCompletionMessageParam[],
  productContext: any
): Promise<FunctionCallResult> {
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "generateProductSummary",
            description: "Generate product analysis summary from form data - call immediately when chat opens",
            parameters: {
              type: "object",
              properties: {
                productData: {
                  type: "object",
                  description: "Product information from form inputs"
                }
              },
              required: ["productData"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generateEmailStrategy",
            description: "Generate 90-day email sales strategy after collecting both initial target and refinement of target companies",
            parameters: {
              type: "object",
              properties: {
                initialTarget: {
                  type: "string",
                  description: "Initial target market example from user"
                },
                refinedTarget: {
                  type: "string", 
                  description: "Refined target market with additional specificity"
                },
                productContext: {
                  type: "object",
                  description: "Product context from previous summary"
                }
              },
              required: ["initialTarget", "refinedTarget", "productContext"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generateSalesApproach",
            description: "Generate sales approach strategy for email content - final report",
            parameters: {
              type: "object",
              properties: {
                strategyContext: {
                  type: "object",
                  description: "Context from email strategy"
                },
                productContext: {
                  type: "object",
                  description: "Product context"
                }
              },
              required: ["strategyContext", "productContext"]
            }
          }
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const assistantMessage = response.choices[0].message;

    // Handle function calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      if (functionName === 'generateProductSummary') {
        const summary = await generateProductSummary(functionArgs, productContext);
        return {
          type: 'product_summary',
          message: "Here's your product analysis summary:",
          data: summary
        };
      } else if (functionName === 'generateEmailStrategy') {
        // Redirect to progressive boundary selection flow instead of generating complete strategy
        return {
          type: 'progressive_strategy' as const,
          message: "Perfect! Now I'll create your **strategic sales plan** step by step.",
          initialTarget: functionArgs.initialTarget,
          refinedTarget: functionArgs.refinedTarget,
          needsProgressiveGeneration: true
        };
      } else if (functionName === 'generateSalesApproach') {
        const approach = await generateSalesApproach(functionArgs, productContext);
        return {
          type: 'sales_approach',
          message: "Here's your sales approach strategy:",
          data: approach
        };
      }
    }

    // Regular conversation response
    return {
      type: 'conversation',
      message: assistantMessage.content || "I need more information to help you."
    };

  } catch (error) {
    // Check if it's an API key configuration error
    if (error instanceof Error && error.message.includes('OpenAI API key not configured')) {
      return {
        type: 'conversation',
        message: 'AI features are currently unavailable. Please configure your OpenAI API key to enable intelligent search capabilities.'
      };
    }
    
    console.error('OpenAI API error:', error);
    
    // Return user-friendly error instead of throwing
    return {
      type: 'conversation',
      message: 'AI services are temporarily unavailable. Please try again later.'
    };
  }
}