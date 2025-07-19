import { type Company, type InsertCompany } from "@shared/schema";
import { type Contact, type InsertContact } from "@shared/schema";
import { type SearchApproach, type InsertSearchApproach } from "@shared/schema";
import { type List, type InsertList } from "@shared/schema";
import { type Campaign, type InsertCampaign } from "@shared/schema";
import { type CampaignList, type InsertCampaignList } from "@shared/schema";
import { type EmailTemplate, type InsertEmailTemplate } from "@shared/schema";
import { type ContactFeedback, type InsertContactFeedback } from "@shared/schema";
import { type User, type InsertUser } from "@shared/schema";
import { type SearchTestResult, type InsertSearchTestResult } from "@shared/schema";

// Base storage interface that defines all storage operations
export interface IStorage {
  // New User methods
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;

  // Lists
  getList(listId: number, userId: number): Promise<List | undefined>;
  listLists(userId: number): Promise<List[]>;
  createList(list: InsertList & { userId: number }): Promise<List>;
  updateList(listId: number, data: Partial<InsertList>, userId: number): Promise<List | undefined>;
  getNextListId(): Promise<number>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  listCompanies(): Promise<Company[]>;
  listCompaniesByList(listId: number, userId: number): Promise<Company[]>;
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
  initializeDefaultSearchApproaches(): Promise<void>;

  // Campaigns
  getCampaign(campaignId: number, userId: number): Promise<Campaign | undefined>;
  listCampaigns(userId: number): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign & { userId: number }): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<Campaign>, userId: number): Promise<Campaign | undefined>;
  getNextCampaignId(): Promise<number>;

  // Campaign Lists
  addListToCampaign(campaignList: InsertCampaignList): Promise<CampaignList>;
  removeListFromCampaign(campaignId: number, listId: number): Promise<void>;
  getListsByCampaign(campaignId: number): Promise<List[]>;
  updateCampaignTotalCompanies(campaignId: number): Promise<void>;

  // Email Templates
  getEmailTemplate(id: number, userId: number): Promise<EmailTemplate | undefined>;
  listEmailTemplates(userId: number): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate & { userId: number }): Promise<EmailTemplate>;
  updateEmailTemplate(id: number, template: Partial<EmailTemplate>, userId: number): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: number, userId: number): Promise<void>;

  // Contact Search and Enrichment
  enrichContact(id: number, contactData: Partial<Contact>): Promise<Contact | undefined>;
  searchContactDetails(contactInfo: { name: string; company: string }): Promise<Partial<Contact>>;

  // Contact Validation and Feedback
  addContactFeedback(feedback: InsertContactFeedback): Promise<ContactFeedback>;
  getContactFeedback(contactId: number): Promise<ContactFeedback[]>;
  updateContactConfidenceScore(id: number, score: number): Promise<Contact | undefined>;
  updateContactValidationStatus(id: number): Promise<Contact | undefined>;
  
  // Search Test Results
  getSearchTestResult(id: number): Promise<SearchTestResult | undefined>;
  listSearchTestResults(userId: number): Promise<SearchTestResult[]>;
  getTestResultsByStrategy(strategyId: number, userId: number): Promise<SearchTestResult[]>;
  createSearchTestResult(result: InsertSearchTestResult): Promise<SearchTestResult>;
  updateTestResultStatus(id: number, status: 'completed' | 'running' | 'failed', metadata?: Record<string, unknown>): Promise<SearchTestResult>;
  getStrategyPerformanceHistory(strategyId: number, userId: number): Promise<{ dates: string[], scores: number[] }>;
}

export * from './database';