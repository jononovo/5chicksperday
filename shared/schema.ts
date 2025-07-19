import { ideahub } from "googleapis/build/src/apis/ideahub";
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
 


// Contact types for Replit Database
export interface Contact {
  id: number;
  userId: number;
  companyId: number;
  name: string;
  priority?: number | null;
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
  priority?: number | null;
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
  moduleType: string;
  active: boolean;
  prompt:string;
  technicalPrompt:string;
  responseStructure:string;
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
 

// Zod validation schemas
const listSchema = z.object({
  listId: z.number().min(1001),
  prompt: z.string().min(1, "Search prompt is required"),
  resultCount: z.number().min(0),
  customSearchTargets: z.array(z.string()).nullable()
});

const companySchema = z.object({
  id: z.number(),
  userId: z.number(),
  name: z.string().min(1, "Company name is required"),
  listId: z.number().optional(),
  description: z.string().optional(),
  age: z.number().optional(),
  size: z.number().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  alternativeProfileUrl: z.string().optional(),
  defaultContactEmail: z.string().email().optional(),
  ranking: z.number().optional(),
  linkedinProminence: z.number().optional(),
  customerCount: z.number().optional(),
  rating: z.number().optional(),
  services: z.array(z.string()).optional(),
  validationPoints: z.array(z.string()).optional(),
  differentiation: z.array(z.string()).optional(),
  totalScore: z.number().optional(),
  snapshot: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});
export const insertCompanySchema = companySchema.omit({
  id: true,
  createdAt: true,
})


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

// First define the schema
export const strategicProfileSchema = z.object({
  id: z.number(),
  userId: z.number(),
  businessType: z.enum(["product", "service"]),
  productName: z.string().min(1, "Product name is required"),
  targetMarket: z.string().min(1, "Target market is required"),
  name: z.string().optional(),
  short_description: z.string().optional(),
  businessDescription: z.string().optional(),
  uniqueAttributes: z.array(z.string()).optional(),
  targetCustomers: z.string().optional(),
  marketNiche: z.enum(["niche", "broad"]).optional(),
  productService: z.string().optional(),
  customerFeedback: z.string().optional(),
  website: z.string().optional(),
  businessLocation: z.string().optional(),
  primaryCustomerType: z.string().optional(),
  primarySalesChannel: z.string().optional(),
  primaryBusinessGoal: z.string().optional(),
  strategyHighLevelBoundary: z.string().optional(),
  exampleSprintPlanningPrompt: z.string().optional(),
  exampleDailySearchQuery: z.string().optional(),
  productAnalysisSummary: z.string().optional(),
  reportSalesContextGuidance: z.string().optional(),
  reportSalesTargetingGuidance: z.string().optional(),
  dailySearchQueries: z.string().optional(),
  strategicPlan: z.record(z.unknown()).optional(),
  searchPrompts: z.array(z.string()).optional(),
  status: z.enum(["in_progress", "completed"]).default("in_progress"),
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

// For insertion, create a schema without the auto-generated fields
export const insertStrategicProfileSchema = strategicProfileSchema
  .omit({ id: true, createdAt: true, updatedAt: true }) // Remove fields that are auto-generated
  .partial({ // Make these fields optional
    name: true,
    short_description: true,
    businessDescription: true,
    uniqueAttributes: true,
    targetCustomers: true,
    marketNiche: true,
    productService: true,
    customerFeedback: true,
    website: true,
    businessLocation: true,
    primaryCustomerType: true,
    primarySalesChannel: true,
    primaryBusinessGoal: true,
    strategyHighLevelBoundary: true,
    exampleSprintPlanningPrompt: true,
    exampleDailySearchQuery: true,
    productAnalysisSummary: true,
    reportSalesContextGuidance: true,
    reportSalesTargetingGuidance: true,
    dailySearchQueries: true,
    strategicPlan: true,
    searchPrompts: true,
    status: true
  });
 

const campaignSchema = z.object({
  campaignId: z.number().min(2001),
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().nullable(),
  status: z.enum(['draft', 'active', 'completed', 'paused']).default('draft'),
  startDate: z.date().nullable(),
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
 

export const insertOnboardingChatSchema = onboardingChatSchema.extend({
  userId: z.number()
});

export const insertProspectDeliverySchema = prospectDeliverySchema.extend({
  userId: z.number()
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = z.infer<typeof companySchema>;


export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

export type StrategicProfile = z.infer<typeof strategicProfileSchema>;
export type InsertStrategicProfile = z.infer<typeof insertStrategicProfileSchema>;
 

