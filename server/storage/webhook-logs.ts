import { eq, desc } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { webhookLogs } from '@shared/schema';
import type { WebhookLog, InsertWebhookLog } from '@shared/schema';
import type { PgDatabase } from 'drizzle-orm/pg-core';

/**
 * Storage implementation for webhook logs
 */
export class WebhookLogStorage {
  constructor(private readonly db: PgDatabase) {}

  /**
   * Create a new webhook log record
   */
  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [createdLog] = await this.db
      .insert(webhookLogs)
      .values(log)
      .returning();
    
    return createdLog;
  }

  /**
   * Get a webhook log by its request ID
   */
  async getWebhookLog(requestId: string): Promise<WebhookLog | undefined> {
    const [log] = await this.db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.requestId, requestId));
    
    return log;
  }

  /**
   * List all webhook logs, with optional limit
   */
  async listWebhookLogs(limit?: number): Promise<WebhookLog[]> {
    let query = this.db
      .select()
      .from(webhookLogs)
      .orderBy(desc(webhookLogs.createdAt));
    
    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Update the processing status of a webhook log
   */
  async updateWebhookLogStatus(
    requestId: string, 
    status: string, 
    processed: boolean,
    processingDetails?: Record<string, any>
  ): Promise<WebhookLog | undefined> {
    const updates: Partial<WebhookLog> = {
      status,
      processed
    };

    if (processingDetails) {
      updates.processingDetails = processingDetails;
    }

    const [updatedLog] = await this.db
      .update(webhookLogs)
      .set(updates)
      .where(eq(webhookLogs.requestId, requestId))
      .returning();
    
    return updatedLog;
  }

  /**
   * Get webhook logs by search ID
   */
  async getWebhookLogsBySearchId(searchId: string): Promise<WebhookLog[]> {
    return this.db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.searchId, searchId))
      .orderBy(desc(webhookLogs.createdAt));
  }
}