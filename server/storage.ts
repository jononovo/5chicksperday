import { 
  userPreferences, lists, companies, contacts, emailTemplates, users,
  strategicProfiles, userEmailPreferences,
  contactOutreachStatus, outreachTokens, dailyOutreachPreferences, outreachQueue,
  type UserPreferences, type InsertUserPreferences,
  type UserEmailPreferences, type InsertUserEmailPreferences,
  type List, type InsertList,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type EmailTemplate, type InsertEmailTemplate,
  type User, type InsertUser,
  type StrategicProfile, type InsertStrategicProfile,
  type ContactOutreachStatus, type InsertContactOutreachStatus,
  type OutreachToken, type InsertOutreachToken,
  type DailyOutreachPreferences, type InsertDailyOutreachPreferences,
  type OutreachQueue, type InsertOutreachQueue
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, sql, desc } from "drizzle-orm";

export interface IStorage {
  // User Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string }): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;

  // User Preferences
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  initializeUserPreferences(userId: number): Promise<UserPreferences>;

  // Lists
  listLists(userId: number): Promise<List[]>;
  getList(listId: number, userId: number): Promise<List | undefined>;
  listCompaniesByList(listId: number, userId: number): Promise<Company[]>;
  getNextListId(): Promise<number>;
  createList(data: InsertList): Promise<List>;
  updateCompanyList(companyId: number, listId: number): Promise<void>;

  // Companies
  listCompanies(userId: number): Promise<Company[]>;
  getCompany(id: number, userId: number): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined>;

  // Contacts
  listContactsByCompany(companyId: number, userId: number): Promise<Contact[]>;
  listContacts(userId: number): Promise<Contact[]>;
  getContact(id: number, userId: number): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact>;
  deleteContactsByCompany(companyId: number, userId: number): Promise<void>;

  // Email Conversations (inactive - commented out)
  // listActiveContactsWithThreads(userId: number): Promise<(Contact & { lastMessage: string, lastMessageDate: Date, unread: boolean })[]>;
  // listThreadsByContact(contactId: number, userId: number): Promise<EmailThread[]>;
  // getThread(id: number, userId: number): Promise<EmailThread | undefined>;
  // createThread(data: InsertEmailThread): Promise<EmailThread>;
  // updateThread(id: number, data: Partial<EmailThread>): Promise<EmailThread>;
  // listMessagesByThread(threadId: number): Promise<EmailMessage[]>;
  // getThreadMessage(id: number): Promise<EmailMessage | undefined>;
  // createMessage(data: InsertEmailMessage): Promise<EmailMessage>;
  // markThreadMessagesAsRead(threadId: number): Promise<void>;
  

  // Email Templates
  listEmailTemplates(userId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate>;

  // User Email Preferences
  getUserEmailPreferences(userId: number): Promise<UserEmailPreferences | undefined>;
  createUserEmailPreferences(data: InsertUserEmailPreferences): Promise<UserEmailPreferences>;
  updateUserEmailPreferences(userId: number, data: Partial<UserEmailPreferences>): Promise<UserEmailPreferences | undefined>;

  // Strategic Profiles
  getStrategicProfiles(userId: number): Promise<StrategicProfile[]>;
  createStrategicProfile(data: InsertStrategicProfile): Promise<StrategicProfile>;
  updateStrategicProfile(id: number, data: Partial<StrategicProfile>): Promise<StrategicProfile>;
  deleteStrategicProfile(id: number): Promise<void>;

  // Daily Outreach
  getContactOutreachStatus(contactId: number, userId: number): Promise<ContactOutreachStatus | undefined>;
  createContactOutreachStatus(data: InsertContactOutreachStatus): Promise<ContactOutreachStatus>;
  updateContactOutreachStatus(id: number, data: Partial<ContactOutreachStatus>): Promise<ContactOutreachStatus>;
  getUncontactedContacts(userId: number, limit: number): Promise<Contact[]>;
  
  // Outreach Tokens
  createOutreachToken(data: InsertOutreachToken): Promise<OutreachToken>;
  getOutreachToken(token: string): Promise<OutreachToken | undefined>;
  markTokenUsed(token: string): Promise<void>;
  
  // Daily Outreach Preferences
  getDailyOutreachPreferences(userId: number): Promise<DailyOutreachPreferences | undefined>;
  createDailyOutreachPreferences(data: InsertDailyOutreachPreferences): Promise<DailyOutreachPreferences>;
  updateDailyOutreachPreferences(userId: number, data: Partial<DailyOutreachPreferences>): Promise<DailyOutreachPreferences>;
  
  // Outreach Queue
  getOutreachQueue(userId: number, limit: number): Promise<OutreachQueue[]>;
  addToOutreachQueue(data: InsertOutreachQueue): Promise<OutreachQueue>;
  removeFromOutreachQueue(id: number): Promise<void>;
  getQueuedContact(userId: number, contactId: number): Promise<OutreachQueue | undefined>;
}

class DatabaseStorage implements IStorage {
  // User Auth methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(data: { email: string; password: string; username?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        username: data.username || data.email.split('@')[0],
        password: data.password
      })
      .returning();

    await this.initializeUserPreferences(user.id);

    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // User Preferences
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (!prefs) {
      return this.initializeUserPreferences(userId);
    }

    return prefs;
  }

  async updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (existing) {
      const [updated] = await db
        .update(userPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userPreferences.userId, userId))
        .returning();
      return updated;
    }

    return this.initializeUserPreferences(userId);
  }

  async initializeUserPreferences(userId: number): Promise<UserPreferences> {
    console.log('DatabaseStorage.initializeUserPreferences - Creating preferences for userId:', userId);
    const [prefs] = await db
      .insert(userPreferences)
      .values({ userId })
      .returning();

    return prefs;
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    return db.select().from(lists).where(eq(lists.userId, userId)).orderBy(desc(lists.createdAt));
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    const [list] = await db
      .select()
      .from(lists)
      .where(and(eq(lists.listId, listId), eq(lists.userId, userId)));
    return list;
  }

  async listCompaniesByList(listId: number, userId: number): Promise<Company[]> {
    return db.select()
      .from(companies)
      .where(and(eq(companies.listId, listId), eq(companies.userId, userId)));
  }

  async getNextListId(): Promise<number> {
    const allLists = await db.select().from(lists);
    let maxId = 1000;
    
    for (const list of allLists) {
      if (list.listId > maxId) {
        maxId = list.listId;
      }
    }
    
    return maxId + 1;
  }

  async createList(data: InsertList): Promise<List> {
    const [list] = await db.insert(lists).values(data).returning();
    return list;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    await db.update(companies)
      .set({ listId })
      .where(eq(companies.id, companyId));
  }

  async updateList(listId: number, data: Partial<InsertList>, userId: number): Promise<List | undefined> {
    const [updated] = await db.update(lists)
      .set(data)
      .where(and(eq(lists.listId, listId), eq(lists.userId, userId)))
      .returning();
    return updated;
  }

  // Companies
  async listCompanies(userId: number): Promise<Company[]> {
    console.log('DatabaseStorage.listCompanies - Fetching companies for userId:', userId);
    return db.select().from(companies).where(eq(companies.userId, userId));
  }

  async getCompany(id: number, userId: number): Promise<Company | undefined> {
    console.log('DatabaseStorage.getCompany - Fetching company:', { id, userId });
    try {
      const result = await db
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), eq(companies.userId, userId)))
        .limit(1);

      console.log('DatabaseStorage.getCompany - Result:', {
        requested: { id, userId },
        found: result[0] ? { id: result[0].id, name: result[0].name } : null
      });

      return result[0];
    } catch (error) {
      console.error('Error fetching company:', error);
      return undefined;
    }
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(data as any).returning();
    return company;
  }

  async updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set(data)
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  // Contacts
  async listContactsByCompany(companyId: number, userId: number): Promise<Contact[]> {
    try {
      return await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.companyId, companyId), eq(contacts.userId, userId)));
    } catch (error) {
      console.error('Error fetching contacts by company:', error);
      return [];
    }
  }

  async listContacts(userId: number): Promise<Contact[]> {
    try {
      return await db
        .select()
        .from(contacts)
        .where(eq(contacts.userId, userId));
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return [];
    }
  }

  async getContact(id: number, userId: number): Promise<Contact | undefined> {
    console.log('DatabaseStorage.getContact - Fetching contact:', { id, userId });
    try {
      const result = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
        .limit(1);

      console.log('DatabaseStorage.getContact - Result:', {
        requested: { id, userId },
        found: result[0] ? { id: result[0].id, name: result[0].name } : null
      });

      return result[0];
    } catch (error) {
      console.error('Error fetching contact:', error);
      return undefined;
    }
  }

  async createContact(data: InsertContact): Promise<Contact> {
    // Clean contact data to prevent duplicate emails
    const { cleanContactData } = await import('./lib/email-utils');
    const cleanedData = cleanContactData(data);
    
    const [contact] = await db.insert(contacts).values(cleanedData as any).returning();
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    // Clean contact data to prevent duplicate emails
    const { cleanContactData } = await import('./lib/email-utils');
    const cleanedData = cleanContactData(data);
    
    // Remove id field to prevent PostgreSQL error "column 'id' can only be updated to DEFAULT"
    const { id: _, ...updateData } = cleanedData;
    
    const [updated] = await db.update(contacts)
      .set(updateData)
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContactsByCompany(companyId: number, userId: number): Promise<void> {
    await db.delete(contacts)
      .where(and(eq(contacts.companyId, companyId), eq(contacts.userId, userId)));
  }


  // Email Templates
  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    console.log('DatabaseStorage.listEmailTemplates called for userId:', userId);
    
    // If this is not userId=1, get both the default templates and the user's templates
    if (userId !== 1) {
      console.log(`Fetching both default templates (userId=1) and user templates (userId=${userId})`);
      return db
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
    return db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.userId, userId))
      .orderBy(emailTemplates.createdAt);
  }

  async getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined> {
    console.log('DatabaseStorage.getEmailTemplate called with:', { id, userId });
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return template;
  }

  async createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate> {
    console.log('DatabaseStorage.createEmailTemplate called with:', {
      name: data.name,
      userId: data.userId
    });
    try {
      const [template] = await db
        .insert(emailTemplates)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      console.log('Created template:', { id: template.id, name: template.name });
      return template;
    } catch (error) {
      console.error('Error creating email template:', error);
      throw error;
    }
  }

  async updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate> {
    console.log('DatabaseStorage.updateEmailTemplate called with:', {
      id,
      name: data.name,
      userId: data.userId
    });
    try {
      const [template] = await db
        .update(emailTemplates)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(emailTemplates.id, id))
        .returning();
      
      if (!template) {
        throw new Error(`Template with id ${id} not found`);
      }
      
      console.log('Updated template:', { id: template.id, name: template.name });
      return template;
    } catch (error) {
      console.error('Error updating email template:', error);
      throw error;
    }
  }

  // User Email Preferences methods
  async getUserEmailPreferences(userId: number): Promise<UserEmailPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userEmailPreferences)
      .where(eq(userEmailPreferences.userId, userId));
    return prefs;
  }

  async createUserEmailPreferences(data: InsertUserEmailPreferences): Promise<UserEmailPreferences> {
    const [prefs] = await db
      .insert(userEmailPreferences)
      .values(data)
      .returning();
    return prefs;
  }

  async updateUserEmailPreferences(userId: number, data: Partial<UserEmailPreferences>): Promise<UserEmailPreferences | undefined> {
    const [prefs] = await db
      .update(userEmailPreferences)
      .set(data)
      .where(eq(userEmailPreferences.userId, userId))
      .returning();
    return prefs;
  }

  // Strategic Profiles methods
  async getStrategicProfiles(userId: number): Promise<StrategicProfile[]> {
    return await db
      .select()
      .from(strategicProfiles)
      .where(eq(strategicProfiles.userId, userId));
  }

  async createStrategicProfile(data: InsertStrategicProfile): Promise<StrategicProfile> {
    const [profile] = await db
      .insert(strategicProfiles)
      .values(data)
      .returning();
    return profile;
  }

  async updateStrategicProfile(id: number, data: Partial<StrategicProfile>): Promise<StrategicProfile> {
    const [profile] = await db
      .update(strategicProfiles)
      .set(data)
      .where(eq(strategicProfiles.id, id))
      .returning();
    return profile;
  }

  async deleteStrategicProfile(id: number): Promise<void> {
    await db
      .delete(strategicProfiles)
      .where(eq(strategicProfiles.id, id));
  }

  // Daily Outreach methods
  async getContactOutreachStatus(contactId: number, userId: number): Promise<ContactOutreachStatus | undefined> {
    const [status] = await db
      .select()
      .from(contactOutreachStatus)
      .where(and(
        eq(contactOutreachStatus.contactId, contactId),
        eq(contactOutreachStatus.userId, userId)
      ));
    return status;
  }

  async createContactOutreachStatus(data: InsertContactOutreachStatus): Promise<ContactOutreachStatus> {
    const [status] = await db
      .insert(contactOutreachStatus)
      .values(data)
      .returning();
    return status;
  }

  async updateContactOutreachStatus(id: number, data: Partial<ContactOutreachStatus>): Promise<ContactOutreachStatus> {
    const [status] = await db
      .update(contactOutreachStatus)
      .set(data)
      .where(eq(contactOutreachStatus.id, id))
      .returning();
    return status;
  }

  async getUncontactedContacts(userId: number, limit: number): Promise<Contact[]> {
    // Get contacts with emails that haven't been contacted yet
    const contactedIds = await db
      .select({ contactId: contactOutreachStatus.contactId })
      .from(contactOutreachStatus)
      .where(and(
        eq(contactOutreachStatus.userId, userId),
        or(
          eq(contactOutreachStatus.status, 'sent'),
          eq(contactOutreachStatus.status, 'skipped')
        )
      ));
    
    const contactedIdList = contactedIds.map(c => c.contactId);
    
    if (contactedIdList.length > 0) {
      return await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.userId, userId),
          sql`${contacts.email} IS NOT NULL`,
          sql`${contacts.id} NOT IN (${sql.join(contactedIdList.map(id => sql`${id}`), sql`, `)})`
        ))
        .orderBy(desc(contacts.probability))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.userId, userId),
        sql`${contacts.email} IS NOT NULL`
      ))
      .orderBy(desc(contacts.probability))
      .limit(limit);
  }

  // Outreach Token methods
  async createOutreachToken(data: InsertOutreachToken): Promise<OutreachToken> {
    const [token] = await db
      .insert(outreachTokens)
      .values({
        ...data,
        expiresAt: new Date(data.expiresAt) // Convert string to Date
      })
      .returning();
    return token;
  }

  async getOutreachToken(token: string): Promise<OutreachToken | undefined> {
    const [outreachToken] = await db
      .select()
      .from(outreachTokens)
      .where(eq(outreachTokens.token, token));
    return outreachToken;
  }

  async markTokenUsed(token: string): Promise<void> {
    await db
      .update(outreachTokens)
      .set({ usedAt: new Date() })
      .where(eq(outreachTokens.token, token));
  }

  // Daily Outreach Preferences methods
  async getDailyOutreachPreferences(userId: number): Promise<DailyOutreachPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(dailyOutreachPreferences)
      .where(eq(dailyOutreachPreferences.userId, userId));
    return prefs;
  }

  async createDailyOutreachPreferences(data: InsertDailyOutreachPreferences): Promise<DailyOutreachPreferences> {
    const [prefs] = await db
      .insert(dailyOutreachPreferences)
      .values(data)
      .returning();
    return prefs;
  }

  async updateDailyOutreachPreferences(userId: number, data: Partial<DailyOutreachPreferences>): Promise<DailyOutreachPreferences> {
    const [prefs] = await db
      .update(dailyOutreachPreferences)
      .set(data)
      .where(eq(dailyOutreachPreferences.userId, userId))
      .returning();
    return prefs;
  }

  // Outreach Queue methods
  async getOutreachQueue(userId: number, limit: number): Promise<OutreachQueue[]> {
    return await db
      .select()
      .from(outreachQueue)
      .where(eq(outreachQueue.userId, userId))
      .orderBy(desc(outreachQueue.priority))
      .limit(limit);
  }

  async addToOutreachQueue(data: InsertOutreachQueue): Promise<OutreachQueue> {
    const [item] = await db
      .insert(outreachQueue)
      .values({
        ...data,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined
      })
      .returning();
    return item;
  }

  async removeFromOutreachQueue(id: number): Promise<void> {
    await db
      .delete(outreachQueue)
      .where(eq(outreachQueue.id, id));
  }

  async getQueuedContact(userId: number, contactId: number): Promise<OutreachQueue | undefined> {
    const [item] = await db
      .select()
      .from(outreachQueue)
      .where(and(
        eq(outreachQueue.userId, userId),
        eq(outreachQueue.contactId, contactId)
      ));
    return item;
  }
}

export const storage = new DatabaseStorage();