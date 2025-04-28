import { 
  userPreferences, lists, companies, contacts, campaigns, emailTemplates, searchApproaches, users, searchTestResults,
  type UserPreferences, type InsertUserPreferences,
  type List, type InsertList,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type Campaign, type InsertCampaign,
  type EmailTemplate, type InsertEmailTemplate,
  type SearchApproach, type InsertSearchApproach,
  type User, type InsertUser,
  type SearchTestResult, type InsertSearchTestResult
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  createUser(data: { email: string; password: string; username?: string }): Promise<User>;

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

  // Search Approaches
  getSearchApproach(id: number): Promise<SearchApproach | undefined>;
  listSearchApproaches(): Promise<SearchApproach[]>;
  updateSearchApproach(id: number, data: Partial<SearchApproach>): Promise<SearchApproach>;
  initializeDefaultSearchApproaches(): Promise<void>;

  // Search Test Results
  getSearchTestResult(id: number): Promise<SearchTestResult | undefined>;
  listSearchTestResults(userId: number): Promise<SearchTestResult[]>;
  getTestResultsByStrategy(strategyId: number, userId: number): Promise<SearchTestResult[]>;
  createSearchTestResult(result: InsertSearchTestResult): Promise<SearchTestResult>;
  updateTestResultStatus(id: number, status: 'completed' | 'running' | 'failed', metadata?: Record<string, unknown>): Promise<SearchTestResult>;
  getStrategyPerformanceHistory(strategyId: number, userId: number): Promise<{ dates: string[], scores: number[] }>;
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
    console.log('DatabaseStorage.initializeUserPreferences - Creating preferences and default templates for userId:', userId);
    const [prefs] = await db
      .insert(userPreferences)
      .values({ userId, hasSeenTour: false })
      .returning();

    // Initialize default email templates
    const defaultTemplates = [
      {
        name: "Professional Introduction",
        subject: "Exploring Partnership Opportunities with [Company]",
        content: "Dear [Name],\n\nI hope this email finds you well. I came across [Company] and was impressed by your work in [Industry]. I believe there might be some interesting opportunities for collaboration between our organizations.\n\nWould you be open to a brief conversation to explore potential synergies?\n\nBest regards,\n[Your Name]",
        description: "A professional first contact template",
        category: "outreach",
        userId
      },
      {
        name: "Follow-up",
        subject: "Following up on our previous conversation",
        content: "Hi [Name],\n\nI wanted to follow up on our previous conversation about [Topic]. Have you had a chance to review the information I shared?\n\nI'm happy to provide any additional details or address any questions you might have.\n\nBest regards,\n[Your Name]",
        description: "A gentle follow-up template",
        category: "follow-up",
        userId
      },
      {
        name: "Product Demo Request",
        subject: "Quick demo of our solution for [Company]",
        content: "Hello [Name],\n\nI'd love to show you how our solution could help [Company] with [specific pain point]. Would you be available for a 15-minute demo this week?\n\nI can be flexible with timing to accommodate your schedule.\n\nBest regards,\n[Your Name]",
        description: "Template for requesting a product demo",
        category: "sales",
        userId
      }
    ];

    try {
      console.log('Creating default email templates...');
      for (const template of defaultTemplates) {
        await this.createEmailTemplate(template);
      }
      console.log('Default email templates created successfully');
    } catch (error) {
      console.error('Error creating default templates:', error);
      // Don't throw error here as preferences were already created
    }

    return prefs;
  }

  // Lists
  async listLists(userId: number): Promise<List[]> {
    return db.select().from(lists).where(eq(lists.userId, userId));
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
    const [result] = await db.select({ maxId: lists.listId }).from(lists);
    return (result?.maxId || 1000) + 1;
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
    const [company] = await db.insert(companies).values(data).returning();
    return company;
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
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact> {
    const [updated] = await db.update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContactsByCompany(companyId: number, userId: number): Promise<void> {
    await db.delete(contacts)
      .where(and(eq(contacts.companyId, companyId), eq(contacts.userId, userId)));
  }

  // Campaigns
  async listCampaigns(userId: number): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaign(id: number, userId: number): Promise<Campaign | undefined> {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.campaignId, id), eq(campaigns.userId, userId)));
    return campaign;
  }

  async getNextCampaignId(): Promise<number> {
    const [result] = await db.select({ maxId: campaigns.campaignId }).from(campaigns);
    return (result?.maxId || 2000) + 1;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(data).returning();
    return campaign;
  }

  async updateCampaign(id: number, data: Partial<Campaign>, userId: number): Promise<Campaign> {
    const [updated] = await db.update(campaigns)
      .set(data)
      .where(and(eq(campaigns.campaignId, id), eq(campaigns.userId, userId)))
      .returning();
    return updated;
  }

  // Email Templates
  async listEmailTemplates(userId: number): Promise<EmailTemplate[]> {
    console.log('DatabaseStorage.listEmailTemplates called for userId:', userId);
    return db.select().from(emailTemplates).where(eq(emailTemplates.userId, userId));
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

  // Search Approaches
  async getSearchApproach(id: number): Promise<SearchApproach | undefined> {
    const [approach] = await db
      .select()
      .from(searchApproaches)
      .where(eq(searchApproaches.id, id));
    return approach;
  }
  
  async listSearchApproaches(): Promise<SearchApproach[]> {
    return db.select().from(searchApproaches);
  }

  async createSearchApproach(data: InsertSearchApproach): Promise<SearchApproach> {
    console.log('DatabaseStorage.createSearchApproach called with:', { name: data.name });
    try {
      const [approach] = await db
        .insert(searchApproaches)
        .values(data)
        .returning();
      console.log('Created search approach:', { id: approach.id, name: approach.name });
      return approach;
    } catch (error) {
      console.error('Error creating search approach:', error);
      throw error;
    }
  }

  async updateSearchApproach(id: number, data: Partial<SearchApproach>): Promise<SearchApproach> {
    const [updated] = await db.update(searchApproaches)
      .set(data)
      .where(eq(searchApproaches.id, id))
      .returning();
    return updated;
  }
  
  async deleteSearchApproach(id: number): Promise<void> {
    await db.delete(searchApproaches).where(eq(searchApproaches.id, id));
  }
  
  // Search Test Results
  async getSearchTestResult(id: number): Promise<SearchTestResult | undefined> {
    const [result] = await db
      .select()
      .from(searchTestResults)
      .where(eq(searchTestResults.id, id));
    return result;
  }
  
  async listSearchTestResults(userId: number): Promise<SearchTestResult[]> {
    return db
      .select()
      .from(searchTestResults)
      .where(eq(searchTestResults.userId, userId));
  }
  
  async getTestResultsByStrategy(strategyId: number, userId: number): Promise<SearchTestResult[]> {
    return db
      .select()
      .from(searchTestResults)
      .where(and(
        eq(searchTestResults.strategyId, strategyId),
        eq(searchTestResults.userId, userId)
      ));
  }
  
  async createSearchTestResult(result: InsertSearchTestResult): Promise<SearchTestResult> {
    console.log('DatabaseStorage.createSearchTestResult - Creating search test result:', result);
    const [created] = await db
      .insert(searchTestResults)
      .values(result)
      .returning();
    return created;
  }
  
  async updateTestResultStatus(id: number, status: 'completed' | 'running' | 'failed', metadata?: Record<string, unknown>): Promise<SearchTestResult> {
    const [updated] = await db
      .update(searchTestResults)
      .set({ 
        status,
        ...metadata ? { metadata } : {},
        updatedAt: new Date()
      })
      .where(eq(searchTestResults.id, id))
      .returning();
    return updated;
  }
  
  async getStrategyPerformanceHistory(strategyId: number, userId: number): Promise<{ dates: string[], scores: number[] }> {
    const results = await db
      .select()
      .from(searchTestResults)
      .where(and(
        eq(searchTestResults.strategyId, strategyId),
        eq(searchTestResults.userId, userId),
        eq(searchTestResults.status, 'completed')
      ))
      .orderBy(searchTestResults.createdAt);
    
    return {
      dates: results.map(r => r.createdAt?.toISOString().split('T')[0] || ''),
      scores: results.map(r => r.overallScore || 0)
    };
  }

  async initializeDefaultSearchApproaches(): Promise<void> {
    console.log('Initializing default search approaches...');
    
    // Define our new advanced key contact discovery approach
    const advancedApproach = {
      name: "Advanced Key Contact Discovery",
      prompt: "Enhanced discovery of decision makers with leadership role prioritization",
      order: 0,
      active: true,
      moduleType: "company_overview",
      sequence: {
        modules: ['company_overview', 'decision_maker', 'email_discovery', 'email_deepdive'],
        moduleConfigs: {
          company_overview: {
            subsearches: { 
              'small-business-validation': true,
              'company-size-analysis': true 
            },
            searchOptions: { 
              ignoreFranchises: true,
              locallyHeadquartered: true,
              focusOnLeadership: true
            }
          },
          decision_maker: {
            subsearches: { 
              'owner-identification': true,
              'leadership-role-validation': true,
              'enhanced-name-validation': true
            },
            searchOptions: { 
              requireRole: true,
              roleMinimumScore: 85,
              minimumNameScore: 80,
              preferFullNames: true
            }
          },
          email_discovery: {
            subsearches: { 
              'direct-contact-discovery': true,
              'enhanced-pattern-prediction-search': true,
              'domain-analysis-search': true
            },
            searchOptions: { 
              validatePatterns: true,
              useEnhancedValidation: true,
              crossReferenceValidation: true
            }
          },
          email_deepdive: {
            subsearches: {
              'leadership-email-verification': true
            },
            searchOptions: {
              focusOnLeadership: true
            }
          }
        },
        validationStrategy: 'strict'
      },
      config: {
        subsearches: {
          'leadership-role-validation': true,
          'enhanced-name-validation': true
        },
        searchOptions: {
          focusOnLeadership: true
        },
        searchSections: {
          'leadership-identification': {
            priority: 'high',
            required: true
          }
        },
        validationRules: {
          requiredFields: ["name", "role"],
          scoreThresholds: { 
            roleConfidence: 85,
            nameConfidence: 80,
            emailConfidence: 75
          },
          minimumConfidence: 80,
          founder_multiplier: 2.0,
          c_level_multiplier: 1.8,
          director_multiplier: 1.5
        }
      },
      validationRules: {
        nameValidation: {
          minimumScore: 80,
          businessTermPenalty: 25,
          preferFullNames: true,
          filterGenericNames: true,
          requireRole: true
        },
        emailValidation: {
          minimumScore: 75,
          patternScore: 0.7,
          businessDomainScore: 0.8,
          placeholderCheck: true
        }
      },
      completedSearches: [
        'leadership-role-validation',
        'enhanced-name-validation',
        'domain-analysis-search'
      ]
    };

    // Check if this approach already exists
    const [exists] = await db
      .select()
      .from(searchApproaches)
      .where(eq(searchApproaches.name, "Advanced Key Contact Discovery"));

    // If it doesn't exist, create it
    if (!exists) {
      console.log('Creating Advanced Key Contact Discovery approach...');
      await db.insert(searchApproaches).values(advancedApproach);
    } else {
      console.log('Advanced Key Contact Discovery approach already exists, updating...');
      await db.update(searchApproaches)
        .set(advancedApproach)
        .where(eq(searchApproaches.id, exists.id));
    }

    console.log('Default search approaches initialized successfully.');
  }
}

export const storage = new DatabaseStorage();