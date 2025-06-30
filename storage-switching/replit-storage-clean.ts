/**
 * Clean ReplitStorage implementation using only Replit Database
 * Simplified to avoid all PostgreSQL dependencies and schema mismatches
 */
import Database from '@replit/database';
import type { 
  User, InsertUser, List, InsertList, Company, InsertCompany,
  Contact, InsertContact, Campaign, InsertCampaign, CampaignList, 
  InsertCampaignList, EmailTemplate, InsertEmailTemplate,
  UserPreferences, InsertUserPreferences, ContactFeedback, InsertContactFeedback
} from "../shared/schema";

interface CleanIStorage {
  // User Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string }): Promise<User>;

  // User Preferences
  getUserPreferences(userId: number): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  initializeUserPreferences(userId: number): Promise<UserPreferences>;

  // Gmail Token methods
  setUserGmailTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void>;
  getUserGmailTokens(userId: number): Promise<{accessToken?: string, refreshToken?: string} | undefined>;
  clearUserGmailTokens(userId: number): Promise<void>;

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
  getContact(id: number, userId: number): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact>;
  deleteContactsByCompany(companyId: number, userId: number): Promise<void>;

  // Campaigns
  listCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number, userId: number): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign>;

  // Email Templates
  listEmailTemplates(userId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate>;
}

export class CleanReplitStorage implements CleanIStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  private async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.db.get(key);
      return result ? JSON.parse(result) : undefined;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return undefined;
    }
  }

  private async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.db.set(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  }

  private async delete(key: string): Promise<void> {
    try {
      await this.db.delete(key);
    } catch (error) {
      console.error(`Error deleting ${key}:`, error);
      throw error;
    }
  }

  private async list(prefix: string): Promise<string[]> {
    try {
      const keys = await this.db.list(prefix);
      return keys;
    } catch (error) {
      console.error(`Error listing ${prefix}:`, error);
      return [];
    }
  }

  private async getNextId(entity: string): Promise<number> {
    const counterKey = `counter:${entity}`;
    const currentId = await this.get<number>(counterKey) || 0;
    const nextId = currentId + 1;
    await this.set(counterKey, nextId);
    return nextId;
  }

  // User Auth
  async getUserByEmail(email: string): Promise<User | undefined> {
    const keys = await this.list('user:');
    for (const key of keys) {
      const user = await this.get<User>(key);
      if (user?.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.get<User>(`user:${id}`);
  }

  async createUser(data: { email: string; password: string; username?: string }): Promise<User> {
    const id = await this.getNextId('user');
    const user: User = {
      id,
      email: data.email,
      password: data.password,
      username: data.username || null,
      createdAt: new Date()
    };
    await this.set(`user:${id}`, user);
    return user;
  }

  // User Preferences
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    return this.get<UserPreferences>(`preferences:${userId}`);
  }

  async updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId) || { userId };
    const updated = { ...existing, ...data };
    await this.set(`preferences:${userId}`, updated);
    return updated as UserPreferences;
  }

  async initializeUserPreferences(userId: number): Promise<UserPreferences> {
    const prefs: UserPreferences = { userId };
    await this.set(`preferences:${userId}`, prefs);
    return prefs;
  }

  // Gmail Token methods
  async setUserGmailTokens(userId: number, accessToken: string, refreshToken?: string): Promise<void> {
    const tokens = { accessToken, refreshToken };
    await this.set(`gmail_tokens:${userId}`, tokens);
  }

  async getUserGmailTokens(userId: number): Promise<{accessToken?: string, refreshToken?: string} | undefined> {
    return this.get<{accessToken?: string, refreshToken?: string}>(`gmail_tokens:${userId}`);
  }

  async clearUserGmailTokens(userId: number): Promise<void> {
    await this.delete(`gmail_tokens:${userId}`);
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    const keys = await this.list('list:');
    const lists: List[] = [];
    for (const key of keys) {
      const list = await this.get<List>(key);
      if (list?.userId === userId) {
        lists.push(list);
      }
    }
    return lists;
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    const list = await this.get<List>(`list:${listId}`);
    return list?.userId === userId ? list : undefined;
  }

  async listCompaniesByList(listId: number, userId: number): Promise<Company[]> {
    const keys = await this.list('company:');
    const companies: Company[] = [];
    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company?.listId === listId) {
        companies.push(company);
      }
    }
    return companies;
  }

  async getNextListId(): Promise<number> {
    return this.getNextId('list');
  }

  async createList(data: InsertList): Promise<List> {
    const id = await this.getNextId('list');
    const list: List = {
      id,
      ...data,
      createdAt: new Date()
    };
    await this.set(`list:${id}`, list);
    return list;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    const company = await this.get<Company>(`company:${companyId}`);
    if (company) {
      company.listId = listId;
      await this.set(`company:${companyId}`, company);
    }
  }

  // Companies
  async listCompanies(userId: number): Promise<Company[]> {
    const keys = await this.list('company:');
    const companies: Company[] = [];
    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company) {
        companies.push(company);
      }
    }
    return companies;
  }

  async getCompany(id: number, userId: number): Promise<Company | undefined> {
    return this.get<Company>(`company:${id}`);
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const id = await this.getNextId('company');
    const company: Company = {
      id,
      ...data,
      createdAt: new Date()
    };
    await this.set(`company:${id}`, company);
    return company;
  }

  async updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined> {
    const existing = await this.get<Company>(`company:${id}`);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...data };
    await this.set(`company:${id}`, updated);
    return updated;
  }

  // Contacts
  async listContactsByCompany(companyId: number, userId: number): Promise<Contact[]> {
    const keys = await this.list('contact:');
    const contacts: Contact[] = [];
    for (const key of keys) {
      const contact = await this.get<Contact>(key);
      if (contact?.companyId === companyId) {
        contacts.push(contact);
      }
    }
    return contacts;
  }

  async getContact(id: number, userId: number): Promise<Contact | undefined> {
    return this.get<Contact>(`contact:${id}`);
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const id = await this.getNextId('contact');
    const contact: Contact = {
      id,
      ...data,
      createdAt: new Date()
    };
    await this.set(`contact:${id}`, contact);
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    const existing = await this.get<Contact>(`contact:${id}`);
    if (!existing) throw new Error(`Contact ${id} not found`);
    
    const updated = { ...existing, ...data };
    await this.set(`contact:${id}`, updated);
    return updated;
  }

  async deleteContactsByCompany(companyId: number, userId: number): Promise<void> {
    const contacts = await this.listContactsByCompany(companyId, userId);
    for (const contact of contacts) {
      await this.delete(`contact:${contact.id}`);
    }
  }

  // Campaigns
  async listCampaigns(userId: number): Promise<Campaign[]> {
    const keys = await this.list('campaign:');
    const campaigns: Campaign[] = [];
    for (const key of keys) {
      const campaign = await this.get<Campaign>(key);
      if (campaign?.userId === userId) {
        campaigns.push(campaign);
      }
    }
    return campaigns;
  }

  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const campaign = await this.get<Campaign>(`campaign:${id}`);
    return campaign?.userId === userId ? campaign : undefined;
  }

  async getNextCampaignId(): Promise<number> {
    return this.getNextId('campaign');
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const id = await this.getNextId('campaign');
    const campaign: Campaign = {
      id,
      ...data,
      createdAt: new Date()
    };
    await this.set(`campaign:${id}`, campaign);
    return campaign;
  }

  async updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign> {
    const existing = await this.get<Campaign>(`campaign:${id}`);
    if (!existing || existing.userId !== userId) {
      throw new Error(`Campaign ${id} not found or access denied`);
    }
    
    const updated = { ...existing, ...data };
    await this.set(`campaign:${id}`, updated);
    return updated;
  }

  // Email Templates
  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    const keys = await this.list('template:');
    const templates: EmailTemplate[] = [];
    for (const key of keys) {
      const template = await this.get<EmailTemplate>(key);
      if (template?.userId === userId) {
        templates.push(template);
      }
    }
    return templates;
  }

  async getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined> {
    const template = await this.get<EmailTemplate>(`template:${id}`);
    return template?.userId === userId ? template : undefined;
  }

  async createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate> {
    const id = await this.getNextId('template');
    const template: EmailTemplate = {
      id,
      ...data,
      createdAt: new Date()
    };
    await this.set(`template:${id}`, template);
    return template;
  }

  async updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate> {
    const existing = await this.get<EmailTemplate>(`template:${id}`);
    if (!existing) throw new Error(`Template ${id} not found`);
    
    const updated = { ...existing, ...data };
    await this.set(`template:${id}`, updated);
    return updated;
  }

  // Stub method for compatibility - no longer needed with clean Replit DB only approach
  async initializeDefaultSearchApproaches(): Promise<void> {
    console.log('Search approaches initialization skipped - using simplified Replit DB storage');
  }
}

export const cleanStorage = new CleanReplitStorage();