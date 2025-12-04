import { pgTable, text, serial, integer, jsonb, timestamp, boolean, uuid, index, uniqueIndex, real } from "drizzle-orm/pg-core";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  firebaseUid: text("firebase_uid"), // Firebase UID for mapping
  createdAt: timestamp("created_at").defaultNow(),
  isGuest: boolean("is_guest").default(false),
  isAdmin: boolean("is_admin").default(false)
});

// User credits table (migrated from KV)
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  balance: integer("balance").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  totalUsed: integer("total_used").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  uniqueIndex('idx_user_credits_user_id').on(table.userId)
]);

// Credit transactions for audit trail
export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer("amount").notNull(), // Positive for additions, negative for usage
  type: text("type").notNull(), // 'purchase', 'usage', 'refund', 'bonus'
  description: text("description"),
  metadata: jsonb("metadata").default({}), // Additional transaction details
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_credit_transactions_user_id').on(table.userId),
  index('idx_credit_transactions_type').on(table.type),
  index('idx_credit_transactions_created_at').on(table.createdAt)
]);

// Subscriptions table (migrated from KV)
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default('inactive'), // 'active', 'inactive', 'cancelled', 'past_due'
  planType: text("plan_type"), // 'basic', 'pro', 'enterprise'
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  uniqueIndex('idx_subscriptions_user_id').on(table.userId),
  index('idx_subscriptions_stripe_customer_id').on(table.stripeCustomerId),
  index('idx_subscriptions_status').on(table.status)
]);

// User notifications (migrated from KV)  
export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'welcome', 'feature', 'credits_low', etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default('unread'), // 'unread', 'read', 'dismissed'
  priority: text("priority").default('normal'), // 'low', 'normal', 'high'
  metadata: jsonb("metadata").default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_user_notifications_user_id').on(table.userId),
  index('idx_user_notifications_status').on(table.status),
  index('idx_user_notifications_created_at').on(table.createdAt)
]);

// OAuth tokens with encryption for sensitive data
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: text("service").notNull(), // 'gmail', 'outlook', etc.
  email: text("email"), // The email address associated with the token
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  metadata: jsonb("metadata").default({}), // Additional service-specific data
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  uniqueIndex('idx_oauth_tokens_user_service').on(table.userId, table.service),
  index('idx_oauth_tokens_user_id').on(table.userId),
  index('idx_oauth_tokens_service').on(table.service),
]);

export const searchLists = pgTable("search_lists", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),  
  listId: integer("list_id").notNull(),
  prompt: text("prompt").notNull(),
  resultCount: integer("result_count").notNull(),
  customSearchTargets: jsonb("custom_search_targets").default('[]'),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_search_lists_user_id').on(table.userId),
  index('idx_search_lists_list_id').on(table.listId),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_companies_user_id').on(table.userId),
  index('idx_companies_list_id').on(table.listId),
  index('idx_companies_name').on(table.name),
]);

export const contacts = pgTable("contacts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: integer("company_id"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedSearches: jsonb("completed_searches").$type<string[]>().default([]),
  // CRM tracking fields
  contactStatus: text("contact_status").default('uncontacted'), // 'uncontacted', 'contacted', 'replied', 'qualified', 'unqualified'
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  lastContactChannel: text("last_contact_channel"), // 'email', 'sms', 'phone'
  totalCommunications: integer("total_communications").default(0),
  totalReplies: integer("total_replies").default(0),
  lastThreadId: text("last_thread_id") // Most recent conversation thread
}, (table) => [
  index('idx_contacts_company_id').on(table.companyId),
  index('idx_contacts_user_id').on(table.userId),
  index('idx_contacts_email').on(table.email),
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
  isDefault: boolean("is_default").default(false),
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

// Search jobs for persistent and resilient search execution
export const searchJobs = pgTable("search_jobs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  jobId: uuid("job_id").notNull().unique().defaultRandom(),
  query: text("query").notNull(),
  searchType: text("search_type").notNull().default('companies'), // 'companies', 'contacts', 'emails', 'contact-only', 'email-single', 'individual'
  contactSearchConfig: jsonb("contact_search_config").default('{}'),
  status: text("status").notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  progress: jsonb("progress").default('{}'), // {phase, completed, total, message}
  results: jsonb("results"), // companies and contacts data
  resultCount: integer("result_count").default(0),
  error: text("error"),
  source: text("source").notNull().default('frontend'), // 'frontend', 'api', 'cron'
  metadata: jsonb("metadata").default('{}'), // additional data like sessionId, listId
  priority: integer("priority").default(0), // higher priority jobs get processed first
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }) // for automatic cleanup
}, (table) => [
  index('idx_search_jobs_user_id').on(table.userId),
  index('idx_search_jobs_job_id').on(table.jobId),
  index('idx_search_jobs_status').on(table.status),
  index('idx_search_jobs_created_at').on(table.createdAt),
  index('idx_search_jobs_priority_status').on(table.priority, table.status)
]);



// N8N Workflow tables have been removed

const searchListSchema = z.object({
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
  alternativeEmails: z.array(z.string()).optional(),
  completedSearches: z.array(z.string()).optional()
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

const searchJobSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  searchType: z.enum(['companies', 'contacts', 'emails', 'email-single', 'individual']).default('companies'),
  contactSearchConfig: z.record(z.any()).optional(),
  source: z.enum(['frontend', 'api', 'cron']).default('frontend'),
  metadata: z.record(z.any()).optional(),
  priority: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3)
});



// N8N Workflow schemas have been removed

export const insertSearchListSchema = searchListSchema.extend({
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

export type SearchList = typeof searchLists.$inferSelect;
export type InsertSearchList = z.infer<typeof insertSearchListSchema>;
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

// Daily Outreach Tables
export const dailyOutreachBatches = pgTable("daily_outreach_batches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  batchDate: timestamp("batch_date", { withTimezone: true }).notNull(),
  secureToken: uuid("secure_token").defaultRandom().notNull(),
  status: text("status").default("pending"), // "pending", "partial", "complete", "expired"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
}, (table) => [
  index('idx_outreach_batch_user_id').on(table.userId),
  index('idx_outreach_batch_token').on(table.secureToken),
  index('idx_outreach_batch_date').on(table.batchDate),
]);

export const dailyOutreachItems = pgTable("daily_outreach_items", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => dailyOutreachBatches.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  communicationId: integer("communication_id").references(() => communicationHistory.id), // Link to CRM record when sent
  emailSubject: text("email_subject").notNull(),
  emailBody: text("email_body").notNull(),
  emailTone: text("email_tone").notNull(),
  status: text("status").default("pending"), // "pending", "sent", "skipped", "edited"
  sentAt: timestamp("sent_at", { withTimezone: true }),
  editedContent: text("edited_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_outreach_item_batch_id').on(table.batchId),
  index('idx_outreach_item_contact_id').on(table.contactId),
  index('idx_outreach_item_communication_id').on(table.communicationId),
]);

// CRM Communications History Table
export const communicationHistory = pgTable("communication_history", {
  // Core identification
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  companyId: integer("company_id").notNull().references(() => companies.id),
  
  // Channel & type
  channel: text("channel").notNull().default('email'), // 'email', 'sms', 'phone', 'linkedin', 'whatsapp'
  direction: text("direction").notNull().default('outbound'), // 'outbound', 'inbound'
  
  // Content
  subject: text("subject"), // Email subject, SMS first line, call topic
  content: text("content").notNull(), // Full message content
  contentPreview: text("content_preview"), // First 200 chars for list views
  
  // Status tracking
  status: text("status").notNull().default('pending'),
  // Email: 'pending', 'sent', 'delivered', 'bounced', 'opened', 'clicked', 'replied', 'unsubscribed'
  // SMS: 'pending', 'sent', 'delivered', 'failed', 'replied'
  // Phone: 'scheduled', 'completed', 'no_answer', 'voicemail', 'busy'
  
  // Threading (critical for email replies)
  threadId: text("thread_id"), // Gmail threadId or generated UUID
  parentId: integer("parent_id"),
  inReplyTo: text("in_reply_to"), // Email Message-ID for standard threading
  references: text("references"), // Email References header chain
  
  // Timestamps
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  
  // Attribution
  campaignId: integer("campaign_id"), // Future campaigns
  batchId: integer("batch_id").references(() => dailyOutreachBatches.id),
  templateId: integer("template_id").references(() => emailTemplates.id),
  
  // Enhanced metadata
  metadata: jsonb("metadata").default({}),
  // Structure:
  // {
  //   from: string,
  //   to: string,
  //   cc: string[],
  //   bcc: string[],
  //   replyTo: string,
  //   messageId: string,
  //   gmailThreadId: string,
  //   gmailHistoryId: string,
  //   tone: string,
  //   offerStrategy: string,
  //   sourceTable: 'manual_outreach' | 'daily_outreach',
  //   originalId: number, // ID from source table
  //   headers: object
  // }
  
  // Engagement metrics
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  clickedLinks: jsonb("clicked_links").$type<string[]>().default([]),
  
  // Error handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  // Audit
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  // Standard indexes
  index('idx_comm_contact_id').on(table.contactId),
  index('idx_comm_company_id').on(table.companyId),
  index('idx_comm_user_id').on(table.userId),
  index('idx_comm_channel').on(table.channel),
  index('idx_comm_status').on(table.status),
  index('idx_comm_thread_id').on(table.threadId),
  index('idx_comm_sent_at').on(table.sentAt),
  index('idx_comm_created_at').on(table.createdAt),
  // Composite index for contact history queries
  index('idx_comm_contact_sent').on(table.contactId, table.sentAt),
]);

export const userOutreachPreferences = pgTable("user_outreach_preferences", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  // Campaign activation status - true means the user has explicitly started their campaign
  // Note: Campaign only runs when enabled=true AND all components configured (product, sender, customer)
  enabled: boolean("enabled").default(true), // TODO: Consider renaming to 'isCampaignActive' for clarity
  scheduleDays: text("schedule_days").array().default(['mon', 'tue', 'wed']),
  scheduleTime: text("schedule_time").default('09:00'), // Store as string for simplicity
  timezone: text("timezone").default('America/New_York'),
  minContactsRequired: integer("min_contacts_required").default(5),
  activeProductId: integer("active_product_id").references(() => strategicProfiles.id),
  activeSenderProfileId: integer("active_sender_profile_id").references(() => senderProfiles.id),
  activeCustomerProfileId: integer("active_customer_profile_id").references(() => customerProfiles.id),
  // Vacation mode fields
  vacationMode: boolean("vacation_mode").default(false),
  vacationStartDate: timestamp("vacation_start_date", { withTimezone: true }),
  vacationEndDate: timestamp("vacation_end_date", { withTimezone: true }),
  lastNudgeSent: timestamp("last_nudge_sent", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_outreach_pref_enabled').on(table.enabled),
]);

// Daily outreach job persistence table
export const dailyOutreachJobs = pgTable("daily_outreach_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  status: text("status").default("scheduled"), // "scheduled", "running", "completed", "failed"
  lastError: text("last_error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_jobs_next_run').on(table.nextRunAt),
  index('idx_jobs_user_status').on(table.userId, table.status),
  index('idx_jobs_retry').on(table.nextRetryAt, table.retryCount),
]);

// Daily outreach job execution logs for audit trail
export const dailyOutreachJobLogs = pgTable("daily_outreach_job_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => dailyOutreachJobs.id),
  userId: integer("user_id").notNull().references(() => users.id),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
  status: text("status").notNull(), // "success", "failed", "skipped"
  batchId: integer("batch_id").references(() => dailyOutreachBatches.id),
  processingTimeMs: integer("processing_time_ms"),
  contactsProcessed: integer("contacts_processed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
}, (table) => [
  index('idx_job_logs_job_id').on(table.jobId),
  index('idx_job_logs_user_id').on(table.userId),
  index('idx_job_logs_executed_at').on(table.executedAt),
]);

// Strategic onboarding tables
// Sender Profiles for Campaigns
export const senderProfiles = pgTable("sender_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"), // For honorifics like Dr., Mr., Ms.
  companyPosition: text("company_position"), // For role/designation like CEO, Engineer
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  isDefault: boolean("is_default").default(false),
  source: text("source").default("manual"), // 'registered' | 'gmail' | 'manual'
  gmailAccountEmail: text("gmail_account_email"), // Email of connected Gmail account
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Target Customer Profiles for Campaigns
export const customerProfiles = pgTable("customer_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  label: text("label").notNull(), // e.g., "Small Business Owners"
  targetDescription: text("target_description"), // Full description of target customer
  industries: text("industries").array(), // Array of industries
  roles: text("roles").array(), // Array of job roles/titles
  locations: text("locations").array(), // Array of geographical locations
  companySizes: text("company_sizes").array(), // Array of company size ranges
  techStack: text("tech_stack").array(), // Array of technologies they use
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});


// Campaign Tables
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // draft, active, paused, completed, scheduled
  subject: text("subject"),
  body: text("body"),
  prompt: text("prompt"),
  contactListId: integer("contact_list_id").references(() => contactLists.id),
  senderProfileId: integer("sender_profile_id").references(() => senderProfiles.id),
  strategicProfileId: integer("strategic_profile_id").references(() => strategicProfiles.id), // Reference to product/service info
  targetCustomerProfileId: integer("target_customer_profile_id").references(() => customerProfiles.id),
  // Email generation settings
  tone: text("tone"),
  offerType: text("offer_type"),
  productId: integer("product_id"),
  // Scheduling settings
  sendTimePreference: text("send_time_preference"), // immediate, scheduled, draft
  scheduleDate: timestamp("schedule_date"),
  scheduleTime: text("schedule_time"), // e.g., "09:00"
  timezone: text("timezone").default("America/New_York"),
  // Autopilot settings
  autopilotEnabled: boolean("autopilot_enabled").default(false),
  autopilotSettings: jsonb("autopilot_settings"), // JSON object with detailed autopilot config
  maxEmailsPerDay: integer("max_emails_per_day").default(20),
  delayBetweenEmails: integer("delay_between_emails").default(30), // minutes
  // Human Review settings
  requiresHumanReview: boolean("requires_human_review").default(true), // true = notification/review flow, false = auto-send
  emailTemplateId: integer("email_template_id").references(() => emailTemplates.id), // template for auto-send campaigns
  // Generation type settings
  generationType: text("generation_type").default("merge_field"), // 'ai_unique' = generate unique email per recipient, 'merge_field' = use template with merge fields
  // Tracking settings
  trackEmails: boolean("track_emails").default(true),
  unsubscribeLink: boolean("unsubscribe_link").default(true),
  // Original fields
  startDate: timestamp("start_date").notNull().defaultNow(), // Always required, defaults to now
  endDate: timestamp("end_date"),
  durationDays: integer("duration_days").notNull().default(14), // Default 2 weeks
  dailyLeadTarget: integer("daily_lead_target").notNull().default(5),
  totalLeadsGenerated: integer("total_leads_generated").notNull().default(0),
  responseRate: real("response_rate").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

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
  isDefault: boolean("is_default").default(false),
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

// Daily Outreach schemas
export const dailyOutreachBatchSchema = z.object({
  batchDate: z.string(),
  status: z.enum(["pending", "partial", "complete", "expired"]).default("pending"),
  expiresAt: z.string()
});

export const dailyOutreachItemSchema = z.object({
  batchId: z.number(),
  contactId: z.number(),
  companyId: z.number(),
  emailSubject: z.string().min(1, "Email subject is required"),
  emailBody: z.string().min(1, "Email body is required"),
  emailTone: z.string(),
  status: z.enum(["pending", "sent", "skipped", "edited"]).default("pending"),
  sentAt: z.string().optional(),
  editedContent: z.string().optional()
});

export const userOutreachPreferencesSchema = z.object({
  enabled: z.boolean().default(true),
  scheduleDays: z.array(z.string()).default(['mon', 'tue', 'wed']),
  scheduleTime: z.string().default('09:00'),
  timezone: z.string().default('America/New_York'),
  minContactsRequired: z.number().default(5),
  activeProductId: z.number().optional(),
  activeSenderProfileId: z.number().optional(),
  activeCustomerProfileId: z.number().optional(),
  vacationMode: z.boolean().default(false),
  vacationStartDate: z.string().optional(),
  vacationEndDate: z.string().optional(),
  lastNudgeSent: z.string().optional()
});

// Strategic onboarding schemas
// Sender Profile schemas
export const senderProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().email("Invalid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  title: z.string().optional(),
  companyPosition: z.string().optional(),
  companyName: z.string().optional(),
  companyWebsite: z.string().optional(),
  isDefault: z.boolean().default(false),
  source: z.enum(['registered', 'gmail', 'manual']).default('manual'),
  gmailAccountEmail: z.string().optional()
});

// Target Customer Profile schemas
export const targetCustomerProfileSchema = z.object({
  label: z.string().min(1, "Label is required"),
  targetDescription: z.string().optional(),
  industries: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  companySizes: z.array(z.string()).optional(),
  techStack: z.array(z.string()).optional(),
  notes: z.string().optional()
});

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

export const insertDailyOutreachBatchSchema = dailyOutreachBatchSchema.extend({
  userId: z.number()
});

export const insertDailyOutreachItemSchema = dailyOutreachItemSchema;

export const insertUserOutreachPreferencesSchema = userOutreachPreferencesSchema.extend({
  userId: z.number()
});

export const insertSenderProfileSchema = senderProfileSchema.extend({
  userId: z.number()
});

export const insertTargetCustomerProfileSchema = targetCustomerProfileSchema.extend({
  userId: z.number()
});

export const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  status: z.enum(["draft", "active", "paused", "completed", "scheduled"]).default("draft"),
  subject: z.string().optional(),
  body: z.string().optional(),
  prompt: z.string().optional(),
  contactListId: z.number().optional(),
  senderProfileId: z.number().optional(),
  productId: z.number().optional(),
  strategicProfileId: z.number().optional(),
  targetCustomerProfileId: z.number().optional(),
  // Email generation settings
  tone: z.string().optional(),
  offerType: z.string().optional(),
  generationType: z.string().optional(),
  // Scheduling settings
  sendTimePreference: z.string().optional(),
  scheduleDate: z.coerce.date().optional(),
  scheduleTime: z.string().optional(),
  timezone: z.string().default("America/New_York"),
  startDate: z.coerce.date().optional(), // Will be set by backend if not provided
  endDate: z.coerce.date().optional(), // Will be calculated by backend if not provided
  // Autopilot settings
  autopilotEnabled: z.boolean().default(false),
  autopilotSettings: z.record(z.unknown()).optional(),
  maxEmailsPerDay: z.number().default(20),
  delayBetweenEmails: z.number().default(30),
  // Human Review settings
  requiresHumanReview: z.boolean().default(true),
  emailTemplateId: z.number().optional(),
  // Tracking settings
  trackEmails: z.boolean().default(true),
  unsubscribeLink: z.boolean().default(true),
  // Original fields
  durationDays: z.number().default(14),
  dailyLeadTarget: z.number().default(5)
});

export const insertCampaignSchema = campaignSchema.extend({
  userId: z.number()
});

export const updateCampaignSchema = campaignSchema.partial();

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
export type DailyOutreachBatch = typeof dailyOutreachBatches.$inferSelect;
export type InsertDailyOutreachBatch = z.infer<typeof insertDailyOutreachBatchSchema>;
export type DailyOutreachItem = typeof dailyOutreachItems.$inferSelect;
export type InsertDailyOutreachItem = z.infer<typeof insertDailyOutreachItemSchema>;
export type UserOutreachPreferences = typeof userOutreachPreferences.$inferSelect;
export type InsertUserOutreachPreferences = z.infer<typeof insertUserOutreachPreferencesSchema>;

export type SenderProfile = typeof senderProfiles.$inferSelect;
export type InsertSenderProfile = z.infer<typeof insertSenderProfileSchema>;
export type TargetCustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertTargetCustomerProfile = z.infer<typeof insertTargetCustomerProfileSchema>;
export type StrategicProfile = typeof strategicProfiles.$inferSelect;
export type InsertStrategicProfile = z.infer<typeof insertStrategicProfileSchema>;
export type OnboardingChat = typeof onboardingChats.$inferSelect;
export type InsertOnboardingChat = z.infer<typeof insertOnboardingChatSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// Contact Lists tables
export const contactLists = pgTable("contact_lists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  contactCount: integer("contact_count").notNull().default(0),
  noDuplicatesWithOtherLists: boolean("no_duplicates_with_other_lists").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const contactListMembers = pgTable("contact_list_members", {
  id: serial("id").primaryKey(),
  listId: integer("list_id").notNull().references(() => contactLists.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  addedAt: timestamp("added_at").defaultNow(),
  addedBy: integer("added_by").references(() => users.id),
  source: text("source").notNull().default('manual'), // 'manual', 'search_list', 'company', 'bulk'
  sourceMetadata: jsonb("source_metadata")
}, (table) => [
  index('idx_contact_list_members_list_id').on(table.listId),
  index('idx_contact_list_members_contact_id').on(table.contactId),
  uniqueIndex('idx_contact_list_unique').on(table.listId, table.contactId)
]);

// Campaign recipients - Track individual email recipient activity
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  recipientEmail: text("recipient_email").notNull(),
  recipientFirstName: text("recipient_first_name"),
  recipientLastName: text("recipient_last_name"),
  recipientCompany: text("recipient_company"),
  status: text("status").notNull().default('queued'), // queued, generating, in_review, scheduled, sending, sent, failed_generation, failed_send, bounced
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  bouncedAt: timestamp("bounced_at"),
  unsubscribedAt: timestamp("unsubscribed_at"),
  emailContent: text("email_content"),
  emailSubject: text("email_subject"),
  sendgridMessageId: text("sendgrid_message_id"),
  errorMessage: text("error_message"),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  // Lock columns to prevent duplicate processing
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index('idx_campaign_recipients_campaign_id').on(table.campaignId),
  index('idx_campaign_recipients_contact_id').on(table.contactId),
  index('idx_campaign_recipients_email').on(table.recipientEmail),
  index('idx_campaign_recipients_status').on(table.status),
  uniqueIndex('idx_campaign_recipient_unique').on(table.campaignId, table.recipientEmail)
]);

// Search queue tables
export const searchQueues = pgTable("search_queues", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: 'set null' }),
  status: text("status").notNull().default('paused'), // 'active', 'paused', 'completed'
  autoRunEnabled: boolean("auto_run_enabled").default(false),
  autoRunThreshold: integer("auto_run_threshold").default(50), // Run when campaign has < X contacts
  delayBetweenSearches: integer("delay_between_searches").default(30), // Seconds between searches
  resultsPerSearch: integer("results_per_search").default(100),
  continueOnFailure: boolean("continue_on_failure").default(true),
  removeCompletedSearches: boolean("remove_completed_searches").default(false),
  notifyOnComplete: boolean("notify_on_complete").default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index('idx_search_queues_user_id').on(table.userId),
  index('idx_search_queues_campaign_id').on(table.campaignId),
  index('idx_search_queues_status').on(table.status)
]);

export const searchQueueItems = pgTable("search_queue_items", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull().references(() => searchQueues.id, { onDelete: 'cascade' }),
  prompt: text("prompt").notNull(),
  order: integer("order").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  searchJobId: integer("search_job_id").references(() => searchJobs.id, { onDelete: 'set null' }),
  listId: integer("list_id").references(() => searchLists.id, { onDelete: 'set null' }),
  resultCount: integer("result_count"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => [
  index('idx_search_queue_items_queue_id').on(table.queueId),
  index('idx_search_queue_items_status').on(table.status),
  index('idx_search_queue_items_order').on(table.order),
  uniqueIndex('idx_search_queue_item_order').on(table.queueId, table.order)
]);

// Contact list schemas
const contactListSchema = z.object({
  name: z.string().min(1, "List name is required"),
  description: z.string().optional()
});

const contactListMemberSchema = z.object({
  listId: z.number(),
  contactId: z.number(),
  source: z.enum(['manual', 'search_list', 'company', 'bulk']).default('manual'),
  sourceMetadata: z.record(z.unknown()).optional()
});

export const insertContactListSchema = contactListSchema.extend({
  userId: z.number(),
  contactCount: z.number().default(0)
});

export const insertContactListMemberSchema = contactListMemberSchema.extend({
  addedBy: z.number().optional()
});

// Contact list types
export type ContactList = typeof contactLists.$inferSelect;
export type InsertContactList = z.infer<typeof insertContactListSchema>;
export type ContactListMember = typeof contactListMembers.$inferSelect;
export type InsertContactListMember = z.infer<typeof insertContactListMemberSchema>;

// Campaign recipient schema
const campaignRecipientSchema = z.object({
  campaignId: z.number(),
  contactId: z.number().optional().nullable(),
  recipientEmail: z.string().email(),
  recipientFirstName: z.string().optional().nullable(),
  recipientLastName: z.string().optional().nullable(),
  recipientCompany: z.string().optional().nullable(),
  status: z.enum(['pending', 'sent', 'bounced', 'failed']).default('pending'),
  emailContent: z.string().optional().nullable(),
  emailSubject: z.string().optional().nullable(),
  sendgridMessageId: z.string().optional().nullable(),
  errorMessage: z.string().optional().nullable()
});

export const insertCampaignRecipientSchema = campaignRecipientSchema;

// Campaign recipient types
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// Search jobs types
export type SearchJob = typeof searchJobs.$inferSelect;
export type InsertSearchJob = z.infer<typeof searchJobSchema> & { userId: number };

// Search queue schemas
const searchQueueSchema = z.object({
  name: z.string().min(1, "Queue name is required"),
  campaignId: z.number().optional().nullable(),
  status: z.enum(['active', 'paused', 'completed']).default('paused'),
  autoRunEnabled: z.boolean().default(false),
  autoRunThreshold: z.number().default(50),
  delayBetweenSearches: z.number().default(30),
  resultsPerSearch: z.number().default(100),
  continueOnFailure: z.boolean().default(true),
  removeCompletedSearches: z.boolean().default(false),
  notifyOnComplete: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional()
});

export const insertSearchQueueSchema = searchQueueSchema.extend({
  userId: z.number()
});

const searchQueueItemSchema = z.object({
  queueId: z.number(),
  prompt: z.string().min(1, "Search prompt is required"),
  order: z.number(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  searchJobId: z.number().optional().nullable(),
  listId: z.number().optional().nullable(),
  resultCount: z.number().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  startedAt: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  metadata: z.record(z.unknown()).optional()
});

export const insertSearchQueueItemSchema = searchQueueItemSchema;

// Search queue types
export type SearchQueue = typeof searchQueues.$inferSelect;
export type InsertSearchQueue = z.infer<typeof insertSearchQueueSchema>;
export type SearchQueueItem = typeof searchQueueItems.$inferSelect;
export type InsertSearchQueueItem = z.infer<typeof insertSearchQueueItemSchema>;

// OAuth token schemas and types
export const insertOAuthTokenSchema = z.object({
  userId: z.number(),
  service: z.string(),
  email: z.string().email().optional(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.date().optional(),
  scopes: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional()
});

export type OAuthToken = typeof oauthTokens.$inferSelect;
export type InsertOAuthToken = z.infer<typeof insertOAuthTokenSchema>;

// Backward compatibility exports
export const targetCustomerProfiles = customerProfiles;


