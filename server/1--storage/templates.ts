import { PgDatabase } from 'drizzle-orm/pg-core';
import { eq, and, or } from 'drizzle-orm';
import {
  type EmailTemplate,
  type InsertEmailTemplate,
  emailTemplates
} from '@shared/schema';

export class TemplateStorage {
  constructor(private db: PgDatabase<any>) {}

  async getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined> {
    console.log('TemplateStorage.getEmailTemplate called with:', { id, userId });
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return template;
  }

  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    console.log('TemplateStorage.listEmailTemplates called for userId:', userId);
    
    // If this is not userId=1, get both the default templates and the user's templates
    if (userId !== 1) {
      console.log(`Fetching both default templates (userId=1) and user templates (userId=${userId})`);
      return this.db
        .select()
        .from(emailTemplates)
        .where(or(
          eq(emailTemplates.userId, 1),  // Default templates (userId=1)
          eq(emailTemplates.userId, userId)  // User's personal templates
        ))
        .orderBy(emailTemplates.createdAt);
    }
    
    // If it is userId=1, just return their templates (which are the defaults)
    console.log('Fetching only templates for userId=1 (defaults)');
    return this.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.userId, userId))
      .orderBy(emailTemplates.createdAt);
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    console.log('TemplateStorage.createEmailTemplate called with:', {
      name: template.name,
      userId: template.userId
    });
    const [created] = await this.db
      .insert(emailTemplates)
      .values(template)
      .returning();
    return created;
  }

  async updateEmailTemplate(
    id: number,
    updates: Partial<EmailTemplate>,
    userId: number
  ): Promise<EmailTemplate | undefined> {
    const [updated] = await this.db
      .update(emailTemplates)
      .set(updates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: number, userId: number): Promise<void> {
    await this.db
      .delete(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
  }


}