import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const lists = pgTable("lists", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull(),  // This will start from 1001
  prompt: text("prompt").notNull(),
  resultCount: integer("result_count").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  listId: integer("list_id"),  // Reference to the list this company belongs to
  age: integer("age"),
  size: integer("size"),
  website: text("website"),
  alternativeProfileUrl: text("alternative_profile_url"), // New field for GMB, Yelp etc
  defaultContactEmail: text("default_contact_email"), // New field for company-wide contact
  ranking: integer("website_ranking"),
  linkedinProminence: integer("linkedin_prominence"),
  customerCount: integer("customer_count"),
  rating: integer("rating"),
  services: text("services").array(),
  validationPoints: text("validation_points").array(),
  differentiation: text("differentiation").array(),
  totalScore: integer("total_score"),
  snapshot: jsonb("snapshot"),
  // Additional fields for Rabbit provider
  industry: text("industry"),
  location: text("location"),
  description: text("description"),
  employeeCount: integer("employee_count"),
  foundedYear: integer("founded_year"),
  revenue: text("revenue"),
  socialProfiles: jsonb("social_profiles"),
  technologiesUsed: text("technologies_used").array(),
  productOfferings: text("product_offerings").array(),
  headquarters: text("headquarters"),
  createdAt: timestamp("created_at").defaultNow()
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  probability: integer("probability"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  phoneNumber: text("phone_number"),
  department: text("department"),
  location: text("location"),
  verificationSource: text("verification_source"),
  lastEnriched: timestamp("last_enriched"),
  // New fields for name validation
  nameConfidenceScore: integer("name_confidence_score"), // AI-generated score
  userFeedbackScore: integer("user_feedback_score"), // Aggregate user feedback
  feedbackCount: integer("feedback_count").default(0), // Number of feedback entries
  lastValidated: timestamp("last_validated"), // Last AI validation timestamp
  createdAt: timestamp("created_at").defaultNow(),
  completedSearches: text("completed_searches").array()
});

export const contactFeedback = pgTable("contact_feedback", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  feedbackType: text("feedback_type").notNull(), // 'excellent', 'ok', 'terrible'
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
  moduleType: text("module_type").default('company_overview'),  // New field
  validationRules: jsonb("validation_rules").default({})  // New field
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),  // This will start from 2001
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default('draft'),  // draft, active, completed, paused
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
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  category: text("category").default('general'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

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
  snapshot: z.record(z.unknown()).nullable(),
  // Additional fields for Rabbit provider
  industry: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  employeeCount: z.number().nullable(),
  foundedYear: z.number().nullable(),
  revenue: z.string().nullable(),
  socialProfiles: z.record(z.unknown()).nullable(),
  technologiesUsed: z.array(z.string()).nullable(),
  productOfferings: z.array(z.string()).nullable(),
  headquarters: z.string().nullable()
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

const searchModuleConfigSchema = z.object({
  subsearches: z.record(z.boolean()).default({}),
  searchOptions: z.object({
    ignoreFranchises: z.boolean().default(false),
    locallyHeadquartered: z.boolean().default(false)
  }).default({}),
  searchSections: z.record(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    subsectionRef: z.string().optional(), // New field to reference external subsection definitions
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

const searchApproachSchema = z.object({
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

export const insertListSchema = listSchema;
export const insertCompanySchema = companySchema;
export const insertContactSchema = contactSchema;
export const insertSearchApproachSchema = searchApproachSchema;
export const insertCampaignSchema = campaignSchema;
export const insertCampaignListSchema = campaignListSchema;
export const insertEmailTemplateSchema = emailTemplateSchema;
export const insertContactFeedbackSchema = contactFeedbackSchema;

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

export type SearchModuleConfig = z.infer<typeof searchModuleConfigSchema>;
export type SearchSection = SearchModuleConfig['searchSections'][string];
export type SearchImplementation = SearchSection['searches'][number];