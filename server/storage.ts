import { 
  userPreferences, lists, companies, contacts, emailTemplates, users,
  strategicProfiles, userEmailPreferences,
  senderProfiles, customerProfiles, searchJobs,
  type UserPreferences, type InsertUserPreferences,
  type UserEmailPreferences, type InsertUserEmailPreferences,
  type List, type InsertList,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type EmailTemplate, type InsertEmailTemplate,
  type User, type InsertUser,
  type StrategicProfile, type InsertStrategicProfile,
  type SenderProfile, type InsertSenderProfile,
  type TargetCustomerProfile, type InsertTargetCustomerProfile,
  type SearchJob, type InsertSearchJob
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, sql, desc, lt } from "drizzle-orm";

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

  // Sender Profiles
  listSenderProfiles(userId: number): Promise<SenderProfile[]>;
  getSenderProfile(id: number, userId: number): Promise<SenderProfile | undefined>;
  createSenderProfile(data: InsertSenderProfile): Promise<SenderProfile>;
  updateSenderProfile(id: number, data: Partial<SenderProfile>): Promise<SenderProfile>;
  deleteSenderProfile(id: number, userId: number): Promise<void>;

  // Customer Profiles
  listCustomerProfiles(userId: number): Promise<TargetCustomerProfile[]>;
  getCustomerProfile(id: number, userId: number): Promise<TargetCustomerProfile | undefined>;
  createCustomerProfile(data: InsertTargetCustomerProfile): Promise<TargetCustomerProfile>;
  updateCustomerProfile(id: number, data: Partial<TargetCustomerProfile>): Promise<TargetCustomerProfile>;
  deleteCustomerProfile(id: number, userId: number): Promise<void>;

  // Search Jobs
  createSearchJob(data: InsertSearchJob): Promise<SearchJob>;
  getSearchJobByJobId(jobId: string): Promise<SearchJob | undefined>;
  updateSearchJob(id: number, data: Partial<SearchJob>): Promise<SearchJob | undefined>;
  listSearchJobs(userId: number, limit?: number): Promise<SearchJob[]>;
  getPendingSearchJobs(limit?: number): Promise<SearchJob[]>;
  deleteOldSearchJobs(cutoffDate: Date): Promise<number>;
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

  // Sender Profiles
  async listSenderProfiles(userId: number): Promise<SenderProfile[]> {
    return db.select()
      .from(senderProfiles)
      .where(eq(senderProfiles.userId, userId))
      .orderBy(desc(senderProfiles.createdAt));
  }

  async getSenderProfile(id: number, userId: number): Promise<SenderProfile | undefined> {
    const [profile] = await db.select()
      .from(senderProfiles)
      .where(and(eq(senderProfiles.id, id), eq(senderProfiles.userId, userId)));
    return profile;
  }

  async createSenderProfile(data: InsertSenderProfile): Promise<SenderProfile> {
    const [profile] = await db.insert(senderProfiles).values(data).returning();
    return profile;
  }

  async updateSenderProfile(id: number, data: Partial<SenderProfile>): Promise<SenderProfile> {
    const [updated] = await db.update(senderProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(senderProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteSenderProfile(id: number, userId: number): Promise<void> {
    await db.delete(senderProfiles)
      .where(and(eq(senderProfiles.id, id), eq(senderProfiles.userId, userId)));
  }

  // Customer Profiles
  async listCustomerProfiles(userId: number): Promise<TargetCustomerProfile[]> {
    return db.select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, userId))
      .orderBy(desc(customerProfiles.createdAt));
  }

  async getCustomerProfile(id: number, userId: number): Promise<TargetCustomerProfile | undefined> {
    const [profile] = await db.select()
      .from(customerProfiles)
      .where(and(eq(customerProfiles.id, id), eq(customerProfiles.userId, userId)));
    return profile;
  }

  async createCustomerProfile(data: InsertTargetCustomerProfile): Promise<TargetCustomerProfile> {
    const [profile] = await db.insert(customerProfiles).values(data).returning();
    return profile;
  }

  async updateCustomerProfile(id: number, data: Partial<TargetCustomerProfile>): Promise<TargetCustomerProfile> {
    const [updated] = await db.update(customerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customerProfiles.id, id))
      .returning();
    return updated;
  }

  async deleteCustomerProfile(id: number, userId: number): Promise<void> {
    await db.delete(customerProfiles)
      .where(and(eq(customerProfiles.id, id), eq(customerProfiles.userId, userId)));
  }

  // Search Jobs
  async createSearchJob(data: InsertSearchJob): Promise<SearchJob> {
    const [job] = await db.insert(searchJobs).values(data as any).returning();
    return job;
  }

  async getSearchJobByJobId(jobId: string): Promise<SearchJob | undefined> {
    const [job] = await db.select()
      .from(searchJobs)
      .where(eq(searchJobs.jobId, jobId));
    return job;
  }

  async updateSearchJob(id: number, data: Partial<SearchJob>): Promise<SearchJob | undefined> {
    const [updated] = await db.update(searchJobs)
      .set(data)
      .where(eq(searchJobs.id, id))
      .returning();
    return updated;
  }

  async listSearchJobs(userId: number, limit: number = 10): Promise<SearchJob[]> {
    return db.select()
      .from(searchJobs)
      .where(eq(searchJobs.userId, userId))
      .orderBy(desc(searchJobs.createdAt))
      .limit(limit);
  }

  async getPendingSearchJobs(limit: number = 1): Promise<SearchJob[]> {
    return db.select()
      .from(searchJobs)
      .where(eq(searchJobs.status, 'pending'))
      .orderBy(desc(searchJobs.priority), searchJobs.createdAt)
      .limit(limit);
  }

  async getStuckProcessingJobs(cutoffTime: Date): Promise<SearchJob[]> {
    return db.select()
      .from(searchJobs)
      .where(and(
        eq(searchJobs.status, 'processing'),
        lt(searchJobs.startedAt, cutoffTime)
      ));
  }

  async getFailedJobsForRetry(): Promise<SearchJob[]> {
    return db.select()
      .from(searchJobs)
      .where(and(
        eq(searchJobs.status, 'failed'),
        sql`${searchJobs.retryCount} < ${searchJobs.maxRetries}`
      ))
      .orderBy(desc(searchJobs.priority), searchJobs.createdAt);
  }

  async deleteOldSearchJobs(cutoffDate: Date): Promise<number> {
    const result = await db.delete(searchJobs)
      .where(and(
        eq(searchJobs.status, 'completed'),
        sql`${searchJobs.completedAt} < ${cutoffDate}`
      ));
    
    // Return the number of deleted rows
    return (result as any).rowCount || 0;
  }
}

export const storage = new DatabaseStorage();