// Simple in-memory storage implementation to get the credit system working
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

export interface IStorage {
  // User Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string }): Promise<User>;
  getMaxUserId(): Promise<number>;
  createUserWithId(id: number, userData: {email: string; password: string; username?: string; firebaseUid?: string}): Promise<User>;
  updateUserCredentials(id: number, credentials: {email: string; password: string; username?: string; firebaseUid?: string}): Promise<User>;

  // Credits System
  getUserCredits(userId: number): Promise<number>;
  createUserCredits(userId: number, initialCredits?: number): Promise<void>;
  deductCredits(userId: number, amount: number, operation: string, description?: string): Promise<boolean>;
  addCredits(userId: number, amount: number, operation: string, description?: string, stripePaymentIntentId?: string): Promise<void>;
  getCreditTransactions(userId: number, limit?: number): Promise<CreditTransaction[]>;

  // Core functionality stubs (will implement as needed)
  listLists(userId: number): Promise<List[]>;
  getList(listId: number, userId: number): Promise<List | undefined>;
  listCompaniesByList(listId: number, userId: number): Promise<Company[]>;
  getNextListId(): Promise<number>;
  createList(data: Omit<List, 'id' | 'createdAt'>): Promise<List>;
  updateCompanyList(companyId: number, listId: number): Promise<void>;
  listCompanies(userId: number): Promise<Company[]>;
  getCompany(id: number, userId: number): Promise<Company | undefined>;
  createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company>;
  updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined>;
  listContactsByCompany(companyId: number, userId: number): Promise<Contact[]>;
  getContact(id: number, userId: number): Promise<Contact | undefined>;
  createContact(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact>;
  deleteContactsByCompany(companyId: number, userId: number): Promise<void>;
  listCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number, userId: number): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;
  createCampaign(data: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign>;
  listEmailTemplates(userId: number): Promise<EmailTemplate[]>;
  getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined>;
  createEmailTemplate(data: Omit<EmailTemplate, 'id' | 'createdAt'>): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, data: Omit<EmailTemplate, 'createdAt'>): Promise<EmailTemplate>;
  createSearchJob(data: Omit<SearchJob, 'createdAt'>): Promise<SearchJob>;
  getSearchJob(id: string, userId: number): Promise<SearchJob | undefined>;
  updateSearchJob(id: string, data: Partial<SearchJob>): Promise<SearchJob | undefined>;
  listActiveSearchJobs(userId: number): Promise<SearchJob[]>;
  listCompletedSearchJobs(userId: number): Promise<SearchJob[]>;
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

class SimpleStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private credits: Map<number, UserCredits> = new Map();
  private transactions: Map<number, CreditTransaction[]> = new Map();
  private companies: Map<number, Company> = new Map();
  private contacts: Map<number, Contact> = new Map();
  private lists: Map<number, List> = new Map();
  private campaigns: Map<number, Campaign> = new Map();
  private templates: Map<number, EmailTemplate> = new Map();
  private searchJobs: Map<string, SearchJob> = new Map();
  private counters: Map<string, number> = new Map();

  private getNextId(prefix: string): number {
    const current = this.counters.get(prefix) || 0;
    const next = current + 1;
    this.counters.set(prefix, next);
    return next;
  }

  // User Auth methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async createUser(data: { email: string; password: string; username?: string; firebaseUid?: string }): Promise<User> {
    const id = this.getNextId('user');
    const user: User = {
      id,
      username: data.username || data.email.split('@')[0],
      password: data.password,
      email: data.email,
      firebaseUid: data.firebaseUid,
      createdAt: new Date().toISOString(),
      registeredAt: new Date().toISOString()
    };
    
    this.users.set(id, user);
    this.usersByEmail.set(data.email, user);
    
    // Initialize with 500 credits
    await this.createUserCredits(id, 500);
    
    return user;
  }



  async getMaxUserId(): Promise<number> {
    let maxId = 0;
    this.users.forEach((_, id) => {
      if (id > maxId) {
        maxId = id;
      }
    });
    return maxId;
  }

  async createUserWithId(id: number, userData: {email: string; password: string; username?: string; firebaseUid?: string}): Promise<User> {
    const user: User = {
      id,
      username: userData.username || userData.email.split('@')[0],
      password: userData.password,
      email: userData.email,
      firebaseUid: userData.firebaseUid,
      createdAt: new Date().toISOString(),
      registeredAt: new Date().toISOString()
    };
    
    this.users.set(id, user);
    this.usersByEmail.set(userData.email, user);
    
    // Initialize with 500 credits for new registered users
    await this.createUserCredits(id, 500);
    
    return user;
  }

  async updateUserCredentials(id: number, credentials: {email: string; password: string; username?: string; firebaseUid?: string}): Promise<User> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser: User = {
      ...existingUser,
      email: credentials.email,
      password: credentials.password,
      username: credentials.username || credentials.email.split('@')[0],
      firebaseUid: credentials.firebaseUid,
      registeredAt: new Date().toISOString()
    };
    
    this.users.set(id, updatedUser);
    this.usersByEmail.set(credentials.email, updatedUser);
    
    // Upgrade to full user credits if they had trial credits
    const currentCredits = await this.getUserCredits(id);
    if (currentCredits === 100) {
      await this.addCredits(id, 400, 'registration_bonus', 'Bonus credits for completing registration');
    }
    
    return updatedUser;
  }

  // Credits System
  async getUserCredits(userId: number): Promise<number> {
    const userCredits = this.credits.get(userId);
    return userCredits?.credits || 0;
  }

  async createUserCredits(userId: number, initialCredits: number = 500): Promise<void> {
    this.credits.set(userId, {
      userId,
      credits: initialCredits,
      lastUpdated: new Date().toISOString()
    });
  }

  async deductCredits(userId: number, amount: number, operation: string, description?: string): Promise<boolean> {
    const userCredits = this.credits.get(userId);
    if (!userCredits || userCredits.credits < amount) {
      return false;
    }

    const newBalance = userCredits.credits - amount;
    userCredits.credits = newBalance;
    userCredits.lastUpdated = new Date().toISOString();

    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: 'deduction',
      amount: -amount,
      operation,
      description,
      balanceAfter: newBalance,
      createdAt: new Date().toISOString()
    };

    const userTransactions = this.transactions.get(userId) || [];
    userTransactions.unshift(transaction);
    this.transactions.set(userId, userTransactions);

    return true;
  }

  async addCredits(userId: number, amount: number, operation: string, description?: string, stripePaymentIntentId?: string): Promise<void> {
    let userCredits = this.credits.get(userId);
    if (!userCredits) {
      await this.createUserCredits(userId, 0);
      userCredits = this.credits.get(userId)!;
    }

    const newBalance = userCredits.credits + amount;
    userCredits.credits = newBalance;
    userCredits.lastUpdated = new Date().toISOString();

    const transaction: CreditTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type: 'purchase',
      amount,
      operation,
      description,
      balanceAfter: newBalance,
      stripePaymentIntentId,
      createdAt: new Date().toISOString()
    };

    const userTransactions = this.transactions.get(userId) || [];
    userTransactions.unshift(transaction);
    this.transactions.set(userId, userTransactions);
  }

  async getCreditTransactions(userId: number, limit: number = 20): Promise<CreditTransaction[]> {
    const transactions = this.transactions.get(userId) || [];
    return transactions.slice(0, limit);
  }

  // Core functionality stubs - implement basic functionality for now
  async listLists(userId: number): Promise<List[]> {
    return Array.from(this.lists.values()).filter(list => list.userId === userId);
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    const list = this.lists.get(listId);
    return list?.userId === userId ? list : undefined;
  }

  async listCompaniesByList(listId: number, userId: number): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(company => 
      company.userId === userId && company.listId === listId
    );
  }

  async getNextListId(): Promise<number> {
    return this.getNextId('list');
  }

  async createList(data: Omit<List, 'id' | 'createdAt'>): Promise<List> {
    const id = this.getNextId('list');
    const list: List = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.lists.set(id, list);
    return list;
  }

  async updateList(listId: number, data: Partial<List>, userId: number): Promise<List | undefined> {
    // Get existing list
    const existingList = await this.getList(listId, userId);
    if (!existingList) return undefined;
    
    // Update with new data
    const updatedList = { ...existingList, ...data };
    
    // Save back to storage
    this.lists.set(listId, updatedList);
    
    return updatedList;
  }

  async updateCompanyList(companyId: number, listId: number): Promise<void> {
    const company = this.companies.get(companyId);
    if (company) {
      company.listId = listId;
    }
  }

  async listCompanies(userId: number): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(company => company.userId === userId);
  }

  async getCompany(id: number, userId: number): Promise<Company | undefined> {
    const company = this.companies.get(id);
    return company?.userId === userId ? company : undefined;
  }

  async createCompany(data: Omit<Company, 'id' | 'createdAt'>): Promise<Company> {
    const id = this.getNextId('company');
    const company: Company = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: number, data: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (company) {
      Object.assign(company, data);
      return company;
    }
    return undefined;
  }

  async listContactsByCompany(companyId: number, userId: number): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter(contact => 
      contact.userId === userId && contact.companyId === companyId
    );
  }

  async getContact(id: number, userId: number): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    return contact?.userId === userId ? contact : undefined;
  }

  async createContact(data: Omit<Contact, 'id' | 'createdAt'>): Promise<Contact> {
    const id = this.getNextId('contact');
    const contact: Contact = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    const contact = this.contacts.get(id);
    if (contact) {
      Object.assign(contact, data);
      return contact;
    }
    throw new Error('Contact not found');
  }

  async deleteContactsByCompany(companyId: number, userId: number): Promise<void> {
    const contactsToDelete = Array.from(this.contacts.entries())
      .filter(([_, contact]) => contact.userId === userId && contact.companyId === companyId)
      .map(([id, _]) => id);
    
    contactsToDelete.forEach(id => this.contacts.delete(id));
  }

  async listCampaigns(userId: number): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(campaign => campaign.userId === userId);
  }

  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    return campaign?.userId === userId ? campaign : undefined;
  }

  async getNextCampaignId(): Promise<number> {
    return this.getNextId('campaign');
  }

  async createCampaign(data: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign> {
    const id = this.getNextId('campaign');
    const campaign: Campaign = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign> {
    const campaign = this.campaigns.get(id);
    if (campaign && campaign.userId === userId) {
      Object.assign(campaign, data);
      return campaign;
    }
    throw new Error('Campaign not found');
  }

  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    return Array.from(this.templates.values()).filter(template => template.userId === userId);
  }

  async getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined> {
    const template = this.templates.get(id);
    return template?.userId === userId ? template : undefined;
  }

  async createEmailTemplate(data: Omit<EmailTemplate, 'id' | 'createdAt'>): Promise<EmailTemplate> {
    const id = this.getNextId('template');
    const template: EmailTemplate = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    this.templates.set(id, template);
    return template;
  }

  async updateEmailTemplate(id: number, data: Omit<EmailTemplate, 'createdAt'>): Promise<EmailTemplate> {
    const template = this.templates.get(id);
    if (template) {
      Object.assign(template, data);
      return template;
    }
    throw new Error('Template not found');
  }

  async createSearchJob(data: Omit<SearchJob, 'createdAt'>): Promise<SearchJob> {
    const job: SearchJob = {
      ...data,
      createdAt: new Date().toISOString()
    };
    this.searchJobs.set(data.id, job);
    return job;
  }

  async getSearchJob(id: string, userId: number): Promise<SearchJob | undefined> {
    const job = this.searchJobs.get(id);
    return job?.userId === userId ? job : undefined;
  }

  async updateSearchJob(id: string, data: Partial<SearchJob>): Promise<SearchJob | undefined> {
    const job = this.searchJobs.get(id);
    if (job) {
      Object.assign(job, data);
      return job;
    }
    return undefined;
  }

  async listActiveSearchJobs(userId: number): Promise<SearchJob[]> {
    return Array.from(this.searchJobs.values()).filter(job => 
      job.userId === userId && job.status !== 'completed' && job.status !== 'failed'
    );
  }

  async listCompletedSearchJobs(userId: number): Promise<SearchJob[]> {
    return Array.from(this.searchJobs.values()).filter(job => 
      job.userId === userId && (job.status === 'completed' || job.status === 'failed')
    );
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
    return null;
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
    return null;
  }

  async createMessage(data: any): Promise<any> {
    return data;
  }

  async markThreadMessagesAsRead(threadId: number): Promise<void> {
    // No-op
  }
}

export const storage = new SimpleStorage();