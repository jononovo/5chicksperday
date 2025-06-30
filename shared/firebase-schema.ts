import { z } from "zod";

// Firebase-first schemas using Zod (no Drizzle/PostgreSQL)

// User Schema - keyed by Firebase UID
export const userSchema = z.object({
  id: z.number(),
  firebaseUID: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  password: z.string(), // Empty for Firebase auth
  createdAt: z.date()
});

export const insertUserSchema = userSchema.omit({ id: true, createdAt: true });

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

// User Preferences Schema
export const userPreferencesSchema = z.object({
  userId: z.number() // Legacy field, not used with Firebase
});

export const insertUserPreferencesSchema = userPreferencesSchema.partial();

export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

// List Schema
export const listSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  listId: z.number(),
  prompt: z.string(),
  resultCount: z.number(),
  customSearchTargets: z.array(z.string()).nullable(),
  createdAt: z.date().nullable()
});

export const insertListSchema = listSchema.omit({ id: true, createdAt: true, userId: true });

export type List = z.infer<typeof listSchema>;
export type InsertList = z.infer<typeof insertListSchema>;

// Company Schema
export const companySchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  name: z.string(),
  listId: z.number().nullable(),
  description: z.string().nullable(),
  age: z.number().nullable(),
  size: z.number().nullable(),
  website: z.string().nullable(),
  alternativeProfileUrl: z.string().nullable(),
  defaultContactEmail: z.string().nullable(),
  ranking: z.number().nullable(),
  linkedinProminence: z.number().nullable(),
  customerCount: z.number().nullable(),
  rating: z.number().nullable(),
  services: z.array(z.string()).nullable(),
  validationPoints: z.array(z.string()).nullable(),
  differentiation: z.array(z.string()).nullable(),
  totalScore: z.number().nullable(),
  snapshot: z.record(z.any()).nullable(),
  createdAt: z.date().nullable()
});

export const insertCompanySchema = companySchema.omit({ id: true, createdAt: true, userId: true });

export type Company = z.infer<typeof companySchema>;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// Contact Schema
export const contactSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  email: z.string().nullable(),
  name: z.string(),
  location: z.string().nullable(),
  companyId: z.number(),
  role: z.string().nullable(),
  alternativeEmails: z.array(z.string()).nullable(),
  probability: z.number().nullable(),
  linkedinUrl: z.string().nullable(),
  twitterHandle: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  personalizedMessage: z.string().nullable(),
  lastEnriched: z.date().nullable(),
  lastValidated: z.date().nullable(),
  priority: z.number().nullable(),
  completedSearches: z.array(z.string()).nullable(),
  feedbackCount: z.number().nullable(),
  createdAt: z.date().nullable()
});

export const insertContactSchema = contactSchema.omit({ id: true, createdAt: true, userId: true });

export type Contact = z.infer<typeof contactSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;

// Campaign Schema
export const campaignSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  name: z.string(),
  status: z.string().nullable(),
  description: z.string().nullable(),
  campaignId: z.number(),
  startDate: z.date().nullable(),
  totalCompanies: z.number().nullable(),
  createdAt: z.date().nullable()
});

export const insertCampaignSchema = campaignSchema.omit({ id: true, createdAt: true, userId: true });

export type Campaign = z.infer<typeof campaignSchema>;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

// Email Template Schema
export const emailTemplateSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  name: z.string(),
  description: z.string().nullable(),
  subject: z.string(),
  content: z.string(),
  category: z.string().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable()
});

export const insertEmailTemplateSchema = emailTemplateSchema.omit({ id: true, createdAt: true, updatedAt: true, userId: true });

export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// Email Thread Schema
export const emailThreadSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  contactId: z.number(),
  subject: z.string(),
  status: z.string().nullable(),
  lastMessageAt: z.date().nullable(),
  createdAt: z.date().nullable()
});

export const insertEmailThreadSchema = emailThreadSchema.omit({ id: true, createdAt: true, userId: true });

export type EmailThread = z.infer<typeof emailThreadSchema>;
export type InsertEmailThread = z.infer<typeof insertEmailThreadSchema>;

// Email Message Schema
export const emailMessageSchema = z.object({
  id: z.number(),
  userId: z.number(), // Legacy field, not used with Firebase
  threadId: z.number(),
  messageId: z.string(),
  direction: z.string(),
  fromEmail: z.string(),
  toEmail: z.string(),
  subject: z.string(),
  content: z.string(),
  isRead: z.boolean().nullable(),
  sentAt: z.date().nullable(),
  createdAt: z.date().nullable()
});

export const insertEmailMessageSchema = emailMessageSchema.omit({ id: true, createdAt: true, userId: true });

export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type InsertEmailMessage = z.infer<typeof insertEmailMessageSchema>;

// Webhook Log Schema
export const webhookLogSchema = z.object({
  id: z.number(),
  requestId: z.string(),
  searchId: z.string().nullable(),
  source: z.string(),
  method: z.string(),
  url: z.string(),
  headers: z.record(z.string()),
  body: z.record(z.any()),
  status: z.string(),
  responseStatus: z.number().nullable(),
  responseBody: z.record(z.any()).nullable(),
  error: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export type WebhookLog = z.infer<typeof webhookLogSchema>;