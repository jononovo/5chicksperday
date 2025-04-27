import { db } from "../db";
import { storage } from "../storage";
import { 
  Company, InsertCompany, 
  Contact, InsertContact, 
  List, InsertList
} from "@shared/schema";
import { logIncomingWebhook, logHttpStatus } from "./webhook-logger";

/**
 * Structure expected to be returned from workflow
 */
interface WorkflowSearchResult {
  searchId: string;
  status: 'completed' | 'error' | 'partial';
  results?: {
    companies?: Array<{
      name: string;
      website?: string;
      size?: number;
      industry?: string;
      location?: string;
      foundedYear?: number;
      services?: string[];
      validationPoints?: string[];
      differentiation?: string[];
      totalScore?: number;
    }>;
    contacts?: Array<{
      name: string;
      title?: string;
      role?: string;
      email?: string;
      phone?: string;
      linkedin?: string;
      companyName?: string;
      department?: string;
      location?: string;
      nameConfidenceScore?: number;
      emailConfidenceScore?: number;
    }>;
  };
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Extract user ID from searchId
 * Assumed format: search_userId_timestamp
 */
function extractUserIdFromSearchId(searchId: string): number | null {
  try {
    const parts = searchId.split('_');
    if (parts.length >= 2) {
      const userId = parseInt(parts[1], 10);
      return isNaN(userId) ? null : userId;
    }
    return null;
  } catch (error) {
    console.error('Error extracting userId from searchId:', error);
    return null;
  }
}

/**
 * Process a webhook result from the workflow
 */
export async function processWebhookResult(
  webhookBody: any, 
  headers: Record<string, any>
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Validate expected structure
    const result = webhookBody as WorkflowSearchResult;
    
    if (!result.searchId) {
      return { 
        success: false, 
        message: "Missing searchId in webhook payload",
        error: "Invalid payload structure" 
      };
    }
    
    // Log the incoming webhook
    const requestId = await logIncomingWebhook(result.searchId, webhookBody, headers);
    
    // Check the processing status
    if (result.status === 'error') {
      await logHttpStatus(requestId, 200, "Webhook received with error status", { 
        error: result.error || "Unknown workflow error" 
      });
      
      return {
        success: true,
        message: "Webhook error recorded",
        error: result.error || "Unknown workflow error"
      };
    }
    
    // Extract userId from searchId
    let userId = extractUserIdFromSearchId(result.searchId);
    
    // If userId cannot be extracted, use a default test user ID
    if (!userId) {
      console.warn(`Could not extract userId from searchId ${result.searchId}, using default test user ID`);
      userId = 2; // Use the test user we created
      
      await logHttpStatus(requestId, 200, "Using default user ID", {
        searchId: result.searchId,
        defaultUserId: userId
      });
    }
    
    // Process the results if available
    if (result.results) {
      // Process companies
      const processedCompanies: Company[] = [];
      if (result.results.companies && result.results.companies.length > 0) {
        console.log(`Processing ${result.results.companies.length} companies from webhook`);
        
        // Create a list for these companies
        const listResult = await storage.createList({
          userId,
          listId: await storage.getNextListId(),
          prompt: `Webhook results from workflow (${result.searchId})`,
          resultCount: result.results.companies.length
        });
        
        // Store each company
        for (const companyData of result.results.companies) {
          // Process and store company
          const company: any = {
            userId: userId, // Add the userId here
            name: companyData.name,
            size: companyData.size || null,
            services: companyData.services || null,
            validationPoints: companyData.validationPoints || null,
            differentiation: companyData.differentiation || null,
            totalScore: companyData.totalScore || null,
            website: companyData.website || null,
            listId: listResult.id,
            age: null,
            alternativeProfileUrl: null,
            defaultContactEmail: null,
            ranking: null,
            linkedinProminence: null,
            customerCount: null,
            rating: null,
            snapshot: null
          };
          
          const savedCompany = await storage.createCompany(company);
          processedCompanies.push(savedCompany);
          console.log(`Processed company: ${savedCompany.name}`);
        }
      }
      
      // Process contacts if available
      if (result.results.contacts && result.results.contacts.length > 0) {
        console.log(`Processing ${result.results.contacts.length} contacts from webhook`);
        
        // Group contacts by company
        const contactsByCompany = new Map<string, typeof result.results.contacts>();
        for (const contact of result.results.contacts) {
          if (!contact.companyName) continue;
          
          if (!contactsByCompany.has(contact.companyName)) {
            contactsByCompany.set(contact.companyName, []);
          }
          contactsByCompany.get(contact.companyName)?.push(contact);
        }
        
        // Process each company's contacts
        for (const [companyName, contacts] of contactsByCompany.entries()) {
          // Find the company (first check in processed companies, then in database)
          let company = processedCompanies.find(c => c.name === companyName);
          if (!company) {
            // Try to find in database
            const companies = await storage.listCompanies(userId);
            company = companies.find(c => c.name === companyName);
          }
          
          // If company not found, create a new one
          if (!company) {
            company = await storage.createCompany({
              userId: userId, // Add the userId here for the second company creation as well
              name: companyName,
              size: null,
              age: null,
              website: null,
              alternativeProfileUrl: null,
              defaultContactEmail: null,
              ranking: null,
              linkedinProminence: null,
              customerCount: null,
              rating: null,
              services: null,
              validationPoints: null,
              differentiation: null,
              totalScore: null,
              snapshot: null,
              listId: null
            });
            console.log(`Created new company ${company.name} for contacts`);
          }
          
          // Now process and store each contact
          for (const contactData of contacts) {
            const contact: any = {
              userId: userId, // Add the userId for contacts as well
              name: contactData.name,
              companyId: company.id,
              role: contactData.role || contactData.title || null,
              email: contactData.email || null,
              linkedinUrl: contactData.linkedin || null,
              department: contactData.department || null,
              location: contactData.location || null,
              nameConfidenceScore: contactData.nameConfidenceScore || null,
              verificationSource: 'Workflow',
              completedSearches: ['workflow_contact_discovery'],
              probability: null,
              twitterHandle: null,
              phoneNumber: null,
              alternativeEmails: null, // This will need a schema update later 
              userFeedbackScore: null,
              feedbackCount: null,
              lastValidated: null,
              lastEnriched: null
            };
            
            await storage.createContact(contact);
            console.log(`Processed contact: ${contact.name} for company ${company.name}`);
          }
        }
      }
      
      // Log successful processing
      await logHttpStatus(requestId, 200, "Webhook processed successfully", {
        processedCompanies: processedCompanies.length,
        processedContacts: result.results.contacts?.length || 0
      });
      
      return {
        success: true,
        message: "Webhook processed successfully"
      };
    } else {
      // No results but not an error
      await logHttpStatus(requestId, 200, "Webhook received but no results", {
        status: result.status
      });
      
      return {
        success: true,
        message: "Webhook received but no results to process"
      };
    }
  } catch (error) {
    console.error(`Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      success: false,
      message: "Error processing webhook",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}