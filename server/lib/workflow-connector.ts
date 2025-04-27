import { logOutgoingRequest, logHttpStatus } from "./webhook-logger";

// Fixed workflow webhook URL (update this with your actual workflow URL)
const WORKFLOW_WEBHOOK_URL = "https://5ducks-lead-discovery-workflow.replit.app/api/trigger";

/**
 * Send a search request to the workflow system
 */
export async function sendSearchRequest(userId: number, query: string, options?: Record<string, any>) {
  // Generate a unique search ID with the format search_userId_timestamp
  const searchId = `search_${userId}_${Date.now()}`;
  
  // Prepare the request payload
  const payload = {
    query,
    callbackUrl: process.env.WEBHOOK_CALLBACK_URL || "https://5ducks.replit.app/api/webhooks/workflow",
    searchId,
    options
  };
  
  // Log the outgoing request
  const requestId = await logOutgoingRequest(searchId, WORKFLOW_WEBHOOK_URL, payload);
  
  try {
    // Make the API request
    const response = await fetch(WORKFLOW_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.WORKFLOW_API_KEY || "workflow_key_development"
      },
      body: JSON.stringify(payload)
    });
    
    // Parse response data
    const responseData = await response.json();
    
    // Log the response
    await logHttpStatus(requestId, response.status, response.statusText, responseData);
    
    // Check response status
    if (!response.ok) {
      throw new Error(`Workflow API error: ${response.status} ${response.statusText}`);
    }
    
    return {
      success: true,
      searchId,
      message: "Search request submitted successfully",
      data: responseData
    };
  } catch (error) {
    console.error(`Search request failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    
    // Log the error
    await logHttpStatus(requestId, 500, error instanceof Error ? error.message : "Unknown error");
    
    return {
      success: false,
      searchId,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Setup a keep-alive mechanism for long-running searches
 */
const keepAliveTimers: Record<string, NodeJS.Timeout> = {};

export function startKeepAlive(searchId: string, minutes = 15) {
  console.log(`Starting keep-alive for search ${searchId} (${minutes} minutes)`);
  
  // Clear any existing timer for this search
  if (keepAliveTimers[searchId]) {
    clearInterval(keepAliveTimers[searchId]);
  }
  
  // Calculate interval and end time
  const intervalMs = 30 * 1000; // 30 seconds
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  // Start the interval
  keepAliveTimers[searchId] = setInterval(() => {
    const remaining = endTime - Date.now();
    
    // If time is up, clear the interval
    if (remaining <= 0) {
      console.log(`Keep-alive for search ${searchId} completed`);
      clearInterval(keepAliveTimers[searchId]);
      delete keepAliveTimers[searchId];
      return;
    }
    
    // Log a keep-alive message
    console.log(`Keep-alive ping for search ${searchId} - ${Math.ceil(remaining / 60000)} minutes remaining`);
    
    // Make a simple request to keep the server awake
    fetch("/api/ping").catch(() => {});
  }, intervalMs);
}

/**
 * Stop keep-alive for a search
 */
export function stopKeepAlive(searchId: string) {
  if (keepAliveTimers[searchId]) {
    console.log(`Stopping keep-alive for search ${searchId}`);
    clearInterval(keepAliveTimers[searchId]);
    delete keepAliveTimers[searchId];
  }
}