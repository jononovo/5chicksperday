import { type Company, type InsertCompany } from "@shared/schema";
import { type Contact, type InsertContact } from "@shared/schema";
import { type SearchApproach, type InsertSearchApproach } from "@shared/schema";
import { type List, type InsertList } from "@shared/schema";
import { type Campaign, type InsertCampaign } from "@shared/schema";
import { type CampaignList, type InsertCampaignList } from "@shared/schema";
import { type EmailTemplate, type InsertEmailTemplate } from "@shared/schema";
import { type ContactFeedback, type InsertContactFeedback } from "@shared/schema";
import { type WebhookLog, type InsertWebhookLog } from "@shared/schema";

// Base storage interface that defines all storage operations
export interface IStorage {
  // Lists
  getList(listId: number): Promise<List | undefined>;
  listLists(): Promise<List[]>;
  createList(list: InsertList): Promise<List>;
  getNextListId(): Promise<number>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  listCompanies(): Promise<Company[]>;
  listCompaniesByList(listId: number): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<Company>): Promise<Company | undefined>;
  updateCompanyList(companyId: number, listId: number): Promise<Company | undefined>;

  // Contacts
  getContact(id: number): Promise<Contact | undefined>;
  listContactsByCompany(companyId: number): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, contact: Partial<Contact>): Promise<Contact | undefined>;
  deleteContactsByCompany(companyId: number): Promise<void>;

  // Search Approaches
  getSearchApproach(id: number): Promise<SearchApproach | undefined>;
  listSearchApproaches(): Promise<SearchApproach[]>;
  createSearchApproach(approach: InsertSearchApproach): Promise<SearchApproach>;
  updateSearchApproach(id: number, approach: Partial<SearchApproach>): Promise<SearchApproach | undefined>;

  // Campaigns
  getCampaign(campaignId: number): Promise<Campaign | undefined>;
  listCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;

  // Campaign Lists
  addListToCampaign(campaignList: InsertCampaignList): Promise<CampaignList>;
  removeListFromCampaign(campaignId: number, listId: number): Promise<void>;
  getListsByCampaign(campaignId: number): Promise<List[]>;
  updateCampaignTotalCompanies(campaignId: number): Promise<void>;

  // Email Templates
  getEmailTemplate(id: number): Promise<EmailTemplate | undefined>;
  listEmailTemplates(): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, template: Partial<EmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number): Promise<void>;

  // Contact Search and Enrichment
  enrichContact(id: number, contactData: Partial<Contact>): Promise<Contact | undefined>;
  searchContactDetails(contactInfo: { name: string; company: string }): Promise<Partial<Contact>>;

  // Contact Validation and Feedback
  addContactFeedback(feedback: InsertContactFeedback): Promise<ContactFeedback>;
  getContactFeedback(contactId: number): Promise<ContactFeedback[]>;
  updateContactConfidenceScore(id: number, score: number): Promise<Contact | undefined>;
  updateContactValidationStatus(id: number): Promise<Contact | undefined>;
  
  // Webhook Logs
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLog(requestId: string): Promise<WebhookLog | undefined>;
  listWebhookLogs(limit?: number): Promise<WebhookLog[]>;
  updateWebhookLogStatus(requestId: string, status: string, processed: boolean, processingDetails?: Record<string, any>): Promise<WebhookLog | undefined>;
  getWebhookLogsBySearchId(searchId: string): Promise<WebhookLog[]>;
}

export * from './database';
