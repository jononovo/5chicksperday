import { db } from "../1--db";
import { webhookLogs } from "@shared/schema";
import type { WebhookLog } from "@shared/schema";
import { eq, gte, sql } from "drizzle-orm";

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
    // Log to console for debugging
    console.log(`[${new Date().toISOString()}] Logging outgoing N8N request:`, {
      requestId,
      searchId,
      url,
      payload
    });
    
    // Store in database
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: "n8n-send",
      method: "POST",
      url,
      headers: { "Content-Type": "application/json" },
      body: payload,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log outgoing request: ${error instanceof Error ? error.message : String(error)}`);
    return requestId; // Still return the ID even if logging fails
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
    // Log to console for debugging
    console.log(`[${new Date().toISOString()}] Logging incoming N8N webhook:`, {
      requestId,
      searchId,
      payload
    });
    
    // Store in database
    await db.insert(webhookLogs).values({
      requestId,
      searchId,
      source: "n8n-receive",
      method: "POST",
      url: "/api/webhooks/workflow",
      headers,
      body: payload,
      status: "received",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return requestId;
  } catch (error) {
    console.error(`Failed to log incoming webhook: ${error instanceof Error ? error.message : String(error)}`);
    return requestId; // Still return the ID even if logging fails
  }
}

/**
 * Updates the status of a webhook request
 */
export async function logHttpStatus(
  requestId: string,
  statusCode: number,
  statusText: string,
  responseData?: Record<string, any>
): Promise<void> {
  try {
    // Log to console for debugging
    console.log(`[${new Date().toISOString()}] Logging HTTP status for ${requestId}:`, {
      statusCode,
      statusText
    });
    
    // Update the database record
    await db.update(webhookLogs)
      .set({
        statusCode,
        status: statusCode >= 200 && statusCode < 300 ? "success" : "error",
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
    console.error(`Failed to log HTTP status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Simple health check for N8N integration
 */
export async function checkN8NHealth(): Promise<{
  connected: boolean;
  health: "healthy" | "degraded" | "error" | "unknown";
  requestCount: number;
  responseCount: number;
  errorRate: number;
  lastRequest: Record<string, any> | null;
  lastResponse: Record<string, any> | null;
}> {
  try {
    // Get recent logs (last 24 hours)
    const cutoffDate = new Date(Date.now() - (24 * 60 * 60 * 1000));
    
    const logs = await db.select()
      .from(webhookLogs)
      .where(gte(webhookLogs.createdAt, cutoffDate))
      .orderBy(sql`${webhookLogs.createdAt} DESC`);
    
    // Process logs
    const sendLogs = logs.filter(log => log.source === "n8n-send");
    const receiveLogs = logs.filter(log => log.source === "n8n-receive");
    
    // Calculate error rate
    const errorLogs = sendLogs.filter(log => 
      (log.statusCode && log.statusCode >= 400) || log.status === "error"
    );
    
    const requestCount = sendLogs.length;
    const responseCount = receiveLogs.length;
    const errorRate = requestCount > 0 
      ? Math.round((errorLogs.length / requestCount) * 100)
      : 0;
    
    // Determine health status
    let health: "healthy" | "degraded" | "error" | "unknown" = "unknown";
    
    if (requestCount > 0) {
      if (errorRate >= 50) {
        health = "error";
      } else if (errorRate >= 10) {
        health = "degraded";
      } else {
        health = "healthy";
      }
    }
    
    return {
      connected: health !== "unknown",
      health,
      requestCount,
      responseCount,
      errorRate,
      lastRequest: sendLogs[0] ? {
        time: sendLogs[0].createdAt,
        status: sendLogs[0].statusCode
      } : null,
      lastResponse: receiveLogs[0] ? {
        time: receiveLogs[0].createdAt
      } : null
    };
  } catch (error) {
    console.error(`Error checking N8N health: ${error instanceof Error ? error.message : String(error)}`);
    return {
      connected: false,
      health: "unknown",
      requestCount: 0,
      responseCount: 0,
      errorRate: 0,
      lastRequest: null,
      lastResponse: null
    };
  }
}