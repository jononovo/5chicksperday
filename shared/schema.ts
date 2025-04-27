import { pgTable, text, serial, integer, jsonb, timestamp, boolean, uuid, index } from "drizzle-orm/pg-core";
import { z } from "zod";

export const webhookLogs = pgTable(
  "webhook_logs", 
  {
    id: serial("id").primaryKey(),
    requestId: text("request_id").notNull(),
    searchId: text("search_id"),
    source: text("source").notNull(),  // Format: "provider-operation" (e.g. "workflow-send", "workflow-receive")
    method: text("method"),
    url: text("url"),
    headers: jsonb("headers").default({}),
    body: jsonb("body").default({}),
    status: text("status").default("pending"), // pending, success, error
    statusCode: integer("status_code"),
    processingDetails: jsonb("processing_details").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      requestIdIdx: index("webhook_logs_request_id_idx").on(table.requestId),
      searchIdIdx: index("webhook_logs_search_id_idx").on(table.searchId),
      sourceIdx: index("webhook_logs_source_idx").on(table.source)
    };
  }
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),  
  listId: integer("list_id").notNull(),
  prompt: text("prompt").notNull(),
  resultCount: integer("result_count").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  listId: integer("list_id"),  
  age: integer("age"),
  size: integer("size"),
  website: text("website"),
  alternativeProfileUrl: text("alternative_profile_url"), 
  defaultContactEmail: text("default_contact_email"), 
  ranking: integer("website_ranking"),
  linkedinProminence: integer("linkedin_prominence"),
  customerCount: integer("customer_count"),
  rating: integer("rating"),
  services: text("services").array(),
  validationPoints: text("validation_points").array(),
  differentiation: text("differentiation").array(),
  totalScore: integer("total_score"),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("created_at").defaultNow()
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  alternativeEmails: text("alternative_emails").array(), // Added support for multiple email addresses
  probability: integer("probability"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  phoneNumber: text("phone_number"),
  department: text("department"),
  location: text("location"),
  verificationSource: text("verification_source"),
  lastEnriched: timestamp("last_enriched"),
  nameConfidenceScore: integer("name_confidence_score"), 
  userFeedbackScore: integer("user_feedback_score"), 
  feedbackCount: integer("feedback_count").default(0), 
  lastValidated: timestamp("last_validated"), 
  createdAt: timestamp("created_at").defaultNow(),
  completedSearches: text("completed_searches").array()
});

export const contactFeedback = pgTable("contact_feedback", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  feedbackType: text("feedback_type").notNull(), 
  createdAt: timestamp("created_at").defaultNow()
});

export const searchApproaches = pgTable("search_approaches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  order: integer("order").notNull(),
  active: boolean("active").default(true),
  config: jsonb("config").default({}).notNull(),
  completedSearches: text("completed_searches").array(),
  technicalPrompt: text("technical_prompt"),
  responseStructure: text("response_structure"),
  moduleType: text("module_type").default('company_overview'),  
  validationRules: jsonb("validation_rules").default({})  
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default('draft'),  
  startDate: timestamp("start_date"),
  createdAt: timestamp("created_at").defaultNow(),
  totalCompanies: integer("total_companies").default(0)
});

export const campaignLists = pgTable("campaign_lists", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  listId: integer("list_id").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  category: text("category").default('general'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  hasSeenTour: boolean("has_seen_tour").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// New table for storing search test results
export const searchTestResults = pgTable("search_test_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  strategyId: integer("strategy_id").notNull().references(() => searchApproaches.id),
  testId: uuid("test_id").notNull(),
  query: text("query").notNull(),
  companyQuality: integer("company_quality").notNull(),
  contactQuality: integer("contact_quality").notNull(),
  emailQuality: integer("email_quality").notNull(),
  overallScore: integer("overall_score").notNull(),
  status: text("status").default("completed"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow()
});

// N8N Workflow tables have been removed

const listSchema = z.object({
  listId: z.number().min(1001),
  prompt: z.string().min(1, "Search prompt is required"),
  resultCount: z.number().min(0)
});

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  listId: z.number().nullable(),
  age: z.number().nullable(),
  size: z.number().nullable(),
  website: z.string().nullable(),
  alternativeProfileUrl: z.string().nullable(),
  defaultContactEmail: z.string().email().nullable(),
  ranking: z.number().nullable(),
  linkedinProminence: z.number().nullable(),
  customerCount: z.number().nullable(),
  rating: z.number().nullable(),
  services: z.array(z.string()).nullable(),
  validationPoints: z.array(z.string()).nullable(),
  differentiation: z.array(z.string()).nullable(),
  totalScore: z.number().nullable(),
  snapshot: z.record(z.unknown()).nullable()
});

const contactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  companyId: z.number(),
  role: z.string().nullable(),
  email: z.string().email().nullable(),
  probability: z.number().min(1).max(100).nullable(),
  linkedinUrl: z.string().url().nullable(),
  twitterHandle: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  verificationSource: z.string().nullable(),
  nameConfidenceScore: z.number().min(0).max(100).nullable(),
  userFeedbackScore: z.number().min(0).max(100).nullable(),
  feedbackCount: z.number().min(0).nullable(),
  completedSearches: z.array(z.string()).optional()
});

const contactFeedbackSchema = z.object({
  contactId: z.number(),
  feedbackType: z.enum(['excellent', 'ok', 'terrible'])
});

export const searchModuleConfigSchema = z.object({
  subsearches: z.record(z.boolean()).default({}),
  searchOptions: z.object({
    ignoreFranchises: z.boolean().default(false),
    locallyHeadquartered: z.boolean().default(false)
  }).default({}),
  searchSections: z.record(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    subsectionRef: z.string().optional(),
    searches: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string(),
      implementation: z.string().optional(),
      validationRules: z.record(z.unknown()).optional()
    }))
  })).default({}),
  validationRules: z.object({
    requiredFields: z.array(z.string()).default([]),
    scoreThresholds: z.record(z.number()).default({}),
    minimumConfidence: z.number().default(0)
  }).default({})
});

export const searchSequenceSchema = z.object({
  modules: z.array(z.enum([
    'company_overview',
    'decision_maker',
    'email_discovery',
    'email_enrichment',
    'email_deepdive'
  ])),
  moduleConfigs: z.record(z.any()),
  validationStrategy: z.enum(['strict', 'moderate', 'lenient']).default('moderate')
});

export const searchApproachSchema = z.object({
  name: z.string().min(1, "Name is required"),
  prompt: z.string().min(1, "Prompt is required"),
  order: z.number().min(1),
  active: z.boolean().nullable(),
  config: searchModuleConfigSchema,
  completedSearches: z.array(z.string()).optional(),
  technicalPrompt: z.string().optional(),
  responseStructure: z.string().optional(),
  moduleType: z.enum([
    'company_overview',
    'decision_maker',
    'email_discovery',
    'email_enrichment',
    'email_deepdive'
  ]).default('company_overview'),
  sequence: searchSequenceSchema.optional(),
  validationRules: z.record(z.unknown()).default({})
});

const campaignSchema = z.object({
  campaignId: z.number().min(2001),
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'paused']).default('draft'),
  startDate: z.string().nullable(),
  totalCompanies: z.number().default(0)
});

const campaignListSchema = z.object({
  campaignId: z.number(),
  listId: z.number()
});

const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  description: z.string().optional(),
  category: z.string().default('general')
});

const userPreferencesSchema = z.object({
  userId: z.number(),
  hasSeenTour: z.boolean().default(false)
});

const searchTestResultSchema = z.object({
  userId: z.number(),
  strategyId: z.number(),
  testId: z.string().uuid(),
  query: z.string(),
  companyQuality: z.number().min(0).max(100),
  contactQuality: z.number().min(0).max(100),
  emailQuality: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  status: z.enum(['completed', 'running', 'failed']).default('completed'),
  metadata: z.record(z.unknown()).optional()
});

// N8N Workflow schemas have been removed

export const insertListSchema = listSchema.extend({
  userId: z.number()
});
export const insertCompanySchema = companySchema;
export const insertContactSchema = contactSchema;
export const insertSearchApproachSchema = searchApproachSchema;
export const insertCampaignSchema = campaignSchema.extend({
  userId: z.number()
});
export const insertCampaignListSchema = campaignListSchema;
export const insertEmailTemplateSchema = emailTemplateSchema.extend({
  userId: z.number()
});
export const insertContactFeedbackSchema = contactFeedbackSchema;
export const insertUserPreferencesSchema = userPreferencesSchema;
export const insertSearchTestResultSchema = searchTestResultSchema;

export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type SearchApproach = typeof searchApproaches.$inferSelect;
export type InsertSearchApproach = z.infer<typeof insertSearchApproachSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignList = typeof campaignLists.$inferSelect;
export type InsertCampaignList = z.infer<typeof insertCampaignListSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type ContactFeedback = typeof contactFeedback.$inferSelect;
export type InsertContactFeedback = z.infer<typeof insertContactFeedbackSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type SearchTestResult = typeof searchTestResults.$inferSelect;
export type InsertSearchTestResult = z.infer<typeof insertSearchTestResultSchema>;

// N8N workflow types have been removed

// Add user schema and type
export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const insertUserSchema = userSchema;

// Add User type
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type SearchModuleConfig = z.infer<typeof searchModuleConfigSchema>;
export type SearchSequence = z.infer<typeof searchSequenceSchema>;
export type SearchImplementation = {
  execute: (context: any) => Promise<any>;
  validate?: (result: any) => Promise<boolean>;
  name: string;
  description: string;
};