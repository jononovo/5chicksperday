// Using Replit DB instead of PostgreSQL
import Database from "@replit/database";
const db = new Database();

// Type definitions for our data structures
export interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  firebaseUid?: string;
  createdAt: string;
  registeredAt?: string;
}

export interface UserCredits {
  userId: number;
  credits: number;
  lastUpdated: string;
}

export interface CreditTransaction {
  id: string;
  userId: number;
  type: 'purchase' | 'deduction';
  amount: number;
  operation: string;
  description?: string;
  balanceAfter: number;
  stripePaymentIntentId?: string;
  createdAt: string;
}

export interface SearchJob {
  id: string;
  userId: number;
  query: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: string;
  companiesFound: number;
  contactsFound: number;
  emailsFound: number;
  results?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Company {
  id: number;
  userId: number;
  name: string;
  listId?: number;
  description?: string;
  age?: number;
  size?: number;
  website?: string;
  alternativeProfileUrl?: string;
  defaultContactEmail?: string;
  ranking?: number;
  linkedinProminence?: number;
  customerCount?: number;
  location?: string;
  industry?: string;
  snapshot?: Record<string, any>;
  createdAt: string;
}

export interface Contact {
  id: number;
  userId: number;
  companyId: number;
  name: string;
  email?: string;
  role?: string;
  probability?: number;
  linkedinUrl?: string;
  twitterHandle?: string;
  phoneNumber?: string;
  location?: string;
  alternativeEmails?: string[];
  confidenceScore?: number;
  validationStatus?: string;
  completedSearches?: string[];
  createdAt: string;
}

export interface List {
  id: number;
  userId: number;
  listId: number;
  prompt: string;
  resultCount: number;
  customSearchTargets?: string[];
  createdAt: string;
}

export interface Campaign {
  id: number;
  userId: number;
  name: string;
  status?: string;
  description?: string;
  campaignId: number;
  startDate?: string;
  totalCompanies?: number;
  createdAt: string;
}

export interface EmailTemplate {
  id: number;
  userId: number;
  name: string;
  subject: string;
  body: string;
  description?: string;
  createdAt: string;
}

export interface IStorage {
  // User Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string; firebaseUid?: string }): Promise<User>;
  createTemporaryUser(): Promise<number>;
  linkTemporaryUserToFirebase(tempUserId: number, firebaseData: {email: string; firebaseUid: string}): Promise<User>;

  // Lists
  listLists(userId: number): Promise<List[]>;
  getList(listId: number, userId: number): Promise<List | undefined>;
  listCompaniesByList(listId: number, userId: number): Promise<Company[]>;
  getNextListId(): Promise<number>;
  createList(data: Omit<List, 'id' | 'createdAt'>): Promise<List>;
  updateCompanyList(companyId: number, listId: number): Promise<void>;

  // Companies
  listCompanies(userId: number): Promise<Company[]>;
  getCompany(id: number, userId: number): Promise<Company | undefined>;
  createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company>;
  updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined>;

  // Contacts
  listContactsByCompany(companyId: number, userId: number): Promise<Contact[]>;
  getContact(id: number, userId: number): Promise<Contact | undefined>;
  createContact(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact>;
  deleteContactsByCompany(companyId: number, userId: number): Promise<void>;

  // Campaigns
  listCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number, userId: number): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;
  createCampaign(data: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign>;

  // Email Templates
  listEmailTemplates(userId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: Omit<EmailTemplate, 'id' | 'createdAt'>): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: Omit<EmailTemplate, 'createdAt'>): Promise<EmailTemplate>;

  // Search Jobs
  createSearchJob(data: Omit<SearchJob, 'createdAt'>): Promise<SearchJob>;
  getSearchJob(id: string, userId: number): Promise<SearchJob | undefined>;
  updateSearchJob(id: string, data: Partial<SearchJob>): Promise<SearchJob | undefined>;
  listActiveSearchJobs(userId: number): Promise<SearchJob[]>;
  listCompletedSearchJobs(userId: number): Promise<SearchJob[]>;

  // Credits System
  getUserCredits(userId: number): Promise<number>;
  createUserCredits(userId: number, initialCredits?: number): Promise<void>;
  deductCredits(userId: number, amount: number, operation: string, description?: string): Promise<boolean>;
  addCredits(userId: number, amount: number, operation: string, description?: string, stripePaymentIntentId?: string): Promise<void>;
  getCreditTransactions(userId: number, limit?: number): Promise<CreditTransaction[]>;
  updateUserCredentials(userId: number, data: { email: string; password: string; username: string }): Promise<User>;

  // Stub methods for compatibility
  getUserPreferences(userId: number): Promise<any>;
  updateUserPreferences(userId: number, data: any): Promise<any>;
  initializeUserPreferences(userId: number): Promise<any>;
  getStrategicProfiles(userId: number): Promise<any[]>;
  createStrategicProfile(data: any): Promise<any>;
  updateStrategicProfile(id: number, data: any): Promise<any>;
  listActiveContactsWithThreads(userId: number): Promise<any[]>;
  listThreadsByContact(contactId: number, userId: number): Promise<any[]>;
  getThread(id: number, userId: number): Promise<any>;
  createThread(data: any): Promise<any>;
  updateThread(id: number, data: any): Promise<any>;
  listMessagesByThread(threadId: number): Promise<any[]>;
  getThreadMessage(id: number): Promise<any>;
  createMessage(data: any): Promise<any>;
  markThreadMessagesAsRead(threadId: number): Promise<void>;
}

class ReplitDBStorage implements IStorage {
  private async getNextId(prefix: string): Promise<number> {
    const key = `${prefix}_counter`;
    try {
      const result = await db.get(key);
      const current = Number(result || 0);
      const next = current + 1;
      await db.set(key, next);
      return next;
    } catch (error) {
      console.error('Error getting next ID:', error);
      return 1;
    }
  }

  // User Auth methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const users = (await db.get('users') as any) || {};
      return Object.values(users).find((user: any) => user.email === email) as User | undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getUserById(id: number): Promise<User | undefined> {
    try {
      const users = (await db.get('users') as any) || {};
      return users[id] as User | undefined;
    } catch (error) {
      console.error('Error getting user by id:', error);
      return undefined;
    }
  }

  async createUser(data: { email: string; password: string; username?: string; firebaseUid?: string }): Promise<User> {
    const id = await this.getNextId('user');
    const user: User = {
      id,
      username: data.username || data.email.split('@')[0],
      password: data.password,
      email: data.email,
      firebaseUid: data.firebaseUid,
      createdAt: new Date().toISOString(),
      registeredAt: new Date().toISOString()
    };

    const users = (await db.get('users') as any) || {};
    users[id] = user;
    await db.set('users', users);
    
    return user;
  }

  async createTemporaryUser(): Promise<number> {
    const id = await this.getNextId('user');
    const user: User = {
      id,
      username: `temp_user_${id}`,
      password: '', // Empty for temp users
      email: '', // Empty until registration
      createdAt: new Date().toISOString()
    };
    
    const users = (await db.get('users') as any) || {};
    users[id] = user;
    await db.set('users', users);
    return id;
  }

  async linkTemporaryUserToFirebase(tempUserId: number, firebaseData: {email: string; firebaseUid: string}): Promise<User> {
    const users = (await db.get('users') as any) || {};
    if (users[tempUserId]) {
      users[tempUserId] = {
        ...users[tempUserId],
        email: firebaseData.email,
        firebaseUid: firebaseData.firebaseUid,
        username: firebaseData.email.split('@')[0],
        password: '', // Keep empty for Firebase auth
        registeredAt: new Date().toISOString()
      };
      await db.set('users', users);
      return users[tempUserId];
    }
    throw new Error('Temporary user not found');
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    const lists = await db.get('lists') || {};
    return Object.values(lists).filter((list: any) => list.userId === userId);
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    const lists = await db.get('lists') || {};
    return Object.values(lists).find((list: any) => list.listId === listId && list.userId === userId);
  }

  async listCompaniesByList(listId: number, userId: number): Promise<Company[]> {
    const companies = await db.get('companies') || {};
    return Object.values(companies).filter((company: any) => company.listId === listId && company.userId === userId);
  }

  async getNextListId(): Promise<number> {
    return await this.getNextId('list');
  }

  async createList(data: Omit<List, 'id' | 'createdAt'>): Promise<List> {
    const id = await this.getNextId('list');
    const list: List = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    const lists = await db.get('lists') || {};
    lists[id] = list;
    await db.set('lists', lists);
    
    return list;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    const companies = await db.get('companies') || {};
    if (companies[companyId]) {
      companies[companyId].listId = listId;
      await db.set('companies', companies);
    }
  }

  // Companies
  async listCompanies(userId: number): Promise<Company[]> {
    const companies = await db.get('companies') || {};
    return Object.values(companies).filter((company: any) => company.userId === userId);
  }

  async getCompany(id: number, userId: number): Promise<Company | undefined> {
    const companies = await db.get('companies') || {};
    const company = companies[id];
    return company && company.userId === userId ? company : undefined;
  }

  async createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const id = await this.getNextId('company');
    const company: Company = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    const companies = await db.get('companies') || {};
    companies[id] = company;
    await db.set('companies', companies);
    
    return company;
  }

  async updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined> {
    const companies = await db.get('companies') || {};
    if (companies[id]) {
      companies[id] = { ...companies[id], ...data };
      await db.set('companies', companies);
      return companies[id];
    }
    return undefined;
  }

  // Contacts
  async listContactsByCompany(companyId: number, userId: number): Promise<Contact[]> {
    const contacts = await db.get('contacts') || {};
    return Object.values(contacts).filter((contact: any) => contact.companyId === companyId && contact.userId === userId);
  }

  async getContact(id: number, userId: number): Promise<Contact | undefined> {
    const contacts = await db.get('contacts') || {};
    const contact = contacts[id];
    return contact && contact.userId === userId ? contact : undefined;
  }

  async createContact(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const id = await this.getNextId('contact');
    const contact: Contact = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    const contacts = await db.get('contacts') || {};
    contacts[id] = contact;
    await db.set('contacts', contacts);
    
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    const contacts = await db.get('contacts') || {};
    if (contacts[id]) {
      contacts[id] = { ...contacts[id], ...data };
      await db.set('contacts', contacts);
    }
    return contacts[id];
  }

  async deleteContactsByCompany(companyId: number, userId: number): Promise<void> {
    const contacts = await db.get('contacts') || {};
    const filtered = Object.fromEntries(
      Object.entries(contacts).filter(([_, contact]: [string, any]) => 
        !(contact.companyId === companyId && contact.userId === userId)
      )
    );
    await db.set('contacts', filtered);
  }

  // Campaigns
  async listCampaigns(userId: number): Promise<Campaign[]> {
    const campaigns = await db.get('campaigns') || {};
    return Object.values(campaigns).filter((campaign: any) => campaign.userId === userId);
  }

  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const campaigns = await db.get('campaigns') || {};
    const campaign = campaigns[id];
    return campaign && campaign.userId === userId ? campaign : undefined;
  }

  async getNextCampaignId(): Promise<number> {
    return await this.getNextId('campaign');
  }

  async createCampaign(data: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign> {
    const id = await this.getNextId('campaign');
    const campaign: Campaign = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    const campaigns = await db.get('campaigns') || {};
    campaigns[id] = campaign;
    await db.set('campaigns', campaigns);
    
    return campaign;
  }

  async updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign> {
    const campaigns = await db.get('campaigns') || {};
    if (campaigns[id] && campaigns[id].userId === userId) {
      campaigns[id] = { ...campaigns[id], ...data };
      await db.set('campaigns', campaigns);
    }
    return campaigns[id];
  }

  // Email Templates
  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    const templates = await db.get('email_templates') || {};
    return Object.values(templates).filter((template: any) => template.userId === userId);
  }

  async getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined> {
    const templates = await db.get('email_templates') || {};
    const template = templates[id];
    return template && template.userId === userId ? template : undefined;
  }

  async createEmailTemplate(data: Omit<EmailTemplate, 'id' | 'createdAt'>): Promise<EmailTemplate> {
    const id = await this.getNextId('email_template');
    const template: EmailTemplate = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    const templates = await db.get('email_templates') || {};
    templates[id] = template;
    await db.set('email_templates', templates);
    
    return template;
  }

  async updateEmailTemplate(id: number, data: Omit<EmailTemplate, 'createdAt'>): Promise<EmailTemplate> {
    const templates = await db.get('email_templates') || {};
    if (templates[id]) {
      templates[id] = { ...templates[id], ...data };
      await db.set('email_templates', templates);
    }
    return templates[id];
  }

  // Search Jobs
  async createSearchJob(data: Omit<SearchJob, 'createdAt'>): Promise<SearchJob> {
    const job: SearchJob = {
      ...data,
      createdAt: new Date().toISOString()
    };

    const jobs = await db.get('search_jobs') || {};
    jobs[data.id] = job;
    await db.set('search_jobs', jobs);
    
    return job;
  }

  async getSearchJob(id: string, userId: number): Promise<SearchJob | undefined> {
    const jobs = await db.get('search_jobs') || {};
    const job = jobs[id];
    return job && job.userId === userId ? job : undefined;
  }

  async updateSearchJob(id: string, data: Partial<SearchJob>): Promise<SearchJob | undefined> {
    const jobs = await db.get('search_jobs') || {};
    if (jobs[id]) {
      jobs[id] = { ...jobs[id], ...data };
      await db.set('search_jobs', jobs);
      return jobs[id];
    }
    return undefined;
  }

  async listActiveSearchJobs(userId: number): Promise<SearchJob[]> {
    const jobs = await db.get('search_jobs') || {};
    return Object.values(jobs).filter((job: any) => 
      job.userId === userId && (job.status === 'pending' || job.status === 'processing')
    );
  }

  async listCompletedSearchJobs(userId: number): Promise<SearchJob[]> {
    const jobs = await db.get('search_jobs') || {};
    return Object.values(jobs).filter((job: any) => 
      job.userId === userId && (job.status === 'completed' || job.status === 'failed')
    );
  }

  // Credits System implementation
  async getUserCredits(userId: number): Promise<number> {
    const credits = await db.get('user_credits') || {};
    return credits[userId]?.credits || 0;
  }

  async createUserCredits(userId: number, initialCredits: number = 500): Promise<void> {
    const credits = await db.get('user_credits') || {};
    credits[userId] = {
      userId,
      credits: initialCredits,
      lastUpdated: new Date().toISOString()
    };
    await db.set('user_credits', credits);
  }

  async deductCredits(userId: number, amount: number, operation: string, description?: string): Promise<boolean> {
    const currentCredits = await this.getUserCredits(userId);
    
    if (currentCredits < amount) {
      return false; // Insufficient credits
    }

    const newBalance = currentCredits - amount;

    // Update user credits
    const credits = await db.get('user_credits') || {};
    credits[userId] = {
      userId,
      credits: newBalance,
      lastUpdated: new Date().toISOString()
    };
    await db.set('user_credits', credits);

    // Record transaction
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transaction: CreditTransaction = {
      id: transactionId,
      userId,
      type: 'deduction',
      amount: -amount,
      operation,
      description,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString()
    };

    const transactions = await db.get('credit_transactions') || {};
    transactions[transactionId] = transaction;
    await db.set('credit_transactions', transactions);

    return true;
  }

  async addCredits(userId: number, amount: number, operation: string, description?: string, stripePaymentIntentId?: string): Promise<void> {
    const currentCredits = await this.getUserCredits(userId);
    const newBalance = currentCredits + amount;

    // Update user credits
    const credits = await db.get('user_credits') || {};
    credits[userId] = {
      userId,
      credits: newBalance,
      lastUpdated: new Date().toISOString()
    };
    await db.set('user_credits', credits);

    // Record transaction
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transaction: CreditTransaction = {
      id: transactionId,
      userId,
      type: 'purchase',
      amount,
      operation,
      description,
      balanceAfter: newBalance,
      stripePaymentIntentId,
      createdAt: new Date().toISOString()
    };

    const transactions = await db.get('credit_transactions') || {};
    transactions[transactionId] = transaction;
    await db.set('credit_transactions', transactions);
  }

  async getCreditTransactions(userId: number, limit: number = 20): Promise<CreditTransaction[]> {
    const transactions = await db.get('credit_transactions') || {};
    return Object.values(transactions)
      .filter((tx: any) => tx.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async updateUserCredentials(userId: number, data: { email: string; password: string; username: string }): Promise<User> {
    const users = await db.get('users') || {};
    if (users[userId]) {
      users[userId] = { ...users[userId], ...data };
      await db.set('users', users);
    }
    return users[userId];
  }

  // Stub methods for compatibility
  async getUserPreferences(userId: number): Promise<any> {
    return {};
  }

  async updateUserPreferences(userId: number, data: any): Promise<any> {
    return data;
  }

  async initializeUserPreferences(userId: number): Promise<any> {
    return {};
  }

  async getStrategicProfiles(userId: number): Promise<any[]> {
    return [];
  }

  async createStrategicProfile(data: any): Promise<any> {
    return data;
  }

  async updateStrategicProfile(id: number, data: any): Promise<any> {
    return data;
  }

  async listActiveContactsWithThreads(userId: number): Promise<any[]> {
    return [];
  }

  async listThreadsByContact(contactId: number, userId: number): Promise<any[]> {
    return [];
  }

  async getThread(id: number, userId: number): Promise<any> {
    return undefined;
  }

  async createThread(data: any): Promise<any> {
    return data;
  }

  async updateThread(id: number, data: any): Promise<any> {
    return data;
  }

  async listMessagesByThread(threadId: number): Promise<any[]> {
    return [];
  }

  async getThreadMessage(id: number): Promise<any> {
    return undefined;
  }

  async createMessage(data: any): Promise<any> {
    return data;
  }

  async markThreadMessagesAsRead(threadId: number): Promise<void> {
    // Implementation needed
  }
}

export const storage = new ReplitDBStorage();