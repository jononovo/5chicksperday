import { PgDatabase } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import {
  type Contact,
  type InsertContact,
  contacts
} from '@shared/schema';

export class ContactStorage {
  constructor(private db: PgDatabase<any>) {}

  async getContact(id: number, userId: number): Promise<Contact | undefined> {
    console.log('ContactStorage.getContact called with:', { id, userId });
    try {
      const [contact] = await this.db
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .where(eq(contacts.userId, userId));

      console.log('ContactStorage.getContact result:', {
        requested: { id, userId },
        found: contact ? { id: contact.id, name: contact.name } : null
      });

      return contact;
    } catch (error) {
      console.error('Error in ContactStorage.getContact:', error);
      throw error;
    }
  }

  async listContactsByCompany(companyId: number): Promise<Contact[]> {
    return this.db
      .select()
      .from(contacts)
      .where(eq(contacts.companyId, companyId));
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await this.db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(
    id: number,
    updates: Partial<Contact>,
  ): Promise<Contact | undefined> {
    const [updated] = await this.db
      .update(contacts)
      .set({
        ...updates,
        lastEnriched: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContactsByCompany(companyId: number): Promise<void> {
    await this.db
      .delete(contacts)
      .where(eq(contacts.companyId, companyId));
  }

  async enrichContact(
    id: number,
    contactData: Partial<Contact>,
  ): Promise<Contact | undefined> {
    const [updated] = await this.db
      .update(contacts)
      .set({
        ...contactData,
        lastEnriched: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async updateContactConfidenceScore(
    id: number,
    score: number,
  ): Promise<Contact | undefined> {
    const [updated] = await this.db
      .update(contacts)
      .set({
        nameConfidenceScore: score,
        lastValidated: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async updateContactValidationStatus(
    id: number,
  ): Promise<Contact | undefined> {
    const contact = await this.getContact(id, 0); // Added userId 0 as a placeholder. Adjust as needed.
    if (!contact) return undefined;

    const aiScore = contact.nameConfidenceScore || 0;
    const userScore = contact.userFeedbackScore || 0;
    const feedbackCount = contact.feedbackCount || 0;

    const userWeight = Math.min(feedbackCount * 0.2, 0.8);
    const aiWeight = 1 - userWeight;

    const combinedScore = Math.round(
      aiScore * aiWeight + userScore * userWeight,
    );

    return this.updateContact(id, {
      probability: combinedScore,
    });
  }

  async updateContactWithAeroLeadsResult(
    id: number,
    result: { email: string | null; confidence: number }
  ): Promise<Contact | undefined> {
    if (!result.email) {
      const [updated] = await this.db
        .update(contacts)
        .set({
          completedSearches: sql`array_append(COALESCE(${contacts.completedSearches}, ARRAY[]::text[]), 'aeroleads_search')`
        })
        .where(eq(contacts.id, id))
        .returning();
      return updated;
    }

    const [updated] = await this.db
      .update(contacts)
      .set({
        email: result.email,
        // Use nameConfidenceScore since we don't have a separate email confidence column
        nameConfidenceScore: result.confidence,
        completedSearches: sql`array_append(COALESCE(${contacts.completedSearches}, ARRAY[]::text[]), 'aeroleads_search')`,
        lastValidated: new Date(),
      })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }
}