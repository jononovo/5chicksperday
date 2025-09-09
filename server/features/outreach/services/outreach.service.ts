import { db } from '../../../db';
import { 
  contacts, 
  companies, 
  emailActivities, 
  dailyOutreachBatches,
  userOutreachPreferences,
  type EmailActivity,
  type Contact,
  type Company
} from '@shared/schema';
import { eq, and, or, lt, isNull, ne, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';
import type { 
  EmailActivityData, 
  ContactStatusUpdate, 
  CompanySkipData,
  OutreachBatchData,
  GeneratedEmail,
  ContactWithCompany,
  AvailableContactsResult,
  OutreachPreferences
} from '../types';

export class OutreachService {
  /**
   * Track email sent to a contact
   */
  async trackEmailActivity(userId: number, data: EmailActivityData): Promise<EmailActivity> {
    // Start a transaction to update both tables
    return await db.transaction(async (tx) => {
      // Insert email activity record
      const [activity] = await tx.insert(emailActivities).values({
        userId,
        ...data,
        sentAt: new Date()
      }).returning();

      // Update contact status
      await tx.update(contacts)
        .set({
          contactStatus: 'emailed',
          lastEmailedAt: new Date(),
          emailCount: sql`${contacts.emailCount} + 1`
        })
        .where(eq(contacts.id, data.contactId));

      // Update company status if this is the first contact emailed from this company
      const companyContacts = await tx.select()
        .from(contacts)
        .where(and(
          eq(contacts.companyId, data.companyId),
          eq(contacts.contactStatus, 'emailed')
        ));

      if (companyContacts.length === 1) { // This is the first
        await tx.update(companies)
          .set({
            companyStatus: 'contacted',
            lastContactedAt: new Date()
          })
          .where(eq(companies.id, data.companyId));
      }

      return activity;
    });
  }

  /**
   * Update contact status (emailed, skipped, etc)
   */
  async updateContactStatus(userId: number, update: ContactStatusUpdate): Promise<Contact> {
    const updateData: any = {
      contactStatus: update.status
    };

    if (update.status === 'emailed') {
      updateData.lastEmailedAt = new Date();
      updateData.emailCount = sql`${contacts.emailCount} + 1`;
      
      // Also track email activity if provided
      if (update.emailActivity) {
        await this.trackEmailActivity(userId, update.emailActivity);
      }
    } else if (update.status === 'skipped') {
      updateData.skippedAt = new Date();
    }

    const [updated] = await db.update(contacts)
      .set(updateData)
      .where(and(
        eq(contacts.id, update.contactId),
        eq(contacts.userId, userId)
      ))
      .returning();

    return updated;
  }

  /**
   * Skip a company with reason
   */
  async skipCompany(userId: number, data: CompanySkipData): Promise<Company> {
    const updateData: any = {
      companyStatus: 'skipped',
      skipReason: data.reason,
      skippedAt: new Date()
    };

    if (data.reason === 'not_now' && data.skipUntilDate) {
      updateData.skipUntilDate = data.skipUntilDate;
    }

    // Also mark all uncontacted contacts from this company as skipped
    await db.update(contacts)
      .set({
        contactStatus: 'skipped',
        skippedAt: new Date()
      })
      .where(and(
        eq(contacts.companyId, data.companyId),
        eq(contacts.contactStatus, 'uncontacted'),
        eq(contacts.userId, userId)
      ));

    const [updated] = await db.update(companies)
      .set(updateData)
      .where(and(
        eq(companies.id, data.companyId),
        eq(companies.userId, userId)
      ))
      .returning();

    return updated;
  }

  /**
   * Get available contacts for outreach
   */
  async getAvailableContacts(
    userId: number, 
    limit: number = 5
  ): Promise<AvailableContactsResult> {
    // Get contacts that are:
    // 1. Uncontacted
    // 2. Have email addresses
    // 3. From companies that aren't skipped (or skip has expired)
    const now = new Date();

    const availableContacts = await db.select({
      contact: contacts,
      company: companies
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(
      eq(contacts.userId, userId),
      eq(contacts.contactStatus, 'uncontacted'),
      sql`${contacts.email} IS NOT NULL AND ${contacts.email} != ''`,
      or(
        ne(companies.companyStatus, 'skipped'),
        and(
          eq(companies.companyStatus, 'skipped'),
          eq(companies.skipReason, 'not_now'),
          lt(companies.skipUntilDate, now)
        )
      )
    ))
    .limit(limit * 2); // Get more to allow for filtering

    // Transform and limit results
    const contactsWithCompany: ContactWithCompany[] = availableContacts
      .slice(0, limit)
      .map(row => ({
        id: row.contact.id,
        name: row.contact.name,
        email: row.contact.email!,
        role: row.contact.role || undefined,
        companyId: row.company.id,
        companyName: row.company.name,
        companyDescription: row.company.description || undefined,
        companyWebsite: row.company.website || undefined,
        contactStatus: row.contact.contactStatus || 'uncontacted',
        lastEmailedAt: row.contact.lastEmailedAt || undefined,
        emailCount: row.contact.emailCount || 0
      }));

    const totalAvailable = availableContacts.length;
    const needsMoreContacts = totalAvailable < 10; // Warn when running low

    let suggestedSearchPrompts: string[] | undefined;
    if (needsMoreContacts) {
      // Get user's recent search prompts for suggestions
      suggestedSearchPrompts = await this.getSuggestedSearchPrompts(userId);
    }

    return {
      contacts: contactsWithCompany,
      totalAvailable,
      needsMoreContacts,
      suggestedSearchPrompts
    };
  }

  /**
   * Create a daily outreach batch
   */
  async createOutreachBatch(data: OutreachBatchData): Promise<string> {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    await db.insert(dailyOutreachBatches).values({
      userId: data.userId,
      token,
      contacts: data.contactIds,
      emails: data.emails,
      status: 'pending',
      scheduledFor: data.scheduledFor,
      expiresAt: data.expiresAt
    });

    return token;
  }

  /**
   * Get batch by token
   */
  async getBatchByToken(token: string) {
    const [batch] = await db.select()
      .from(dailyOutreachBatches)
      .where(eq(dailyOutreachBatches.token, token))
      .limit(1);

    return batch;
  }

  /**
   * Update batch status
   */
  async updateBatchStatus(
    token: string, 
    contactId: number,
    action: 'emailed' | 'skipped'
  ) {
    const batch = await this.getBatchByToken(token);
    if (!batch) return null;

    const updateData: any = {};
    
    if (action === 'emailed') {
      updateData.contactsEmailed = [...(batch.contactsEmailed as number[] || []), contactId];
    } else {
      updateData.contactsSkipped = [...(batch.contactsSkipped as number[] || []), contactId];
    }

    // Check if batch is complete
    const totalProcessed = 
      (updateData.contactsEmailed?.length || batch.contactsEmailed?.length || 0) +
      (updateData.contactsSkipped?.length || batch.contactsSkipped?.length || 0);
    
    if (totalProcessed >= (batch.contacts as number[]).length) {
      updateData.status = 'completed';
    } else if (totalProcessed > 0) {
      updateData.status = 'partial';
    }

    await db.update(dailyOutreachBatches)
      .set(updateData)
      .where(eq(dailyOutreachBatches.token, token));

    return true;
  }

  /**
   * Get user outreach preferences
   */
  async getUserPreferences(userId: number): Promise<OutreachPreferences | null> {
    const [prefs] = await db.select()
      .from(userOutreachPreferences)
      .where(eq(userOutreachPreferences.userId, userId))
      .limit(1);

    if (!prefs) return null;

    return {
      enabled: prefs.enabled || false,
      schedule: prefs.schedule as { days: string[], time: string },
      timezone: prefs.timezone || 'America/New_York',
      emailsPerBatch: prefs.emailsPerBatch || 5,
      includeSearchPrompts: prefs.includeSearchPrompts || true,
      sendUrgentReminders: prefs.sendUrgentReminders || true
    };
  }

  /**
   * Update user outreach preferences
   */
  async updateUserPreferences(
    userId: number, 
    preferences: Partial<OutreachPreferences>
  ): Promise<OutreachPreferences> {
    const existing = await this.getUserPreferences(userId);
    
    if (existing) {
      // Update existing
      await db.update(userOutreachPreferences)
        .set({
          ...preferences,
          updatedAt: new Date()
        })
        .where(eq(userOutreachPreferences.userId, userId));
    } else {
      // Create new
      await db.insert(userOutreachPreferences).values({
        userId,
        ...preferences
      });
    }

    const updated = await this.getUserPreferences(userId);
    return updated!;
  }

  /**
   * Get suggested search prompts based on user's history
   */
  private async getSuggestedSearchPrompts(userId: number): Promise<string[]> {
    // Get user's strategic profile for context
    const strategicProfiles = await db.query.strategicProfiles.findMany({
      where: (profiles, { eq }) => eq(profiles.userId, userId),
      orderBy: (profiles, { desc }) => [desc(profiles.createdAt)],
      limit: 1
    });

    const suggestions: string[] = [];
    
    if (strategicProfiles.length > 0) {
      const profile = strategicProfiles[0];
      
      // Use daily search queries from strategy if available
      if (profile.dailySearchQueries) {
        try {
          const queries = JSON.parse(profile.dailySearchQueries);
          if (Array.isArray(queries)) {
            suggestions.push(...queries.slice(0, 3));
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Add variation based on target customers
      if (profile.targetCustomers && suggestions.length < 3) {
        suggestions.push(`${profile.targetCustomers} in your area`);
      }
    }

    // Add generic suggestions if needed
    while (suggestions.length < 3) {
      const generic = [
        'B2B software companies in tech hubs',
        'Small businesses needing digital transformation',
        'Growing startups with 10-50 employees'
      ];
      suggestions.push(generic[suggestions.length]);
    }

    return suggestions.slice(0, 3);
  }
}

export const outreachService = new OutreachService();