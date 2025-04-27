import { db } from "../db";
import { webhookLogs, insertWebhookLogSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Log an outgoing request to the workflow provider
 */
export async function logOutgoingRequest(searchId: string, url: string, payload: any) {
  const requestId = `workflow-send-${Date.now()}`;
  
  try {
    // Simple console logging
    console.log(`[${new Date().toISOString()}] Logging outgoing request:`, {
      requestId,
      searchId,
      url,
      payload
    });
    
    // Database logging
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: 'workflow-send',
      method: 'POST',
      url,
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log outgoing request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return requestId; // Still return the ID even if logging fails
  }
}

/**
 * Log an incoming webhook from the workflow provider
 */
export async function logIncomingWebhook(searchId: string, payload: any, headers: Record<string, any>) {
  const requestId = `workflow-receive-${Date.now()}`;
  
  try {
    // Simple console logging
    console.log(`[${new Date().toISOString()}] Logging incoming webhook:`, {
      requestId,
      searchId,
      payload
    });
    
    // Database logging
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: 'workflow-receive',
      method: 'POST',
      url: '/api/webhooks/workflow',
      headers,
      body: payload,
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
 * Update the HTTP status of a webhook log
 */
export async function logHttpStatus(requestId: string, statusCode: number, statusText: string, responseData?: any) {
  try {
    // Simple console logging
    console.log(`[${new Date().toISOString()}] Logging HTTP status for ${requestId}:`, {
      statusCode,
      statusText
    });
    
    // Determine status based on statusCode
    const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'error';
    
    // Database logging
    await db.update(webhookLogs)
      .set({
        statusCode,
        status,
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
    console.error(`Failed to log HTTP status: ${error instanceof Error ? error.message : 'Unknown error'}`);
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