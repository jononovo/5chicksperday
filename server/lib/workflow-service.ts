import { logOutgoingWebhook, updateWebhookStatus } from './webhook-logger';
import { storage } from '../storage';
import { Company, Contact } from '@shared/schema';

// Type for search request payload
interface SearchRequestPayload {
  query: string;
  searchId: string;
  userId: number;
  strategyId: number;
  callbackUrl?: string;
}

// Default workflow webhook URL - this should be configured per environment
// For production, this should be stored in environment variables
const DEFAULT_WORKFLOW_URL = process.env.WORKFLOW_WEBHOOK_URL || 
  "https://your-workflow-instance.n8n.cloud/webhook/workflow-trigger";

/**
 * Service for interacting with external workflow providers
 */
export class WorkflowService {
  private workflowUrl: string;
  
  constructor(workflowUrl?: string) {
    this.workflowUrl = workflowUrl || DEFAULT_WORKFLOW_URL;
  }
  
  /**
   * Send a search request to the workflow provider
   * @param query The search query
   * @param userId The user ID making the request
   * @param strategyId The ID of the search strategy to use
   * @returns Object containing success status and search ID
   */
  async sendSearchRequest(query: string, userId: number, strategyId: number): Promise<{ success: boolean; searchId: string; error?: string }> {
    // Generate a unique search ID
    const searchId = `search_${Date.now()}`;
    
    try {
      // Get the search strategy
      const searchApproach = await storage.getSearchApproach(strategyId);
      if (!searchApproach) {
        throw new Error(`Search strategy with ID ${strategyId} not found`);
      }
      
      // Prepare the request payload
      const payload: SearchRequestPayload = {
        query,
        searchId,
        userId,
        strategyId,
        callbackUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/workflow`
      };
      
      // Log the outgoing request
      const requestId = await logOutgoingWebhook(searchId, this.workflowUrl, payload);
      
      // Make the API request
      const response = await fetch(this.workflowUrl, {
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