import { db } from "../db";
import { webhookLogs, insertWebhookLogSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

/**
 * Log an outgoing request to the workflow provider
 */
export async function logOutgoingRequest(searchId: string, url: string, payload: any) {
  try {
    const requestId = uuidv4(); // Generate a unique ID for this request
    
    // Create log entry
    const logEntry = {
      requestId,
      searchId,
      source: 'workflow-send',
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      createdAt: new Date()
    };
    
    // Insert into database 
    const [log] = await db.insert(webhookLogs)
      .values(logEntry)
      .returning();
    
    console.log(`Logged outgoing workflow request: ${requestId}`);
    
    return requestId;
  } catch (error) {
    console.error(`Error logging outgoing request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return uuidv4(); // Return a new ID anyway so caller doesn't fail
  }
}

/**
 * Log an incoming webhook from the workflow provider
 */
export async function logIncomingWebhook(searchId: string, payload: any, headers: Record<string, any>) {
  try {
    const requestId = uuidv4(); // Generate a unique ID for this webhook
    
    // Create log entry
    const logEntry = {
      requestId,
      searchId,
      source: 'workflow-receive',
      headers: headers,
      payload: JSON.stringify(payload),
      status: 'received',
      createdAt: new Date()
    };
    
    // Insert into database
    const [log] = await db.insert(webhookLogs)
      .values(logEntry)
      .returning();
    
    console.log(`Logged incoming webhook: ${requestId}`);
    
    return requestId;
  } catch (error) {
    console.error(`Error logging incoming webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return uuidv4(); // Return a new ID anyway so caller doesn't fail
  }
}

/**
 * Update the HTTP status of a webhook log
 */
export async function logHttpStatus(requestId: string, statusCode: number, statusText: string, responseData?: any) {
  try {
    // Update the log with status information
    await db.update(webhookLogs)
      .set({
        statusCode,
        statusText,
        response: responseData ? JSON.stringify(responseData) : null,
        updatedAt: new Date()
      })
      .where(eq(webhookLogs.requestId, requestId));
    
    console.log(`Updated log ${requestId} with status ${statusCode}: ${statusText}`);
    
    return true;
  } catch (error) {
    console.error(`Error updating log status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Check the health of the workflow provider
 */
export async function checkProviderHealth() {
  try {
    // Get recent logs from the last 24 hours
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    const logs = await db.select()
      .from(webhookLogs)
      .orderBy(webhookLogs.createdAt);
    
    // Count requests and responses
    const sendLogs = logs.filter(log => log.source === 'workflow-send');
    const receiveLogs = logs.filter(log => log.source === 'workflow-receive');
    
    // Calculate error rate
    const errorLogs = sendLogs.filter(log => 
      (log.statusCode && log.statusCode >= 400) || log.status === 'error'
    );
    
    const requestCount = sendLogs.length;
    const responseCount = receiveLogs.length;
    const errorRate = requestCount > 0 
      ? (errorLogs.length / requestCount) * 100 
      : 0;
    
    // Determine health status
    let health = 'unknown';
    if (requestCount > 0) {
      if (errorRate >= 50) {
        health = 'error';
      } else if (errorRate >= 10) {
        health = 'degraded';
      } else {
        health = 'healthy';
      }
    }
    
    return {
      provider: 'workflow',
      connected: health !== 'unknown',
      health,
      requestCount,
      responseCount,
      errorRate: Math.round(errorRate),
      lastRequest: sendLogs[0] ? {
        time: sendLogs[0].createdAt,
        status: sendLogs[0].statusCode
      } : null,
      lastResponse: receiveLogs[0] ? {
        time: receiveLogs[0].createdAt
      } : null
    };
  } catch (error) {
    console.error(`Error checking provider health: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      provider: 'workflow',
      connected: false,
      health: 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}