/**
 * Clean ReplitStorage implementation for pure Replit DB usage
 * This replaces the corrupted simplified-storage-replit.ts file
 */

import Database from "@replit/database";
import type { IStorage } from "../server/storage";
import type {
  User, InsertUser,
  UserPreferences, InsertUserPreferences,
  List, InsertList,
  Company, InsertCompany,
  Contact, InsertContact,
  Campaign, InsertCampaign,
  CampaignList, InsertCampaignList,
  EmailTemplate, InsertEmailTemplate,
  ContactFeedback, InsertContactFeedback
} from "../shared/schema";

export class ReplitStorage implements IStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  private async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.db.get(key);
      if (!result || result.error) return undefined;
      return result ? JSON.parse(result as string) : undefined;
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return undefined;
    }
  }

  private async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.db.set(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  private async delete(key: string): Promise<void> {
    try {
      await this.db.delete(key);
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
    }
  }

  private async list(prefix: string): Promise<string[]> {
    try {
      const result = await this.db.list(prefix);
      if (result && !result.error && Array.isArray(result)) {
        return result as string[];
      }
      return [];
    } catch (error) {
      console.error(`Error listing keys with prefix ${prefix}:`, error);
      return [];
    }
  }

  private async getNextId(entity: string): Promise<number> {
    const key = `counter:${entity}`;
    const current = await this.get<number>(key) || 0;
    const next = current + 1;
    await this.set(key, next);
    return next;
  }

  // User methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = await this.get<number>(`index:user:email:${email}`);
    if (!userId) return undefined;
    return this.getUser(userId);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.getUser(id);
  }

  async createUser(data: { email: string; password: string; username?: string }): Promise<User> {
    const id = await this.getNextId('user');
    const now = new Date().toISOString();
    
    const user: User = {
      ...data,
      id,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    };

    await this.set(`user:${id}`, user);
    await this.set(`index:user:email:${data.email}`, id);
    
    if (data.username) {
      await this.set(`index:user:username:${data.username}`, id);
    }

    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.get<User>(`user:${id}`);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userId = await this.get<number>(`index:user:username:${username}`);
    if (!userId) return undefined;
    return this.getUser(userId);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() };
    await this.set(`user:${id}`, updatedUser);
    
    return updatedUser;
  }

  // User Preferences
  async getUserPreferences(userId: number): Promise<UserPreferences | undefined> {
    return this.get<UserPreferences>(`userPrefs:${userId}`);
  }

  async updateUserPreferences(userId: number, data: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);
    const now = new Date().toISOString();
    
    const preferences: UserPreferences = {
      id: existing?.id || await this.getNextId('userPrefs'),
      userId,
      ...existing,
      ...data,
      updatedAt: now
    };

    await this.set(`userPrefs:${userId}`, preferences);
    return preferences;
  }

  async initializeUserPreferences(userId: number): Promise<UserPreferences> {
    const now = new Date().toISOString();
    const preferences: UserPreferences = {
      id: await this.getNextId('userPrefs'),
      userId,
      createdAt: now,
      updatedAt: now
    };

    await this.set(`userPrefs:${userId}`, preferences);
    return preferences;
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    const listIds = await this.get<number[]>(`lists:user:${userId}`) || [];
    const lists: List[] = [];
    
    for (const id of listIds) {
      const list = await this.get<List>(`list:${id}`);
      if (list) lists.push(list);
    }
    
    return lists;
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    const list = await this.get<List>(`list:${listId}`);
    if (!list || list.userId !== userId) return undefined;
    return list;
  }

  async listCompaniesByList(listId: number, userId?: number): Promise<Company[]> {
    const companyIds = await this.get<number[]>(`companies:list:${listId}`) || [];
    const companies: Company[] = [];
    
    for (const id of companyIds) {
      const company = await this.get<Company>(`company:${id}`);
      if (company && (!userId || company.userId === userId)) {
        companies.push(company);
      }
    }
    
    return companies;
  }

  async getNextListId(): Promise<number> {
    return (await this.getNextId('listSequence')) + 1000;
  }

  async createList(data: InsertList & { userId: number }): Promise<List> {
    const id = await this.getNextId('list');
    const listId = await this.getNextListId();
    const now = new Date().toISOString();
    
    const list: List = {
      ...data,
      id,
      listId,
      createdAt: now,
      updatedAt: now
    };

    await this.set(`list:${id}`, list);
    
    // Add to user's lists
    const userLists = await this.get<number[]>(`lists:user:${data.userId}`) || [];
    userLists.push(id);
    await this.set(`lists:user:${data.userId}`, userLists);

    return list;
  }

  async updateList(listId: number, data: Partial<InsertList>, userId: number): Promise<List | undefined> {
    const list = await this.getList(listId, userId);
    if (!list) return undefined;

    const updatedList = { ...list, ...data, updatedAt: new Date().toISOString() };
    await this.set(`list:${listId}`, updatedList);
    
    return updatedList;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<Company | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) return undefined;

    const updatedCompany = { ...company, listId };
    await this.set(`company:${companyId}`, updatedCompany);

    // Update list associations
    const listCompanies = await this.get<number[]>(`companies:list:${listId}`) || [];
    if (!listCompanies.includes(companyId)) {
      listCompanies.push(companyId);
      await this.set(`companies:list:${listId}`, listCompanies);
    }

    return updatedCompany;
  }

  // Companies
  async listCompanies(): Promise<Company[]> {
    const keys = await this.list('company:');
    const companies: Company[] = [];
    
    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company) companies.push(company);
    }
    
    return companies;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    return this.get<Company>(`company:${id}`);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const id = await this.getNextId('company');
    const now = new Date().toISOString();
    
    const newCompany: Company = {
      ...company,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.set(`company:${id}`, newCompany);

    // Add to user's companies
    const userCompanies = await this.get<number[]>(`companies:user:${company.userId}`) || [];
    userCompanies.push(id);
    await this.set(`companies:user:${company.userId}`, userCompanies);

    // Add to list's companies if listId exists
    if (company.listId) {
      const listCompanies = await this.get<number[]>(`companies:list:${company.listId}`) || [];
      listCompanies.push(id);
      await this.set(`companies:list:${company.listId}`, listCompanies);
    }

    return newCompany;
  }

  async updateCompany(id: number, updates: Partial<Company>): Promise<Company | undefined> {
    const company = await this.getCompany(id);
    if (!company) return undefined;

    const updatedCompany = { ...company, ...updates, updatedAt: new Date().toISOString() };
    await this.set(`company:${id}`, updatedCompany);
    
    return updatedCompany;
  }

  // Contacts
  async listContactsByCompany(companyId: number): Promise<Contact[]> {
    const contactIds = await this.get<number[]>(`contacts:company:${companyId}`) || [];
    const contacts: Contact[] = [];
    
    for (const id of contactIds) {
      const contact = await this.get<Contact>(`contact:${id}`);
      if (contact) contacts.push(contact);
    }
    
    return contacts;
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return this.get<Contact>(`contact:${id}`);
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const id = await this.getNextId('contact');
    const now = new Date().toISOString();
    
    const newContact: Contact = {
      ...contact,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.set(`contact:${id}`, newContact);

    // Add to company's contacts
    const companyContacts = await this.get<number[]>(`contacts:company:${contact.companyId}`) || [];
    companyContacts.push(id);
    await this.set(`contacts:company:${contact.companyId}`, companyContacts);

    return newContact;
  }

  async updateContact(id: number, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = await this.getContact(id);
    if (!contact) return undefined;

    const updatedContact = { ...contact, ...updates, updatedAt: new Date().toISOString() };
    await this.set(`contact:${id}`, updatedContact);
    
    return updatedContact;
  }

  async deleteContactsByCompany(companyId: number): Promise<void> {
    const contactIds = await this.get<number[]>(`contacts:company:${companyId}`) || [];
    
    for (const id of contactIds) {
      await this.delete(`contact:${id}`);
    }
    
    await this.delete(`contacts:company:${companyId}`);
  }

  // Stub implementations for additional methods to satisfy IStorage interface
  async getSearchApproach(): Promise<any> { return undefined; }
  async listSearchApproaches(): Promise<any[]> { return []; }
  async createSearchApproach(): Promise<any> { return {}; }
  async updateSearchApproach(): Promise<any> { return undefined; }
  async initializeDefaultSearchApproaches(): Promise<void> {}

  async getCampaign(): Promise<any> { return undefined; }
  async listCampaigns(): Promise<any[]> { return []; }
  async createCampaign(): Promise<any> { return {}; }
  async updateCampaign(): Promise<any> { return undefined; }
  async getNextCampaignId(): Promise<number> { return 1; }

  async addListToCampaign(): Promise<any> { return {}; }
  async removeListFromCampaign(): Promise<void> {}
  async getListsByCampaign(): Promise<any[]> { return []; }
  async updateCampaignTotalCompanies(): Promise<void> {}

  async getEmailTemplate(): Promise<any> { return undefined; }
  async listEmailTemplates(): Promise<any[]> { return []; }
  async createEmailTemplate(): Promise<any> { return {}; }
  async updateEmailTemplate(): Promise<any> { return undefined; }
  async deleteEmailTemplate(): Promise<void> {}

  async enrichContact(id: number, contactData: Partial<Contact>): Promise<Contact | undefined> {
    return this.updateContact(id, contactData);
  }

  async searchContactDetails(): Promise<Partial<Contact>> { return {}; }
  async addContactFeedback(): Promise<any> { return {}; }
  async getContactFeedback(): Promise<any[]> { return []; }
  async updateContactConfidenceScore(): Promise<any> { return undefined; }
  async updateContactValidationStatus(): Promise<any> { return undefined; }

  async getSearchTestResult(): Promise<any> { return undefined; }
  async listSearchTestResults(): Promise<any[]> { return []; }
  async getTestResultsByStrategy(): Promise<any[]> { return []; }
  async createSearchTestResult(): Promise<any> { return {}; }
  async updateTestResultStatus(): Promise<any> { return {}; }
  async getStrategyPerformanceHistory(): Promise<any> { return { dates: [], scores: [] }; }
}

// Export the storage instance
export const storage = new ReplitStorage();