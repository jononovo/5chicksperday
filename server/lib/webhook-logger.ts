// Console-only webhook logging - PostgreSQL database logging disabled
import type { WebhookLog } from "@shared/schema";

/**
 * Logs outgoing webhook requests to N8N workflows
 */
export async function logOutgoingRequest(
  searchId: string,
  url: string,
  payload: Record<string, any>
): Promise<string> {
  const requestId = `n8n-send-${Date.now()}`;
  
  try {
    console.log(`[${new Date().toISOString()}] Outgoing N8N webhook:`, {
      requestId,
      searchId,
      url,
      payload,
      status: "pending"
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log outgoing request: ${error instanceof Error ? error.message : String(error)}`);
    return requestId;
  }
}

/**
 * Logs incoming webhook data from N8N workflows
 */
export async function logIncomingWebhook(
  searchId: string,
  payload: Record<string, any>,
  headers: Record<string, string>
): Promise<string> {
  const requestId = `n8n-receive-${Date.now()}`;
  
  try {
    console.log(`[${new Date().toISOString()}] Incoming N8N webhook:`, {
      requestId,
      searchId,
      payload,
      headers,
      status: "received"
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log incoming webhook: ${error instanceof Error ? error.message : String(error)}`);
    return requestId;
  }
}

/**
 * Updates the status of a previously logged webhook request
 */
export async function updateRequestStatus(
  requestId: string,
  status: 'sent' | 'failed' | 'processed' | 'error',
  metadata?: Record<string, any>
): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Webhook status update:`, {
      requestId,
      status,
      metadata
    });
  } catch (error) {
    console.error(`Failed to update request status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieves recent webhook logs for debugging
 */
export async function getRecentLogs(searchId?: string, limit: number = 50): Promise<WebhookLog[]> {
  console.log(`[${new Date().toISOString()}] Webhook logs requested:`, {
    searchId,
    limit,
    note: "Database logging disabled - no logs available"
  });
  
  // Return empty array since we're not using database
  return [];
}

/**
 * Cleans up old webhook logs
 */
export async function cleanupOldLogs(olderThanDays: number = 30): Promise<number> {
  console.log(`[${new Date().toISOString()}] Webhook log cleanup requested:`, {
    olderThanDays,
    note: "Database logging disabled - no cleanup needed"
  });
  
  return 0;
}

/**
 * Logs HTTP status for debugging
 */
export async function logHttpStatus(
  requestId: string,
  status: number,
  statusText: string,
  responseBody?: any
): Promise<void> {
  console.log(`[${new Date().toISOString()}] HTTP status logged:`, {
    requestId,
    status,
    statusText,
    responseBody,
    note: "Console logging only"
  });
}