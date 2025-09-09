import { pgTable, text, serial, integer, jsonb, timestamp, boolean, uuid, index } from "drizzle-orm/pg-core";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isGuest: boolean("is_guest").default(false)
});

export const lists = pgTable("lists", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),  
  listId: integer("list_id").notNull(),
  prompt: text("prompt").notNull(),
  resultCount: integer("result_count").notNull(),
  customSearchTargets: jsonb("custom_search_targets").default('[]'),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_lists_user_id').on(table.userId),
  index('idx_lists_list_id').on(table.listId),
]);

export const companies = pgTable("companies", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  listId: integer("list_id"),  
  description: text("description"),
  age: integer("age"),
  size: integer("size"),
  website: text("website"),
  alternativeProfileUrl: text("alternative_profile_url"), 
  defaultContactEmail: text("default_contact_email"), 
  ranking: integer("website_ranking"),
  linkedinProminence: integer("linkedin_prominence"),
  customerCount: integer("customer_count"),
  rating: integer("rating"),
  services: jsonb("services").default('[]'),
  validationPoints: jsonb("validation_points").default('[]'),
  differentiation: jsonb("differentiation").default('[]'),
  totalScore: integer("total_score"),
  snapshot: jsonb("snapshot"),
  // Company tracking fields
  companyStatus: text("company_status").default('uncontacted'), // 'uncontacted' | 'contacted' | 'skipped'
  skipReason: text("skip_reason"), // 'not_fit' | 'not_now' 
  skipUntilDate: timestamp("skip_until_date", { withTimezone: true }), // When to reconsider if skipped temporarily
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_companies_user_id').on(table.userId),
  index('idx_companies_list_id').on(table.listId),
  index('idx_companies_name').on(table.name),
  index('idx_companies_status').on(table.companyStatus),
]);

export const contacts = pgTable("contacts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  alternativeEmails: jsonb("alternative_emails").$type<string[]>().default([]),
  probability: integer("probability"),
  linkedinUrl: text("linkedin_url"),
  twitterHandle: text("twitter_handle"),
  phoneNumber: text("phone_number"),
  department: text("department"),
  location: text("location"),
  verificationSource: text("verification_source"),
  lastEnriched: timestamp("last_enriched", { withTimezone: true }),
  nameConfidenceScore: integer("name_confidence_score"), 
  userFeedbackScore: integer("user_feedback_score"), 
  feedbackCount: integer("feedback_count").default(0), 
  lastValidated: timestamp("last_validated", { withTimezone: true }), 
  // Contact tracking fields
  contactStatus: text("contact_status").default('uncontacted'), // 'uncontacted' | 'emailed' | 'skipped'
  lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
  emailCount: integer("email_count").default(0),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedSearches: jsonb("completed_searches").$type<string[]>().default([])
}, (table) => [
  index('idx_contacts_company_id').on(table.companyId),
  index('idx_contacts_user_id').on(table.userId),
  index('idx_contacts_email').on(table.email),
  index('idx_contacts_status').on(table.contactStatus),
]);

/* 
// ====================================================
// INACTIVE FEATURE - CONTACT FEEDBACK (NOT CURRENTLY PUSHED)
// ====================================================
// Uncomment when contact rating functionality is activated

export const contactFeedback = pgTable("contact_feedback", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  contactId: integer("contact_id").notNull(),
  feedbackType: text("feedback_type").notNull(), 
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_contact_feedback_contact_id').on(table.contactId),
]);
*/



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
  // hasSeenTour field removed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Email sending preferences for fallback system
export const userEmailPreferences = pgTable("user_email_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  preferredMethod: text("preferred_method").default('smart-default'), // 'smart-default' | 'gmail' | 'outlook' | 'default-app' | 'ask-always'
  hasSeenFirstTimeModal: boolean("has_seen_first_time_modal").default(false),
  hasSeenIOSNotification: boolean("has_seen_ios_notification").default(false),
  hasSeenAndroidNotification: boolean("has_seen_android_notification").default(false),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  lastUsedMethod: text("last_used_method"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Email activity tracking - stores record of every email sent to contacts
export const emailActivities = pgTable("email_activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  senderEmail: text("sender_email").notNull(), // Which email address was used to send
  recipientEmail: text("recipient_email").notNull(),
  emailType: text("email_type").default('manual'), // 'manual' | 'campaign' | 'daily_outreach'
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }),
  repliedAt: timestamp("replied_at", { withTimezone: true })
}, (table) => [
  index('idx_email_activities_user_id').on(table.userId),
  index('idx_email_activities_contact_id').on(table.contactId),
  index('idx_email_activities_company_id').on(table.companyId),
]);

// Daily outreach batches - stores batches of contacts for daily email outreach
export const dailyOutreachBatches = pgTable("daily_outreach_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(), // Secure token for public access
  contacts: jsonb("contacts").$type<number[]>().default([]), // Array of contact IDs
  emails: jsonb("emails").$type<any[]>().default([]), // Generated email content for each contact
  status: text("status").default('pending'), // 'pending' | 'partial' | 'completed' | 'expired'
  contactsEmailed: jsonb("contacts_emailed").$type<number[]>().default([]), // Tracks which contacts were emailed
  contactsSkipped: jsonb("contacts_skipped").$type<number[]>().default([]), // Tracks which contacts were skipped
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }), // When notification email was sent
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_daily_batches_user_id').on(table.userId),
  index('idx_daily_batches_token').on(table.token),
  index('idx_daily_batches_status').on(table.status),
]);

// User outreach preferences - controls daily outreach settings
export const userOutreachPreferences = pgTable("user_outreach_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  enabled: boolean("enabled").default(true),
  schedule: jsonb("schedule").$type<{days: string[], time: string}>().default({days: ['mon','tue','wed'], time: '09:00'}),
  timezone: text("timezone").default('America/New_York'),
  emailsPerBatch: integer("emails_per_batch").default(5),
  includeSearchPrompts: boolean("include_search_prompts").default(true), // Include suggested search prompts in urgent emails
  sendUrgentReminders: boolean("send_urgent_reminders").default(true), // Send urgent emails when low on contacts
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_outreach_prefs_user_id').on(table.userId),
]);



// N8N Workflow tables have been removed

const listSchema = z.object({
  listId: z.number().min(1001),
  prompt: z.string().min(1, "Search prompt is required"),
  resultCount: z.number().min(0),
  customSearchTargets: z.array(z.string()).nullable()
});

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  listId: z.number().nullable(),
  description: z.string().nullable(),
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
  // Company tracking fields
  companyStatus: z.enum(['uncontacted', 'contacted', 'skipped']).default('uncontacted'),
  skipReason: z.enum(['not_fit', 'not_now']).nullable(),
  skipUntilDate: z.string().nullable(), // ISO date string
  lastContactedAt: z.string().nullable(),
  skippedAt: z.string().nullable()
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
  alternativeEmails: z.array(z.string()).optional(),
  completedSearches: z.array(z.string()).optional(),
  // Contact tracking fields
  contactStatus: z.enum(['uncontacted', 'emailed', 'skipped']).default('uncontacted'),
  lastEmailedAt: z.string().nullable(),
  emailCount: z.number().default(0),
  skippedAt: z.string().nullable()
});

/* INACTIVE FEATURE SCHEMA - CONTACT FEEDBACK
const contactFeedbackSchema = z.object({
  contactId: z.number(),
  feedbackType: z.enum(['excellent', 'ok', 'terrible'])
});
*/





const emailTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  description: z.string().optional(),
  category: z.string().default('general')
});

const userPreferencesSchema = z.object({
  userId: z.number()
  // hasSeenTour field removed
});

const userEmailPreferencesSchema = z.object({
  preferredMethod: z.enum(['smart-default', 'gmail', 'outlook', 'default-app', 'ask-always']).default('smart-default'),
  hasSeenFirstTimeModal: z.boolean().default(false),
  hasSeenIOSNotification: z.boolean().default(false),
  hasSeenAndroidNotification: z.boolean().default(false),
  successCount: z.number().default(0),
  failureCount: z.number().default(0),
  lastUsedMethod: z.string().optional()
});

// Email activity schema
const emailActivitySchema = z.object({
  contactId: z.number(),
  companyId: z.number(),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  senderEmail: z.string().email("Invalid sender email"),
  recipientEmail: z.string().email("Invalid recipient email"),
  emailType: z.enum(['manual', 'campaign', 'daily_outreach']).default('manual'),
  sentAt: z.string().optional(),
  openedAt: z.string().nullable(),
  clickedAt: z.string().nullable(),
  repliedAt: z.string().nullable()
});

// Daily outreach batch schema
const dailyOutreachBatchSchema = z.object({
  token: z.string().min(32, "Token must be secure"),
  contacts: z.array(z.number()).default([]),
  emails: z.array(z.any()).default([]),
  status: z.enum(['pending', 'partial', 'completed', 'expired']).default('pending'),
  contactsEmailed: z.array(z.number()).default([]),
  contactsSkipped: z.array(z.number()).default([]),
  scheduledFor: z.string(), // ISO date string
  sentAt: z.string().nullable(),
  expiresAt: z.string() // ISO date string
});

// User outreach preferences schema
const userOutreachPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.object({
    days: z.array(z.string()),
    time: z.string()
  }).default({days: ['mon','tue','wed'], time: '09:00'}),
  timezone: z.string().default('America/New_York'),
  emailsPerBatch: z.number().min(1).max(20).default(5),
  includeSearchPrompts: z.boolean().default(true),
  sendUrgentReminders: z.boolean().default(true)
});



// N8N Workflow schemas have been removed

export const insertListSchema = listSchema.extend({
  userId: z.number()
});
export const insertCompanySchema = companySchema;
export const insertContactSchema = contactSchema;
export const insertEmailTemplateSchema = emailTemplateSchema.extend({
  userId: z.number()
});
export const insertUserPreferencesSchema = userPreferencesSchema;
export const insertUserEmailPreferencesSchema = userEmailPreferencesSchema.extend({
  userId: z.number()
});

export const insertEmailActivitySchema = emailActivitySchema.extend({
  userId: z.number()
});

export const insertDailyOutreachBatchSchema = dailyOutreachBatchSchema.extend({
  userId: z.number()
});

export const insertUserOutreachPreferencesSchema = userOutreachPreferencesSchema.extend({
  userId: z.number()
});

export type List = typeof lists.$inferSelect;
export type InsertList = z.infer<typeof insertListSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserEmailPreferences = typeof userEmailPreferences.$inferSelect;
export type InsertUserEmailPreferences = z.infer<typeof insertUserEmailPreferencesSchema>;

export type EmailActivity = typeof emailActivities.$inferSelect;
export type InsertEmailActivity = z.infer<typeof insertEmailActivitySchema>;

export type DailyOutreachBatch = typeof dailyOutreachBatches.$inferSelect;
export type InsertDailyOutreachBatch = z.infer<typeof insertDailyOutreachBatchSchema>;

export type UserOutreachPreferences = typeof userOutreachPreferences.$inferSelect;
export type InsertUserOutreachPreferences = z.infer<typeof insertUserOutreachPreferencesSchema>;

// N8N workflow types have been removed

// Add user schema and type
export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isGuest: z.boolean().optional()
});

export const insertUserSchema = userSchema;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Legacy type stubs for components that still import them
export type SearchSection = { id: string; title: string; content: string };

/* 
// ====================================================
// INACTIVE FEATURE - EMAIL CONVERSATIONS & WEBHOOKS (NOT CURRENTLY PUSHED)
// ====================================================
// Uncomment when email conversation tracking and webhook logging is activated

export const emailThreads = pgTable("email_threads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  subject: text("subject").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isArchived: boolean("is_archived").default(false)
});

export const emailMessages = pgTable("email_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => emailThreads.id),
  from: text("from").notNull(),
  fromEmail: text("from_email").notNull(),
  to: text("to").notNull(),
  toEmail: text("to_email").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
  direction: text("direction").notNull() // "outbound" or "inbound"
});

export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull(),
  searchId: text("search_id"),
  source: text("source").notNull(),  // Format: "provider-operation" (e.g. "n8n-send", "n8n-receive")
  method: text("method"),
  url: text("url"),
  headers: jsonb("headers").default({}),
  body: jsonb("body").default({}),
  status: text("status").default("pending"), // pending, success, error
  statusCode: integer("status_code"),
  processingDetails: jsonb("processing_details").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
*/

// Strategic onboarding tables
export const strategicProfiles = pgTable("strategic_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  businessType: text("business_type").notNull(), // "product" or "service"
  businessDescription: text("business_description").notNull(),
  uniqueAttributes: text("unique_attributes").array(),
  targetCustomers: text("target_customers").notNull(),
  marketNiche: text("market_niche"), // "niche" or "broad"
  // Enhanced product profile fields
  productService: text("product_service"), // What they sell
  customerFeedback: text("customer_feedback"), // What customers say
  website: text("website"), // Company website
  businessLocation: text("business_location"), // Where they're located
  primaryCustomerType: text("primary_customer_type"), // Who they sell to
  primarySalesChannel: text("primary_sales_channel"), // How they find customers
  primaryBusinessGoal: text("primary_business_goal"), // Main business objective
  // Strategy fields for cold email outreach
  strategyHighLevelBoundary: text("strategy_high_level_boundary"), // "3-4 star family-friendly hotels in coastal SE US"
  exampleSprintPlanningPrompt: text("example_sprint_planning_prompt"), // "family-friendly hotels on space coast, florida"
  exampleDailySearchQuery: text("example_daily_search_query"), // "family-friendly hotels in cocoa beach"
  productAnalysisSummary: text("product_analysis_summary"), // AI-generated product profile summary
  reportSalesContextGuidance: text("report_sales_context_guidance"), // AI-generated context for cold email approach
  reportSalesTargetingGuidance: text("report_sales_targeting_guidance"), // AI-generated targeting recommendations
  productOfferStrategies: text("product_offer_strategies"), // JSON array of 6 offer strategies
  dailySearchQueries: text("daily_search_queries"), // JSON array of 8 daily search queries from strategy
  strategicPlan: jsonb("strategic_plan").default({}),
  searchPrompts: text("search_prompts").array(),
  status: text("status").default("in_progress"), // "in_progress", "completed"
  isActive: boolean("is_active").default(false), // Track which product is active for email generation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const onboardingChats = pgTable("onboarding_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  profileId: integer("profile_id").notNull().references(() => strategicProfiles.id),
  messages: jsonb("messages").default([]),
  currentStep: text("current_step").default("business_description"),
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

/* 
// ====================================================
// INACTIVE FEATURE - PROSPECT DELIVERIES (NOT CURRENTLY PUSHED)
// ====================================================
// Uncomment when scheduled prospect delivery functionality is activated

export const prospectDeliveries = pgTable("prospect_deliveries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  profileId: integer("profile_id").notNull().references(() => strategicProfiles.id),
  searchPrompt: text("search_prompt").notNull(),
  deliveryDate: timestamp("delivery_date").notNull(),
  status: text("status").default("scheduled"), // "scheduled", "delivered", "failed"
  prospectCount: integer("prospect_count").default(0),
  createdAt: timestamp("created_at").defaultNow()
});
*/

// Define Schema for webhook logs
// Email conversation schemas
export const emailThreadSchema = z.object({
  contactId: z.number(),
  subject: z.string().min(1, "Subject is required"),
  isArchived: z.boolean().default(false)
});

export const emailMessageSchema = z.object({
  threadId: z.number(),
  from: z.string().min(1, "Sender name is required"),
  fromEmail: z.string().email("Invalid from email"),
  to: z.string().min(1, "Recipient name is required"),
  toEmail: z.string().email("Invalid to email"),
  content: z.string().min(1, "Message content is required"),
  isRead: z.boolean().default(false),
  direction: z.enum(["outbound", "inbound"])
});

export const webhookLogSchema = z.object({
  requestId: z.string(),
  searchId: z.string().optional(),
  source: z.string(),
  method: z.string().optional(),
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  status: z.enum(["pending", "success", "error"]).default("pending"),
  statusCode: z.number().optional(),
  processingDetails: z.record(z.unknown()).optional()
});

export const insertEmailThreadSchema = emailThreadSchema.extend({
  userId: z.number()
});

export const insertEmailMessageSchema = emailMessageSchema;

export const insertWebhookLogSchema = webhookLogSchema;

// Strategic onboarding schemas
export const strategicProfileSchema = z.object({
  title: z.string().min(1, "Title is required"),
  businessType: z.enum(["product", "service"]),
  businessDescription: z.string().min(1, "Business description is required"),
  uniqueAttributes: z.array(z.string()).optional(),
  targetCustomers: z.string().min(1, "Target customers description is required"),
  marketNiche: z.enum(["niche", "broad"]).optional(),
  // Enhanced product profile fields
  productService: z.string().optional(),
  customerFeedback: z.string().optional(),
  website: z.string().optional(),
  businessLocation: z.string().optional(),
  primaryCustomerType: z.string().optional(),
  primarySalesChannel: z.string().optional(),
  primaryBusinessGoal: z.string().optional(),
  // Strategy fields for cold email outreach
  strategyHighLevelBoundary: z.string().optional(),
  exampleSprintPlanningPrompt: z.string().optional(),
  exampleDailySearchQuery: z.string().optional(),
  productAnalysisSummary: z.string().optional(),
  reportSalesContextGuidance: z.string().optional(),
  reportSalesTargetingGuidance: z.string().optional(),
  dailySearchQueries: z.string().optional(),
  strategicPlan: z.record(z.unknown()).optional(),
  searchPrompts: z.array(z.string()).optional(),
  status: z.enum(["in_progress", "completed"]).default("in_progress")
});

export const onboardingChatSchema = z.object({
  profileId: z.number(),
  messages: z.array(z.object({
    id: z.string(),
    content: z.string(),
    role: z.enum(["user", "assistant"]),
    timestamp: z.string()
  })).optional(),
  currentStep: z.string().default("business_description"),
  isComplete: z.boolean().default(false)
});

/* INACTIVE FEATURE SCHEMA - PROSPECT DELIVERIES
export const prospectDeliverySchema = z.object({
  profileId: z.number(),
  searchPrompt: z.string().min(1, "Search prompt is required"),
  deliveryDate: z.string(), // ISO string
  status: z.enum(["scheduled", "delivered", "failed"]).default("scheduled"),
  prospectCount: z.number().default(0)
});

export const insertProspectDeliverySchema = prospectDeliverySchema.extend({
  userId: z.number()
});
*/

export const insertStrategicProfileSchema = strategicProfileSchema.extend({
  userId: z.number()
});

export const insertOnboardingChatSchema = onboardingChatSchema.extend({
  userId: z.number()
});

/* INACTIVE FEATURE TYPES - EMAIL CONVERSATIONS, WEBHOOKS & PROSPECT DELIVERIES
export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type ProspectDelivery = typeof prospectDeliveries.$inferSelect;
export type InsertProspectDelivery = z.infer<typeof insertProspectDeliverySchema>;
*/

// Strategic onboarding types
export type StrategicProfile = typeof strategicProfiles.$inferSelect;
export type InsertStrategicProfile = z.infer<typeof insertStrategicProfileSchema>;
export type OnboardingChat = typeof onboardingChats.$inferSelect;
export type InsertOnboardingChat = z.infer<typeof insertOnboardingChatSchema>;



