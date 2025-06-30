/**
 * Firebase-first storage implementation using only Replit Database
 * Uses Firebase UID as the primary user identifier
 */
import Database from "@replit/database";
import { 
  User, 
  UserPreferences, 
  List, 
  Company, 
  Contact, 
  Campaign, 
  EmailTemplate,
  InsertList,
  InsertCompany, 
  InsertContact,
  InsertCampaign,
  InsertEmailTemplate,
  InsertUserPreferences
} from "../shared/firebase-schema";

interface FirebaseIStorage {
  // User Profile (keyed by Firebase UID)
  getUserProfile(firebaseUID: string): Promise<User | undefined>;
  createUserProfile(firebaseUID: string, data: { email: string; username?: string }): Promise<User>;
  updateUserProfile(firebaseUID: string, data: Partial<User>): Promise<User>;
  
  // Firebase user methods for /api/firebase/user endpoint
  getFirebaseUser(firebaseUID: string): Promise<User | undefined>;
  createFirebaseUser(data: { firebaseUID: string; email: string; username?: string }): Promise<User>;

  // User Preferences
  getUserPreferences(firebaseUID: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(firebaseUID: string, data: Partial<InsertUserPreferences>): Promise<UserPreferences>;
  initializeUserPreferences(firebaseUID: string): Promise<UserPreferences>;

  // Gmail Token methods (using Firebase UID)
  setUserGmailTokens(firebaseUID: string, accessToken: string, refreshToken?: string): Promise<void>;
  getUserGmailTokens(firebaseUID: string): Promise<{accessToken?: string, refreshToken?: string} | undefined>;
  clearUserGmailTokens(firebaseUID: string): Promise<void>;

  // Lists
  listLists(firebaseUID: string): Promise<List[]>;
  getList(listId: number, firebaseUID: string): Promise<List | undefined>;
  listCompaniesByList(listId: number, firebaseUID: string): Promise<Company[]>;
  getNextListId(): Promise<number>;
  createList(firebaseUID: string, data: Omit<InsertList, 'userId'>): Promise<List>;
  updateCompanyList(companyId: number, listId: number): Promise<void>;
  updateList(listId: number, data: Partial<List>): Promise<List | null>;
  listSearchApproaches(): Promise<any[]>;

  // Companies
  listCompanies(firebaseUID: string): Promise<Company[]>;
  getCompany(id: number, firebaseUID: string): Promise<Company | undefined>;
  createCompany(firebaseUID: string, data: Omit<InsertCompany, 'userId'>): Promise<Company>;
  updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined>;

  // Contacts
  listContactsByCompany(companyId: number, firebaseUID: string): Promise<Contact[]>;
  getContact(id: number, firebaseUID: string): Promise<Contact | undefined>;
  createContact(firebaseUID: string, data: Omit<InsertContact, 'userId'>): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact>;
  deleteContactsByCompany(companyId: number, firebaseUID: string): Promise<void>;

  // Campaigns
  listCampaigns(firebaseUID: string): Promise<Campaign[]>;
  getCampaign(id: number, firebaseUID: string): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;
  createCampaign(firebaseUID: string, data: Omit<InsertCampaign, 'userId'>): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>, firebaseUID: string): Promise<Campaign>;

  // Email Templates
  listEmailTemplates(firebaseUID: string): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, firebaseUID: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(firebaseUID: string, data: Omit<InsertEmailTemplate, 'userId'>): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate>;

  // Legacy compatibility methods for authentication
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string }): Promise<User>;

  // Compatibility method
  initializeDefaultSearchApproaches(): Promise<void>;
}

export class FirebaseStorage implements FirebaseIStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  private async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.db.get(key);
      
      // Handle null/undefined responses
      if (!result) {
        return undefined;
      }
      
      // Handle Replit DB response format
      if (typeof result === 'object' && 'value' in result) {
        const value = (result as any).value;
        return value ? JSON.parse(value) : undefined;
      }
      
      // Handle string responses
      if (typeof result === 'string') {
        return JSON.parse(result);
      }
      
      // Handle direct object responses (already parsed)
      if (typeof result === 'object') {
        return result as T;
      }
      
      return undefined;
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
    }
  }

  private async list(prefix: string): Promise<string[]> {
    try {
      const result = await this.db.list(prefix);
      
      // Handle Replit DB response format
      if (result && typeof result === 'object' && 'value' in result) {
        return (result as any).value || [];
      }
      
      // Handle direct array response (legacy format)
      return result || [];
    } catch (error) {
      console.error(`Error listing ${prefix}:`, error);
      return [];
    }
  }

  private async getNextId(entity: string): Promise<number> {
    // Generate unique ID using timestamp + random component to prevent duplicates
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const uniqueId = parseInt(`${timestamp}${random}`);
    
    // Ensure uniqueness by checking if ID already exists
    const existingKey = `${entity}:${uniqueId}`;
    const existing = await this.get(existingKey);
    
    if (existing) {
      // If collision occurs, try again with different random component
      const newRandom = Math.floor(Math.random() * 9999);
      return parseInt(`${timestamp}${newRandom}`);
    }
    
    return uniqueId;
  }

  // User Profile methods
  async getUserProfile(firebaseUID: string): Promise<User | undefined> {
    return await this.get<User>(`user:${firebaseUID}`);
  }

  async createUserProfile(firebaseUID: string, data: { email: string; username?: string }): Promise<User> {
    const user: User = {
      id: await this.getNextId('user'),
      email: data.email,
      password: '', // Not used with Firebase auth
      username: data.username || null,
      createdAt: new Date(),
      firebaseUID
    };

    await this.set(`user:${firebaseUID}`, user);
    return user;
  }

  async updateUserProfile(firebaseUID: string, data: Partial<User>): Promise<User> {
    const existing = await this.getUserProfile(firebaseUID);
    if (!existing) throw new Error(`User ${firebaseUID} not found`);

    const updated = { ...existing, ...data };
    await this.set(`user:${firebaseUID}`, updated);
    return updated;
  }

  // Firebase user methods for /api/firebase/user endpoint
  async getFirebaseUser(firebaseUID: string): Promise<User | undefined> {
    return await this.getUserProfile(firebaseUID);
  }

  async createFirebaseUser(data: { firebaseUID: string; email: string; username?: string }): Promise<User> {
    return await this.createUserProfile(data.firebaseUID, {
      email: data.email,
      username: data.username
    });
  }

  // User Preferences methods
  async getUserPreferences(firebaseUID: string): Promise<UserPreferences | undefined> {
    return await this.get<UserPreferences>(`preferences:${firebaseUID}`);
  }

  async updateUserPreferences(firebaseUID: string, data: Partial<InsertUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(firebaseUID) || { userId: 0 }; // userId not used
    const updated = { ...existing, ...data };
    await this.set(`preferences:${firebaseUID}`, updated);
    return updated;
  }

  async initializeUserPreferences(firebaseUID: string): Promise<UserPreferences> {
    const prefs: UserPreferences = { userId: 0 }; // userId not used with Firebase
    await this.set(`preferences:${firebaseUID}`, prefs);
    return prefs;
  }

  // Gmail Token methods
  async setUserGmailTokens(firebaseUID: string, accessToken: string, refreshToken?: string): Promise<void> {
    const tokens = { accessToken, refreshToken };
    await this.set(`gmail_tokens:${firebaseUID}`, tokens);
  }

  async getUserGmailTokens(firebaseUID: string): Promise<{accessToken?: string, refreshToken?: string} | undefined> {
    return await this.get(`gmail_tokens:${firebaseUID}`);
  }

  async clearUserGmailTokens(firebaseUID: string): Promise<void> {
    await this.delete(`gmail_tokens:${firebaseUID}`);
  }

  // Lists methods
  async listLists(firebaseUID: string): Promise<List[]> {
    const listIds = await this.get<number[]>(`user_lists:${firebaseUID}`) || [];
    const lists: List[] = [];
    
    for (const listId of listIds) {
      const list = await this.get<List>(`list:${listId}`);
      if (list) lists.push(list);
    }
    
    return lists;
  }

  async getList(listId: number, firebaseUID: string): Promise<List | undefined> {
    const userLists = await this.get<number[]>(`user_lists:${firebaseUID}`) || [];
    if (!userLists.includes(listId)) return undefined;
    
    return await this.get<List>(`list:${listId}`);
  }

  async listCompaniesByList(listId: number, firebaseUID: string): Promise<Company[]> {
    const list = await this.getList(listId, firebaseUID);
    if (!list) return [];
    
    const companyIds = await this.get<number[]>(`list_companies:${listId}`) || [];
    const companies: Company[] = [];
    
    for (const companyId of companyIds) {
      const company = await this.get<Company>(`company:${companyId}`);
      if (company) companies.push(company);
    }
    
    return companies;
  }

  async getNextListId(): Promise<number> {
    return await this.getNextId('list');
  }

  async createList(firebaseUID: string, data: Omit<InsertList, 'userId'>): Promise<List> {
    const id = await this.getNextListId();
    const list: List = {
      ...data,
      id,
      userId: 0, // Not used with Firebase
      createdAt: new Date()
    };

    await this.set(`list:${id}`, list);
    
    // Add to user's lists
    const userListsResult = await this.get<number[]>(`user_lists:${firebaseUID}`);
    const userLists = Array.isArray(userListsResult) ? userListsResult : [];
    userLists.push(id);
    await this.set(`user_lists:${firebaseUID}`, userLists);
    
    return list;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    // Add company to list
    const listCompaniesResult = await this.get<number[]>(`list_companies:${listId}`);
    const listCompanies = Array.isArray(listCompaniesResult) ? listCompaniesResult : [];
    if (!listCompanies.includes(companyId)) {
      listCompanies.push(companyId);
      await this.set(`list_companies:${listId}`, listCompanies);
    }
  }

  async updateList(listId: number, data: Partial<List>): Promise<List | null> {
    const existing = await this.get<List>(`list:${listId}`);
    if (!existing) return null;
    
    const updated = { ...existing, ...data };
    await this.set(`list:${listId}`, updated);
    return updated;
  }

  async listSearchApproaches(): Promise<any[]> {
    // Return empty array for Firebase-first storage - approaches are not used
    return [];
  }

  // Companies methods
  async listCompanies(firebaseUID: string): Promise<Company[]> {
    const companyIds = await this.get<number[]>(`user_companies:${firebaseUID}`) || [];
    const companies: Company[] = [];
    
    for (const companyId of companyIds) {
      const company = await this.get<Company>(`company:${companyId}`);
      if (company) companies.push(company);
    }
    
    return companies;
  }

  async getCompany(id: number, firebaseUID: string): Promise<Company | undefined> {
    const userCompanies = await this.get<number[]>(`user_companies:${firebaseUID}`) || [];
    if (!userCompanies.includes(id)) return undefined;
    
    return await this.get<Company>(`company:${id}`);
  }

  async createCompany(firebaseUID: string, data: Omit<InsertCompany, 'userId'>): Promise<Company> {
    const id = await this.getNextId('company');
    const company: Company = {
      ...data,
      id,
      userId: 0, // Not used with Firebase
      createdAt: new Date()
    };

    await this.set(`company:${id}`, company);
    
    // Add to user's companies
    const userCompaniesResult = await this.get<number[]>(`user_companies:${firebaseUID}`);
    const userCompanies = Array.isArray(userCompaniesResult) ? userCompaniesResult : [];
    userCompanies.push(id);
    await this.set(`user_companies:${firebaseUID}`, userCompanies);
    
    return company;
  }

  async updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined> {
    const existing = await this.get<Company>(`company:${id}`);
    if (!existing) return undefined;

    const updated = { ...existing, ...data };
    await this.set(`company:${id}`, updated);
    return updated;
  }

  // Contacts methods
  async listContactsByCompany(companyId: number, firebaseUID: string): Promise<Contact[]> {
    const contactIds = await this.get<number[]>(`company_contacts:${companyId}`) || [];
    const contacts: Contact[] = [];
    
    for (const contactId of contactIds) {
      const contact = await this.get<Contact>(`contact:${contactId}`);
      if (contact) contacts.push(contact);
    }
    
    return contacts;
  }

  async getContact(id: number, firebaseUID: string): Promise<Contact | undefined> {
    return await this.get<Contact>(`contact:${id}`);
  }

  async createContact(firebaseUID: string, data: Omit<InsertContact, 'userId'>): Promise<Contact> {
    const id = await this.getNextId('contact');
    const contact: Contact = {
      ...data,
      id,
      userId: 0, // Not used with Firebase
      createdAt: new Date(),
      alternativeEmails: data.alternativeEmails || [],
      lastEnriched: null,
      lastValidated: null
    };

    await this.set(`contact:${id}`, contact);
    
    // Add to company's contacts
    const companyContactsResult = await this.get<number[]>(`company_contacts:${data.companyId}`);
    const companyContacts = Array.isArray(companyContactsResult) ? companyContactsResult : [];
    companyContacts.push(id);
    await this.set(`company_contacts:${data.companyId}`, companyContacts);
    
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    const existing = await this.get<Contact>(`contact:${id}`);
    if (!existing) throw new Error(`Contact ${id} not found`);

    const updated = { ...existing, ...data };
    await this.set(`contact:${id}`, updated);
    return updated;
  }

  async deleteContactsByCompany(companyId: number, firebaseUID: string): Promise<void> {
    const contactIds = await this.get<number[]>(`company_contacts:${companyId}`) || [];
    
    for (const contactId of contactIds) {
      await this.delete(`contact:${contactId}`);
    }
    
    await this.delete(`company_contacts:${companyId}`);
  }

  // Campaigns methods
  async listCampaigns(firebaseUID: string): Promise<Campaign[]> {
    const campaignIds = await this.get<number[]>(`user_campaigns:${firebaseUID}`) || [];
    const campaigns: Campaign[] = [];
    
    for (const campaignId of campaignIds) {
      const campaign = await this.get<Campaign>(`campaign:${campaignId}`);
      if (campaign) campaigns.push(campaign);
    }
    
    return campaigns;
  }

  async getCampaign(id: number, firebaseUID: string): Promise<Campaign | undefined> {
    const userCampaigns = await this.get<number[]>(`user_campaigns:${firebaseUID}`) || [];
    if (!userCampaigns.includes(id)) return undefined;
    
    return await this.get<Campaign>(`campaign:${id}`);
  }

  async getNextCampaignId(): Promise<number> {
    return await this.getNextId('campaign');
  }

  async createCampaign(firebaseUID: string, data: Omit<InsertCampaign, 'userId'>): Promise<Campaign> {
    const id = await this.getNextCampaignId();
    const campaign: Campaign = {
      ...data,
      id,
      userId: 0, // Not used with Firebase
      createdAt: new Date(),
      startDate: data.startDate ? new Date(data.startDate) : null
    };

    await this.set(`campaign:${id}`, campaign);
    
    // Add to user's campaigns
    const userCampaignsResult = await this.get<number[]>(`user_campaigns:${firebaseUID}`);
    const userCampaigns = Array.isArray(userCampaignsResult) ? userCampaignsResult : [];
    userCampaigns.push(id);
    await this.set(`user_campaigns:${firebaseUID}`, userCampaigns);
    
    return campaign;
  }

  async updateCampaign(id: number, data: Partial<Campaign>, firebaseUID: string): Promise<Campaign> {
    const existing = await this.getCampaign(id, firebaseUID);
    if (!existing) throw new Error(`Campaign ${id} not found`);

    const updated = { ...existing, ...data };
    await this.set(`campaign:${id}`, updated);
    return updated;
  }

  // Email Templates methods
  async listEmailTemplates(firebaseUID: string): Promise<EmailTemplate[]> {
    const templateIds = await this.get<number[]>(`user_templates:${firebaseUID}`) || [];
    const templates: EmailTemplate[] = [];
    
    for (const templateId of templateIds) {
      const template = await this.get<EmailTemplate>(`template:${templateId}`);
      if (template) templates.push(template);
    }
    
    return templates;
  }

  async getEmailTemplate(id: number, firebaseUID: string): Promise<EmailTemplate | undefined> {
    const userTemplates = await this.get<number[]>(`user_templates:${firebaseUID}`) || [];
    if (!userTemplates.includes(id)) return undefined;
    
    return await this.get<EmailTemplate>(`template:${id}`);
  }

  async createEmailTemplate(firebaseUID: string, data: Omit<InsertEmailTemplate, 'userId'>): Promise<EmailTemplate> {
    const id = await this.getNextId('template');
    const template: EmailTemplate = {
      ...data,
      id,
      userId: 0, // Not used with Firebase
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.set(`template:${id}`, template);
    
    // Add to user's templates
    const userTemplatesResult = await this.get<number[]>(`user_templates:${firebaseUID}`);
    const userTemplates = Array.isArray(userTemplatesResult) ? userTemplatesResult : [];
    userTemplates.push(id);
    await this.set(`user_templates:${firebaseUID}`, userTemplates);
    
    return template;
  }

  async updateEmailTemplate(id: number, data: InsertEmailTemplate): Promise<EmailTemplate> {
    const existing = await this.get<EmailTemplate>(`template:${id}`);
    if (!existing) throw new Error(`Template ${id} not found`);
    
    const updated = { ...existing, ...data, updatedAt: new Date() };
    await this.set(`template:${id}`, updated);
    return updated;
  }

  // Legacy compatibility methods for authentication
  async getUserByEmail(email: string): Promise<User | undefined> {
    // Search through all user profiles to find by email
    const allKeys = await this.list('user:');
    for (const key of allKeys) {
      const user = await this.get<User>(key);
      if (user && user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    // Since Firebase uses UID as primary key, we need to search by ID
    const allKeys = await this.list('user:');
    for (const key of allKeys) {
      const user = await this.get<User>(key);
      if (user && user.id === id) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(data: { email: string; password: string; username?: string }): Promise<User> {
    // This is a legacy method for compatibility - in Firebase-first architecture,
    // users should be created through createUserProfile with Firebase UID
    const id = await this.getNextId('user');
    const user: User = {
      id,
      firebaseUID: '', // Empty since this is legacy
      email: data.email,
      username: data.username || null,
      name: data.username || null,
      avatarUrl: null,
      createdAt: new Date(),
      lastLoginAt: null,
      updatedAt: new Date()
    };

    await this.set(`legacy_user:${id}`, user);
    return user;
  }

  // Compatibility method
  async initializeDefaultSearchApproaches(): Promise<void> {
    console.log('Search approaches initialization skipped - using Firebase-first storage');
  }
}

export const firebaseStorage = new FirebaseStorage();