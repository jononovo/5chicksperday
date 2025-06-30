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
      return result ? JSON.parse(result as string) : undefined;
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
      const keys = await this.db.list(prefix);
      return keys || [];
    } catch (error) {
      console.error(`Error listing ${prefix}:`, error);
      return [];
    }
  }

  private async getNextId(entity: string): Promise<number> {
    const counterKey = `counter:${entity}`;
    const current = await this.get<number>(counterKey) || 0;
    const next = current + 1;
    await this.set(counterKey, next);
    return next;
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
    const userLists = await this.get<number[]>(`user_lists:${firebaseUID}`) || [];
    userLists.push(id);
    await this.set(`user_lists:${firebaseUID}`, userLists);
    
    return list;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    // Add company to list
    const listCompanies = await this.get<number[]>(`list_companies:${listId}`) || [];
    if (!listCompanies.includes(companyId)) {
      listCompanies.push(companyId);
      await this.set(`list_companies:${listId}`, listCompanies);
    }
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
    const userCompanies = await this.get<number[]>(`user_companies:${firebaseUID}`) || [];
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
    const companyContacts = await this.get<number[]>(`company_contacts:${data.companyId}`) || [];
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
    const userCampaigns = await this.get<number[]>(`user_campaigns:${firebaseUID}`) || [];
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
    const userTemplates = await this.get<number[]>(`user_templates:${firebaseUID}`) || [];
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

  // Compatibility method
  async initializeDefaultSearchApproaches(): Promise<void> {
    console.log('Search approaches initialization skipped - using Firebase-first storage');
  }
}

export const firebaseStorage = new FirebaseStorage();