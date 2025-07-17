import { z } from "zod";

// User types for Replit Database
export interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  createdAt: Date;
}

export interface InsertUser {
  username: string;
  password: string;
  email: string;
}

// List types for Replit Database
export interface List {
  id: number;
  userId: number;
  listId: number;
  prompt: string;
  resultCount: number;
  customSearchTargets: string[] | null;
  createdAt: Date;
}

export interface InsertList {
  userId: number;
  listId: number;
  prompt: string;
  resultCount: number;
  customSearchTargets?: string[] | null;
}

// Company types for Replit Database
export interface Company {
  id: number;
  userId: number;
  name: string;
  listId: number | null;
  description: string | null;
  age: number | null;
  size: number | null;
  website: string | null;
  alternativeProfileUrl: string | null;
  defaultContactEmail: string | null;
  ranking: number | null;
  linkedinProminence: number | null;
  customerCount: number | null;
  rating: number | null;
  services: string[] | null;
  validationPoints: string[] | null;
  differentiation: string[] | null;
  totalScore: number | null;
  snapshot: Record<string, any> | null;
  createdAt: Date;
}

export interface InsertCompany {
  userId: number;
  name: string;
  listId?: number | null;
  description?: string | null;
  age?: number | null;
  size?: number | null;
  website?: string | null;
  alternativeProfileUrl?: string | null;
  defaultContactEmail?: string | null;
  ranking?: number | null;
  linkedinProminence?: number | null;
  customerCount?: number | null;
  rating?: number | null;
  services?: string[] | null;
  validationPoints?: string[] | null;
  differentiation?: string[] | null;
  totalScore?: number | null;
  snapshot?: Record<string, any> | null;
}

// Contact types for Replit Database
export interface Contact {
  id: number;
  userId: number;
  companyId: number;
  name: string;
  role: string | null;
  email: string | null;
  alternativeEmails: string[] | null;
  probability: number | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  phoneNumber: string | null;
  department: string | null;
  location: string | null;
  verificationSource: string | null;
  lastEnriched: Date | null;
  nameConfidenceScore: number | null;
  userFeedbackScore: number | null;
  feedbackCount: number;
  lastValidated: Date | null;
  createdAt: Date;
  completedSearches: string[] | null;
}

export interface InsertContact {
  userId: number;
  companyId: number;
  name: string;
  role?: string | null;
  email?: string | null;
  alternativeEmails?: string[] | null;
  probability?: number | null;
  linkedinUrl?: string | null;
  twitterHandle?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  location?: string | null;
  verificationSource?: string | null;
  lastEnriched?: Date | null;
  nameConfidenceScore?: number | null;
  userFeedbackScore?: number | null;
  feedbackCount?: number;
  lastValidated?: Date | null;
  completedSearches?: string[] | null;
}

// Contact Feedback types for Replit Database
export interface ContactFeedback {
  id: number;
  contactId: number;
  feedbackType: string;
  createdAt: Date;
}

export interface InsertContactFeedback {
  contactId: number;
  feedbackType: string;
}



// Campaign types for Replit Database
export interface Campaign {
  id: number;
  userId: number;
  campaignId: number;
  name: string;
  description: string | null;
  status: string;
  startDate: Date | null;
  createdAt: Date;
  totalCompanies: number;
}

export interface InsertCampaign {
  userId: number;
  campaignId: number;
  name: string;
  description?: string | null;
  status?: string;
  startDate?: Date | null;
  totalCompanies?: number;
}

// Campaign List types for Replit Database
export interface CampaignList {
  id: number;
  campaignId: number;
  listId: number;
  createdAt: Date;
}

export interface InsertCampaignList {
  campaignId: number;
  listId: number;
}

// Email Template types for Replit Database
export interface EmailTemplate {
  id: number;
  userId: number;
  name: string;
  subject: string;
  content: string;
  description: string | null;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertEmailTemplate {
  userId: number;
  name: string;
  subject: string;
  content: string;
  description?: string | null;
  category?: string;
}

// User Preferences types for Replit Database
export interface UserPreferences {
  id: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertUserPreferences {
  userId: number;
}



// Additional types for email threads and messages
export interface EmailThread {
  id: number;
  userId: number;
  contactId: number;
  subject: string;
  lastUpdated: Date;
  createdAt: Date;
  isArchived: boolean;
  messages: EmailMessage[];
}

export interface EmailMessage {
  id: number;
  threadId: number;
  sender: string;
  recipient: string;
  subject: string;
  content: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  isRead: boolean;
}

// SearchApproach types 
export interface SearchApproach {
  id: number;
  name: string;
  description: string;
  targetTypes: string[];
  prompts: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface InsertSearchApproach {
  name: string;
  description: string;
  targetTypes: string[];
  prompts: string[];
  isActive?: boolean;
}

// SearchTestResult types
export interface SearchTestResult {
  id: number;
  userId: number;
  strategyId: number;
  status: 'completed' | 'running' | 'failed';
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface InsertSearchTestResult {
  userId: number;
  strategyId: number;
  status: 'completed' | 'running' | 'failed';
  metadata: Record<string, any>;
}

// Strategic Profile types
export interface StrategicProfile {
  id: number;
  userId: number;
  businessType: string;
  productName: string;
  targetMarket: string;
  createdAt: Date;
}

export interface InsertStrategicProfile {
  userId: number;
  businessType: string;
  productName: string;
  targetMarket: string;
}

// Zod validation schemas
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
  userId: z.number()
  // hasSeenTour field removed
});



// N8N Workflow schemas have been removed

export const insertListSchema = listSchema.extend({
  userId: z.number()
});
export const insertCompanySchema = companySchema;
export const insertContactSchema = contactSchema;
export const insertCampaignSchema = campaignSchema.extend({
  userId: z.number()
});
export const insertCampaignListSchema = campaignListSchema;
export const insertEmailTemplateSchema = emailTemplateSchema.extend({
  userId: z.number()
});
export const insertContactFeedbackSchema = contactFeedbackSchema;
export const insertUserPreferencesSchema = userPreferencesSchema;

// Zod-based type exports have been moved to interface definitions above

// N8N workflow types have been removed

// Add user schema and type
export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});

export const insertUserSchema = userSchema;

// Strategic Profile types (consolidated)
export interface StrategicProfileExpanded {
  id: number;
  userId: number;
  name: string | null;
  short_description: string | null;
  businessType: string;
  businessDescription: string;
  uniqueAttributes: string[] | null;
  targetCustomers: string;
  marketNiche: string | null;
  productService: string | null;
  customerFeedback: string | null;
  website: string | null;
  businessLocation: string | null;
  primaryCustomerType: string | null;
  primarySalesChannel: string | null;
  primaryBusinessGoal: string | null;
  strategyHighLevelBoundary: string | null;
  exampleSprintPlanningPrompt: string | null;
  exampleDailySearchQuery: string | null;
  productAnalysisSummary: string | null;
  reportSalesContextGuidance: string | null;
  reportSalesTargetingGuidance: string | null;
  dailySearchQueries: string | null;
  strategicPlan: Record<string, any>;
  searchPrompts: string[] | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Onboarding Chat types
export interface OnboardingChat {
  id: number;
  userId: number;
  profileId: number;
  messages: Record<string, any>;
  currentStep: string;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertOnboardingChat {
  userId: number;
  profileId: number;
  messages?: Record<string, any>;
  currentStep?: string;
  isComplete?: boolean;
}

// Prospect Delivery types
export interface ProspectDelivery {
  id: number;
  userId: number;
  profileId: number;
  searchPrompt: string;
  deliveryDate: Date;
  status: string;
  prospectCount: number;
  createdAt: Date;
}

export interface InsertProspectDelivery {
  userId: number;
  profileId: number;
  searchPrompt: string;
  deliveryDate: Date;
  status?: string;
  prospectCount?: number;
}

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
  name: z.string().optional(),
  short_description: z.string().optional(),
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

export const prospectDeliverySchema = z.object({
  profileId: z.number(),
  searchPrompt: z.string().min(1, "Search prompt is required"),
  deliveryDate: z.string(), // ISO string
  status: z.enum(["scheduled", "delivered", "failed"]).default("scheduled"),
  prospectCount: z.number().default(0)
});

export const insertStrategicProfileSchema = strategicProfileSchema.extend({
  userId: z.number()
});

export const insertOnboardingChatSchema = onboardingChatSchema.extend({
  userId: z.number()
});

export const insertProspectDeliverySchema = prospectDeliverySchema.extend({
  userId: z.number()
});

export type EmailThread = typeof emailThreads.$inferSelect;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

// Strategic onboarding types
export type StrategicProfile = typeof strategicProfiles.$inferSelect;
export type InsertStrategicProfile = z.infer<typeof insertStrategicProfileSchema>;
export type OnboardingChat = typeof onboardingChats.$inferSelect;
export type InsertOnboardingChat = z.infer<typeof insertOnboardingChatSchema>;
export type ProspectDelivery = typeof prospectDeliveries.$inferSelect;
export type InsertProspectDelivery = z.infer<typeof insertProspectDeliverySchema>;
  

