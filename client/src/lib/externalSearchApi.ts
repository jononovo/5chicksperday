// External Search API Client
// Handles communication with external lead generation providers

// External provider configuration
interface ExternalProvider {
  name: string;
  endpoint: string;
  apiKey: string;
  workflowId: string;
}

// Define our providers
export const externalProviders: Record<string, ExternalProvider> = {
  lion: {
    name: "Lead-Gen Lion",
    endpoint: "https://api.leadgenlion.example.com",
    apiKey: process.env.LEAD_GEN_LION_API_KEY || "YOUR_LEAD_GEN_LION_API_KEY", // Replace with env var
    workflowId: "lion-workflow-123",
  },
  rabbit: {
    name: "Lead-Gen Rabbit",
    endpoint: "https://api.leadgenrabbit.example.com",
    apiKey: process.env.LEAD_GEN_RABBIT_API_KEY || "YOUR_LEAD_GEN_RABBIT_API_KEY", // Replace with env var
    workflowId: "rabbit-workflow-456",
  },
  donkey: {
    name: "Lead-Gen Donkey",
    endpoint: "https://api.leadgendonkey.example.com",
    apiKey: process.env.LEAD_GEN_DONKEY_API_KEY || "YOUR_LEAD_GEN_DONKEY_API_KEY", // Replace with env var
    workflowId: "donkey-workflow-789",
  },
};

// Request parameters for external search
export interface ExternalSearchParams {
  query: string;
  callbackUrl: string;
  additionalParams?: Record<string, any>;
}

// Response from initiating an external search
export interface ExternalSearchResponse {
  searchId: string;
  status: string;
  message?: string;
  error?: string;
}

// Function to trigger external search with a specific provider
export async function triggerExternalSearch(
  providerId: keyof typeof externalProviders,
  params: ExternalSearchParams
): Promise<ExternalSearchResponse> {
  const provider = externalProviders[providerId];
  
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  
  try {
    // Construct webhook URL with workflowId
    const webhookUrl = `${provider.endpoint}/api/webhooks/workflow/${provider.workflowId}/node/webhook_trigger-1`;
    
    // Make API request to the provider
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        query: params.query,
        callbackUrl: params.callbackUrl,
        ...params.additionalParams
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Provider API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error triggering ${provider.name} search:`, error);
    throw error;
  }
}

// Track searches in progress
interface SearchTracking {
  providerId: string;
  searchId: string;
  query: string;
  status: 'in_progress' | 'completed' | 'failed';
  startTime: Date;
  lastUpdate?: Date;
  results?: any;
  error?: string;
}

// In-memory storage for active searches
// In a production app, this would be in a database
const activeSearches: Record<string, SearchTracking> = {};

// Update search status
export function updateSearchStatus(searchId: string, status: 'in_progress' | 'completed' | 'failed', data: any): void {
  if (activeSearches[searchId]) {
    activeSearches[searchId].status = status;
    activeSearches[searchId].lastUpdate = new Date();
    
    if (status === 'completed' && data?.results) {
      activeSearches[searchId].results = data.results;
    } else if (status === 'failed' && data?.error) {
      activeSearches[searchId].error = data.error;
    }
  }
}

// Get search status
export function getSearchStatus(searchId: string): SearchTracking | undefined {
  return activeSearches[searchId];
}

// Start tracking a search
export function trackSearch(searchId: string, providerId: string, query: string): void {
  activeSearches[searchId] = {
    providerId,
    searchId,
    query,
    status: 'in_progress',
    startTime: new Date()
  };
}

// List all active searches
export function listActiveSearches(): SearchTracking[] {
  return Object.values(activeSearches).filter(search => 
    search.status === 'in_progress'
  );
}