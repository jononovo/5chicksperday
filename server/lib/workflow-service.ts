import { logOutgoingWebhook, updateWebhookStatus } from './webhook-logger';
import { storage } from '../storage';
import { Company, Contact } from '@shared/schema';

// Type for search request payload
interface SearchRequestPayload {
  query: string;
  searchId: string;
  userId: number;
  strategyId: number;
  provider?: string;
  callbackUrl?: string;
}

// Workflow provider URLs
const WORKFLOW_PROVIDERS = {
  default: process.env.WORKFLOW_WEBHOOK_URL || 
    "https://your-workflow-instance.n8n.cloud/webhook/workflow-trigger",
  lion: process.env.LION_WORKFLOW_URL || 
    "https://lion-workflow.example.com/webhook/trigger",
  rabbit: process.env.RABBIT_WORKFLOW_URL || 
    "https://rabbit-workflow.example.com/webhook/trigger",
  donkey: process.env.DONKEY_WORKFLOW_URL || 
    "https://donkey-workflow.example.com/webhook/trigger"
};

/**
 * Service for interacting with external workflow providers
 */
export class WorkflowService {
  /**
   * Send a search request to the workflow provider
   * @param query The search query
   * @param userId The user ID making the request
   * @param strategyId The ID of the search strategy to use
   * @param provider Optional workflow provider ID
   * @returns Object containing success status and search ID
   */
  async sendSearchRequest(
    query: string, 
    userId: number, 
    strategyId: number, 
    provider?: string
  ): Promise<{ success: boolean; searchId: string; error?: string }> {
    // Generate a unique search ID
    const searchId = `search_${Date.now()}`;
    
    try {
      // Get the search strategy
      const searchApproach = await storage.getSearchApproach(strategyId);
      if (!searchApproach) {
        throw new Error(`Search strategy with ID ${strategyId} not found`);
      }
      
      // Get the workflow URL for the specified provider or use the default
      const workflowUrl = provider && WORKFLOW_PROVIDERS[provider as keyof typeof WORKFLOW_PROVIDERS]
        ? WORKFLOW_PROVIDERS[provider as keyof typeof WORKFLOW_PROVIDERS]
        : WORKFLOW_PROVIDERS.default;
        
      console.log(`Using workflow provider: ${provider || 'default'} - URL: ${workflowUrl}`);
      
      // Prepare the request payload
      const payload: SearchRequestPayload = {
        query,
        searchId,
        userId,
        strategyId,
        provider,
        callbackUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/workflow`
      };
      
      // Log the outgoing request
      const requestId = await logOutgoingWebhook(searchId, workflowUrl, payload);
      
      // Make the API request
      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      // Check response status
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Workflow API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Update the webhook log with the response
      await updateWebhookStatus(requestId, response.status, response.statusText, data);
      
      console.log(`Search request successful: ${JSON.stringify(data)}`);
      
      return {
        success: true,
        searchId
      };
    } catch (error) {
      console.error(`Search request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        searchId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Process search results from the workflow
   * @param searchId The unique search ID
   * @param results The search results
   * @param userId The user ID who initiated the search
   * @returns Object indicating success
   */
  async processSearchResults(searchId: string, results: any, userId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Processing search results for ${searchId}`);
      
      // Verify we have valid results
      if (!results) {
        throw new Error("No results provided");
      }
      
      // Extract companies and contacts if available
      const companies = results.companies || [];
      const contacts = results.contacts || [];
      
      console.log(`Found ${companies.length} companies and ${contacts.length} contacts`);
      
      // Store the companies in the database
      for (const companyData of companies) {
        try {
          // Only store the company if it has a name
          if (companyData.name) {
            const company = await storage.createCompany({
              ...companyData,
              userId
            });
            
            console.log(`Stored company: ${company.name} (ID: ${company.id})`);
          }
        } catch (error) {
          console.error(`Error storing company: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Store the contacts in the database
      for (const contactData of contacts) {
        try {
          // Only store the contact if it has a name and companyId
          if (contactData.name && contactData.companyId) {
            const contact = await storage.createContact({
              ...contactData,
              userId
            });
            
            console.log(`Stored contact: ${contact.name} (ID: ${contact.id})`);
          }
        } catch (error) {
          console.error(`Error storing contact: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error(`Error processing search results: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export an instance of the workflow service
export const workflowService = new WorkflowService();