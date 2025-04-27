import { db } from "../db";
import { webhookLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

export type WebhookLogSource = 'workflow-send' | 'workflow-receive';

/**
 * Logs an outgoing request to a workflow provider
 * @param searchId Unique identifier for the search
 * @param url The URL of the workflow webhook
 * @param payload The data sent to the workflow
 * @returns The generated request ID
 */
export async function logOutgoingWebhook(
  searchId: string,
  url: string,
  payload: any
): Promise<string> {
  const requestId = `workflow-send-${Date.now()}`;
  
  try {
    // Log to console
    console.log(`[${new Date().toISOString()}] Logging outgoing webhook request:`, {
      requestId,
      searchId,
      url,
      payload: typeof payload === 'object' ? { ...payload } : payload
    });
    
    // Database logging
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: 'workflow-send',
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      body: typeof payload === 'object' ? payload : { data: payload },
      status: 'sent',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log outgoing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return requestId; // Still return the ID even if logging fails
  }
}

/**
 * Logs an incoming webhook from a workflow provider
 * @param searchId Unique identifier for the search
 * @param payload The data received from the workflow
 * @param headers The HTTP headers from the request
 * @returns The generated request ID
 */
export async function logIncomingWebhook(
  searchId: string,
  payload: any,
  headers: Record<string, string>
): Promise<string> {
  const requestId = `workflow-receive-${Date.now()}`;
  
  try {
    // Log to console
    console.log(`[${new Date().toISOString()}] Logging incoming webhook:`, {
      requestId,
      searchId,
      payload: typeof payload === 'object' ? { ...payload } : payload
    });
    
    // Database logging
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: 'workflow-receive',
      method: 'POST',
      url: '/api/webhooks/workflow',
      headers,
      body: typeof payload === 'object' ? payload : { data: payload },
      status: 'received',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log incoming webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return requestId; // Still return the ID even if logging fails
  }
}

/**
 * Updates the status of a webhook log entry
 * @param requestId The unique request ID to update
 * @param statusCode The HTTP status code
 * @param statusText A text description of the status
 * @param responseData Additional data about the response
 */
export async function updateWebhookStatus(
  requestId: string,
  statusCode: number,
  statusText: string,
  responseData?: any
): Promise<void> {
  try {
    // Log to console
    console.log(`[${new Date().toISOString()}] Updating webhook status for ${requestId}:`, {
      statusCode,
      statusText
    });
    
    // Database update
    await db.update(webhookLogs)
      .set({
        statusCode,
        status: statusCode >= 200 && statusCode < 300 ? 'success' : 'error',
        processingDetails: {
          httpStatus: statusCode,
          httpStatusText: statusText,
          responseTime: new Date().toISOString(),
          responseData
        },
        updatedAt: new Date()
      })
      .where(eq(webhookLogs.requestId, requestId));
  } catch (error) {
    console.error(`Failed to update webhook status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}