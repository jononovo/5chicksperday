import Database from "@replit/database";
import type {
  User,
  InsertUser,
  List,
  InsertList,
  Company,
  InsertCompany,
  Contact,
  InsertContact,
  Campaign,
  InsertCampaign,
  CampaignList,
  InsertCampaignList,
  EmailTemplate,
  InsertEmailTemplate,
  SearchApproach,
  InsertSearchApproach,
  SearchTestResult,
  InsertSearchTestResult,
  UserPreferences,
  InsertUserPreferences,
  ContactFeedback,
  InsertContactFeedback,
  StrategicProfile,
  InsertStrategicProfile,
  EmailThread,
  EmailMessage,
} from "../shared/schema";
import { IStorage } from "../server/1--storage/index";

export class ReplitStorage implements IStorage {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  // Core helper methods
  private async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.db.get(key);

      // Handle Replit DB wrapped response format
      if (
        result &&
        typeof result === "object" &&
        "ok" in result &&
        "value" in result
      ) {
        const wrappedResult = result as { ok: boolean; value: any };
        if (
          wrappedResult.ok &&
          wrappedResult.value !== null &&
          wrappedResult.value !== undefined
        ) {
          // If value is already an object/array, return it directly
          if (typeof wrappedResult.value === "object") {
            return wrappedResult.value as T;
          }
          // If value is a string, try to parse it as JSON
          if (typeof wrappedResult.value === "string") {
            try {
              return JSON.parse(wrappedResult.value) as T;
            } catch {
              // If JSON parsing fails, return the string as-is
              return wrappedResult.value as T;
            }
          }
          // For other types (numbers, booleans), return as-is
          return wrappedResult.value as T;
        }
      }

      // For direct responses (strings, numbers, etc.)
      return result as T;
    } catch {
      return undefined;
    }
  }

  private async set<T>(key: string, value: T): Promise<void> {
    await this.db.set(key, value);
  }

  private async delete(key: string): Promise<void> {
    await this.db.delete(key);
  }

  private async list(prefix: string): Promise<string[]> {
    try {
      return await this.db.list(prefix);
    } catch (e) {
      console.error(`Error listing keys with prefix ${prefix}:`, e);
      return [];
    }
  }

  private async getNextId(entity: string): Promise<number> {
    const key = `counter:${entity}`;

    // Get current counter value, ensuring we extract the numeric value properly
    let current = 0;
    try {
      const counterValue = await this.get<number>(key);
      // Ensure we have a valid number, not a wrapped response or corrupted value
      if (typeof counterValue === "number" && !isNaN(counterValue)) {
        current = counterValue;
      } else {
        // Reset to 0 if we have corrupted data
        current = 0;
      }
    } catch (error) {
      // Fallback to 0 if there's any error
      current = 0;
    }

    const next = current + 1;
    await this.set(key, next);
    return next;
  }

  // User Auth Methods
  async getUserByEmail(email: string): Promise<User | undefined> {
    const userId = await this.get<number>(`index:user:email:${email}`);
    if (!userId) return undefined;
    return this.getUser(userId);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const userId = await this.get<number>(`index:user:username:${username}`);
    if (!userId) return undefined;
    return this.getUser(userId);
  }

  async createUser(data: InsertUser): Promise<User> {
    console.log("🔧 Creating user:", {
      email: data.email?.split("@")[0] + "@...",
      hasPassword: !!data.password,
      username: data.username,
      timestamp: new Date().toISOString(),
    });

    const id = await this.getNextId("user");
    const user: User = {
      id,
      username: data.username,
      password: data.password,
      email: data.email,
      createdAt: new Date(),
    };

    // Store user and create indexes
    await this.set(`user:${id}`, user);
    await this.set(`index:user:email:${data.email}`, id);
    await this.set(`index:user:username:${data.username}`, id);

    console.log("✅ User created successfully:", {
      id,
      email: data.email?.split("@")[0] + "@...",
      timestamp: new Date().toISOString(),
    });

    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.get<User>(`user:${id}`);
  }

  async updateUser(
    id: number,
    updates: Partial<User>,
  ): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    await this.set(`user:${id}`, updatedUser);
    return updatedUser;
  }

  // User Preferences
  async getUserPreferences(
    userId: number,
  ): Promise<UserPreferences | undefined> {
    const prefs = await this.get<UserPreferences>(`user_preferences:${userId}`);
    if (!prefs) {
      return this.initializeUserPreferences(userId);
    }
    return prefs;
  }

  async updateUserPreferences(
    userId: number,
    data: Partial<InsertUserPreferences>,
  ): Promise<UserPreferences> {
    const existing = await this.get<UserPreferences>(
      `user_preferences:${userId}`,
    );

    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date() };
      await this.set(`user_preferences:${userId}`, updated);
      return updated;
    }

    return this.initializeUserPreferences(userId);
  }

  async initializeUserPreferences(userId: number): Promise<UserPreferences> {
    const id = await this.getNextId("user_preferences");
    const prefs: UserPreferences = {
      id,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.set(`user_preferences:${userId}`, prefs);
    return prefs;
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    const keys = await this.list(`list:${userId}:`);
    const lists: List[] = [];

    for (const key of keys) {
      const list = await this.get<List>(key);
      if (list) lists.push(list);
    }

    return lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getList(listId: number, userId: number): Promise<List | undefined> {
    return this.get<List>(`list:${userId}:${listId}`);
  }

  async createList(data: InsertList & { userId: number }): Promise<List> {
    const id = await this.getNextId("list");
    const list: List = {
      id,
      userId: data.userId,
      listId: data.listId,
      prompt: data.prompt,
      resultCount: data.resultCount,
      customSearchTargets: data.customSearchTargets || null,
      createdAt: new Date(),
    };

    await this.set(`list:${data.userId}:${data.listId}`, list);
    return list;
  }

  async updateList(
    listId: number,
    data: Partial<InsertList>,
    userId: number,
  ): Promise<List | undefined> {
    const list = await this.getList(listId, userId);
    if (!list) return undefined;

    const updated = { ...list, ...data };
    await this.set(`list:${userId}:${listId}`, updated);
    return updated;
  }

  async getNextListId(): Promise<number> {
    const keys = await this.list("list:");
    let maxId = 1000;

    for (const key of keys) {
      const list = await this.get<List>(key);
      if (list && list.listId > maxId) {
        maxId = list.listId;
      }
    }

    return maxId + 1;
  }

  // Companies
  async listCompanies(): Promise<Company[]> {
    const keys = await this.list("company:");
    const companies: Company[] = [];

    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company) companies.push(company);
    }

    return companies;
  }

  async listCompaniesByList(
    listId: number,
    userId: number,
  ): Promise<Company[]> {
    const keys = await this.list(`company:${userId}:`);
    const companies: Company[] = [];

    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company && company.listId === listId) {
        companies.push(company);
      }
    }

    return companies;
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const keys = await this.list("company:");

    for (const key of keys) {
      const company = await this.get<Company>(key);
      if (company && company.id === id) {
        return company;
      }
    }

    return undefined;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const id = await this.getNextId("company");
    const company: Company = {
      id,
      userId: data.userId,
      name: data.name,
      listId: data.listId || null,
      description: data.description || null,
      age: data.age || null,
      size: data.size || null,
      website: data.website || null,
      alternativeProfileUrl: data.alternativeProfileUrl || null,
      defaultContactEmail: data.defaultContactEmail || null,
      ranking: data.ranking || null,
      linkedinProminence: data.linkedinProminence || null,
      customerCount: data.customerCount || null,
      rating: data.rating || null,
      services: data.services || null,
      validationPoints: data.validationPoints || null,
      differentiation: data.differentiation || null,
      totalScore: data.totalScore || null,
      snapshot: data.snapshot || null,
      createdAt: new Date(),
    };

    await this.set(`company:${data.userId}:${id}`, company);
    return company;
  }

  async updateCompany(
    id: number,
    updates: Partial<Company>,
  ): Promise<Company | undefined> {
    const company = await this.getCompany(id);
    if (!company) return undefined;

    const updated = { ...company, ...updates };
    await this.set(`company:${company.userId}:${id}`, updated);
    return updated;
  }

  async updateCompanyList(
    companyId: number,
    listId: number,
  ): Promise<Company | undefined> {
    return this.updateCompany(companyId, { listId });
  }

  // Contacts
  async listContactsByCompany(companyId: number): Promise<Contact[]> {
    const keys = await this.list("contact:");
    const contacts: Contact[] = [];

    for (const key of keys) {
      const contact = await this.get<Contact>(key);
      if (contact && contact.companyId === companyId) {
        contacts.push(contact);
      }
    }

    return contacts;
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const keys = await this.list("contact:");

    for (const key of keys) {
      const contact = await this.get<Contact>(key);
      if (contact && contact.id === id) {
        return contact;
      }
    }

    return undefined;
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const id = await this.getNextId("contact");
    const contact: Contact = {
      id,
      userId: data.userId,
      companyId: data.companyId,
      name: data.name,
      role: data.role || null,
      email: data.email || null,
      alternativeEmails: data.alternativeEmails || null,
      probability: data.probability || null,
      linkedinUrl: data.linkedinUrl || null,
      twitterHandle: data.twitterHandle || null,
      phoneNumber: data.phoneNumber || null,
      department: data.department || null,
      location: data.location || null,
      verificationSource: data.verificationSource || null,
      lastEnriched: data.lastEnriched || null,
      nameConfidenceScore: data.nameConfidenceScore || null,
      userFeedbackScore: data.userFeedbackScore || null,
      feedbackCount: data.feedbackCount || 0,
      lastValidated: data.lastValidated || null,
      createdAt: new Date(),
      completedSearches: data.completedSearches || null,
    };

    await this.set(`contact:${data.userId}:${id}`, contact);
    return contact;
  }

  async updateContact(
    id: number,
    updates: Partial<Contact>,
  ): Promise<Contact | undefined> {
    const contact = await this.getContact(id);
    if (!contact) return undefined;

    const updated = { ...contact, ...updates, lastEnriched: new Date() };
    await this.set(`contact:${contact.userId}:${id}`, updated);
    return updated;
  }

  async deleteContactsByCompany(companyId: number): Promise<void> {
    const contacts = await this.listContactsByCompany(companyId);

    for (const contact of contacts) {
      await this.delete(`contact:${contact.userId}:${contact.id}`);
    }
  }

  async enrichContact(
    id: number,
    contactData: Partial<Contact>,
  ): Promise<Contact | undefined> {
    return this.updateContact(id, { ...contactData, lastEnriched: new Date() });
  }

  // Search Approaches
  async getSearchApproach(id: number): Promise<SearchApproach | undefined> {
    return this.get<SearchApproach>(`search_approach:${id}`);
  }

  async listSearchApproaches(): Promise<SearchApproach[]> {
    const keys = await this.list("search_approach:");
    const approaches: SearchApproach[] = [];

    for (const key of keys) {
      const approach = await this.get<SearchApproach>(key);
      if (approach) approaches.push(approach);
    }

    return approaches;
  }

  async createSearchApproach(
    data: InsertSearchApproach,
  ): Promise<SearchApproach> {
    const id = await this.getNextId("search_approach");
    const approach: SearchApproach = {
      id,
      name: data.name,
      description: data.description,
      targetTypes: data.targetTypes,
      prompts: data.prompts,
      isActive: data.isActive || true,
      createdAt: new Date(),
    };

    await this.set(`search_approach:${id}`, approach);
    return approach;
  }

  async updateSearchApproach(
    id: number,
    updates: Partial<SearchApproach>,
  ): Promise<SearchApproach | undefined> {
    const approach = await this.getSearchApproach(id);
    if (!approach) return undefined;

    const updated = { ...approach, ...updates };
    await this.set(`search_approach:${id}`, updated);
    return updated;
  }

  async initializeDefaultSearchApproaches(): Promise<void> {
    // Implementation for default search approaches
  }

  // Campaigns
  async getCampaign(
    campaignId: number,
    userId: number,
  ): Promise<Campaign | undefined> {
    return this.get<Campaign>(`campaign:${userId}:${campaignId}`);
  }

  async listCampaigns(userId: number): Promise<Campaign[]> {
    const keys = await this.list(`campaign:${userId}:`);
    const campaigns: Campaign[] = [];

    for (const key of keys) {
      const campaign = await this.get<Campaign>(key);
      if (campaign) campaigns.push(campaign);
    }

    return campaigns;
  }

  async createCampaign(
    data: InsertCampaign & { userId: number },
  ): Promise<Campaign> {
    const id = await this.getNextId("campaign");
    const campaign: Campaign = {
      id,
      userId: data.userId,
      campaignId: data.campaignId,
      name: data.name,
      description: data.description || null,
      status: data.status || "draft",
      startDate: data.startDate || null,
      createdAt: new Date(),
      totalCompanies: data.totalCompanies || 0,
    };

    await this.set(`campaign:${data.userId}:${data.campaignId}`, campaign);
    return campaign;
  }

  async updateCampaign(
    id: number,
    updates: Partial<Campaign>,
    userId: number,
  ): Promise<Campaign | undefined> {
    const campaign = await this.getCampaign(id, userId);
    if (!campaign) return undefined;

    const updated = { ...campaign, ...updates };
    await this.set(`campaign:${userId}:${id}`, updated);
    return updated;
  }

  async getNextCampaignId(): Promise<number> {
    const keys = await this.list("campaign:");
    let maxId = 2000;

    for (const key of keys) {
      const campaign = await this.get<Campaign>(key);
      if (campaign && campaign.campaignId > maxId) {
        maxId = campaign.campaignId;
      }
    }

    return maxId + 1;
  }

  // Campaign Lists
  async addListToCampaign(data: InsertCampaignList): Promise<CampaignList> {
    const id = await this.getNextId("campaign_list");
    const campaignList: CampaignList = {
      id,
      campaignId: data.campaignId,
      listId: data.listId,
      createdAt: new Date(),
    };

    await this.set(
      `campaign_list:${data.campaignId}:${data.listId}`,
      campaignList,
    );
    return campaignList;
  }

  async removeListFromCampaign(
    campaignId: number,
    listId: number,
  ): Promise<void> {
    await this.delete(`campaign_list:${campaignId}:${listId}`);
  }

  async getListsByCampaign(campaignId: number): Promise<List[]> {
    const keys = await this.list(`campaign_list:${campaignId}:`);
    const lists: List[] = [];

    for (const key of keys) {
      const campaignList = await this.get<CampaignList>(key);
      if (campaignList) {
        const list = await this.get<List>(`list:${campaignList.listId}`);
        if (list) lists.push(list);
      }
    }

    return lists;
  }

  async updateCampaignTotalCompanies(campaignId: number): Promise<void> {
    // Implementation for updating campaign total companies
  }

  // Email Templates
  async getEmailTemplate(
    id: number,
    userId: number,
  ): Promise<EmailTemplate | undefined> {
    return this.get<EmailTemplate>(`template:${userId}:${id}`);
  }

  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    const keys = await this.list(`template:${userId}:`);
    const templates: EmailTemplate[] = [];

    for (const key of keys) {
      const template = await this.get<EmailTemplate>(key);
      if (template) templates.push(template);
    }

    return templates;
  }

  async createEmailTemplate(
    data: InsertEmailTemplate & { userId: number },
  ): Promise<EmailTemplate> {
    const id = await this.getNextId("template");
    const template: EmailTemplate = {
      id,
      userId: data.userId,
      name: data.name,
      subject: data.subject,
      content: data.content,
      description: data.description || null,
      category: data.category || "general",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.set(`template:${data.userId}:${id}`, template);
    return template;
  }

  async updateEmailTemplate(
    id: number,
    updates: Partial<EmailTemplate>,
    userId: number,
  ): Promise<EmailTemplate | undefined> {
    const template = await this.getEmailTemplate(id, userId);
    if (!template) return undefined;

    const updated = { ...template, ...updates, updatedAt: new Date() };
    await this.set(`template:${userId}:${id}`, updated);
    return updated;
  }

  async deleteEmailTemplate(id: number, userId: number): Promise<void> {
    await this.delete(`template:${userId}:${id}`);
  }

  // Contact Search and Enrichment
  async searchContactDetails(contactInfo: {
    name: string;
    company: string;
  }): Promise<Partial<Contact>> {
    // Implementation for contact search details
    return {};
  }

  // Contact Validation and Feedback
  async addContactFeedback(
    data: InsertContactFeedback,
  ): Promise<ContactFeedback> {
    const id = await this.getNextId("contact_feedback");
    const feedback: ContactFeedback = {
      id,
      contactId: data.contactId,
      feedbackType: data.feedbackType,
      createdAt: new Date(),
    };

    await this.set(`contact_feedback:${data.contactId}:${id}`, feedback);
    return feedback;
  }

  async getContactFeedback(contactId: number): Promise<ContactFeedback[]> {
    const keys = await this.list(`contact_feedback:${contactId}:`);
    const feedback: ContactFeedback[] = [];

    for (const key of keys) {
      const item = await this.get<ContactFeedback>(key);
      if (item) feedback.push(item);
    }

    return feedback;
  }

  async updateContactConfidenceScore(
    id: number,
    score: number,
  ): Promise<Contact | undefined> {
    return this.updateContact(id, { nameConfidenceScore: score });
  }

  async updateContactValidationStatus(
    id: number,
  ): Promise<Contact | undefined> {
    return this.updateContact(id, { lastValidated: new Date() });
  }

  // Search Test Results
  async getSearchTestResult(id: number): Promise<SearchTestResult | undefined> {
    return this.get<SearchTestResult>(`search_test_result:${id}`);
  }

  async listSearchTestResults(userId: number): Promise<SearchTestResult[]> {
    const keys = await this.list(`search_test_result:${userId}:`);
    const results: SearchTestResult[] = [];

    for (const key of keys) {
      const result = await this.get<SearchTestResult>(key);
      if (result) results.push(result);
    }

    return results;
  }

  async getTestResultsByStrategy(
    strategyId: number,
    userId: number,
  ): Promise<SearchTestResult[]> {
    const results = await this.listSearchTestResults(userId);
    return results.filter((r) => r.strategyId === strategyId);
  }

  async createSearchTestResult(
    data: InsertSearchTestResult,
  ): Promise<SearchTestResult> {
    const id = await this.getNextId("search_test_result");
    const result: SearchTestResult = {
      id,
      userId: data.userId,
      strategyId: data.strategyId,
      status: data.status,
      metadata: data.metadata,
      createdAt: new Date(),
    };

    await this.set(`search_test_result:${data.userId}:${id}`, result);
    return result;
  }

  async updateTestResultStatus(
    id: number,
    status: "completed" | "running" | "failed",
    metadata?: Record<string, unknown>,
  ): Promise<SearchTestResult> {
    const result = await this.getSearchTestResult(id);
    if (!result) throw new Error("Test result not found");

    const updated = {
      ...result,
      status,
      metadata: metadata || result.metadata,
    };
    await this.set(`search_test_result:${result.userId}:${id}`, updated);
    return updated;
  }

  async getStrategyPerformanceHistory(
    strategyId: number,
    userId: number,
  ): Promise<{ dates: string[]; scores: number[] }> {
    const results = await this.getTestResultsByStrategy(strategyId, userId);
    const dates = results.map((r) => r.createdAt.toISOString().split("T")[0]);
    const scores = results.map((r) => (r.metadata as any)?.score || 0);

    return { dates, scores };
  }
}

// Export storage instance
export const storage = new ReplitStorage();
