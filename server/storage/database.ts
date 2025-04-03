import { IStorage } from './index';
import { CompanyStorage } from './companies';
import { ContactStorage } from './contacts';
import { SearchStorage } from './search';
import { CampaignStorage } from './campaigns';
import { TemplateStorage } from './templates';
import { db } from '../db';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from '@shared/schema';

export class DatabaseStorage implements IStorage {
  private readonly companyStorage: CompanyStorage;
  private readonly contactStorage: ContactStorage;
  private readonly searchStorage: SearchStorage;
  private readonly campaignStorage: CampaignStorage;
  private readonly templateStorage: TemplateStorage;

  constructor() {
    // Cast db to correct type to resolve type mismatch
    const typedDb = db as PgDatabase<typeof schema>;
    this.companyStorage = new CompanyStorage(typedDb);
    this.contactStorage = new ContactStorage(typedDb);
    this.searchStorage = new SearchStorage(typedDb);
    this.campaignStorage = new CampaignStorage(typedDb);
    this.templateStorage = new TemplateStorage(typedDb);
  }

  // Lists (delegated to CompanyStorage)
  getList = (listId: number) => this.companyStorage.getList(listId);
  listLists = () => this.companyStorage.listLists();
  createList = (list: any) => this.companyStorage.createList(list);
  getNextListId = () => this.companyStorage.getNextListId();

  // Companies
  getCompany = (id: number) => this.companyStorage.getCompany(id);
  listCompanies = () => this.companyStorage.listCompanies();
  listCompaniesByList = (listId: number) => this.companyStorage.listCompaniesByList(listId);
  createCompany = (company: any) => this.companyStorage.createCompany(company);
  updateCompany = (id: number, updates: any) => this.companyStorage.updateCompany(id, updates);
  updateCompanyList = (companyId: number, listId: number) => this.companyStorage.updateCompanyList(companyId, listId);

  // Contacts
  getContact = (id: number) => this.contactStorage.getContact(id);
  listContactsByCompany = (companyId: number) => this.contactStorage.listContactsByCompany(companyId);
  createContact = (contact: any) => this.contactStorage.createContact(contact);
  updateContact = (id: number, contact: any) => this.contactStorage.updateContact(id, contact);
  deleteContactsByCompany = (companyId: number) => this.contactStorage.deleteContactsByCompany(companyId);
  enrichContact = (id: number, contactData: any) => this.contactStorage.enrichContact(id, contactData);
  searchContactDetails = (contactInfo: any) => this.contactStorage.searchContactDetails(contactInfo);
  addContactFeedback = (feedback: any) => this.contactStorage.addContactFeedback(feedback);
  getContactFeedback = (contactId: number) => this.contactStorage.getContactFeedback(contactId);
  updateContactConfidenceScore = (id: number, score: number) => this.contactStorage.updateContactConfidenceScore(id, score);
  updateContactValidationStatus = (id: number) => this.contactStorage.updateContactValidationStatus(id);

  // Search Approaches
  getSearchApproach = (id: number) => this.searchStorage.getSearchApproach(id);
  listSearchApproaches = () => this.searchStorage.listSearchApproaches();
  createSearchApproach = (approach: any) => this.searchStorage.createSearchApproach(approach);
  updateSearchApproach = (id: number, updates: any) => this.searchStorage.updateSearchApproach(id, updates);

  // Campaigns
  getCampaign = (campaignId: number) => this.campaignStorage.getCampaign(campaignId);
  listCampaigns = () => this.campaignStorage.listCampaigns();
  createCampaign = (campaign: any) => this.campaignStorage.createCampaign(campaign);
  updateCampaign = (id: number, campaign: any) => this.campaignStorage.updateCampaign(id, campaign);
  getNextCampaignId = () => this.campaignStorage.getNextCampaignId();

  // Campaign Lists
  addListToCampaign = (campaignList: any) => this.campaignStorage.addListToCampaign(campaignList);
  removeListFromCampaign = (campaignId: number, listId: number) => this.campaignStorage.removeListFromCampaign(campaignId, listId);
  getListsByCampaign = (campaignId: number) => this.campaignStorage.getListsByCampaign(campaignId);
  updateCampaignTotalCompanies = (campaignId: number) => this.campaignStorage.updateCampaignTotalCompanies(campaignId);

  // Email Templates
  getEmailTemplate = (id: number) => this.templateStorage.getEmailTemplate(id);
  listEmailTemplates = () => this.templateStorage.listEmailTemplates();
  createEmailTemplate = (template: any) => this.templateStorage.createEmailTemplate(template);
  updateEmailTemplate = (id: number, template: any) => this.templateStorage.updateEmailTemplate(id, template);
  deleteEmailTemplate = (id: number) => this.templateStorage.deleteEmailTemplate(id);

  // Initialize default data (made public to fix access issues)
  async initializeDefaultData() {
    const [approaches, templates] = await Promise.all([
      this.listSearchApproaches(),
      this.listEmailTemplates()
    ]);

    if (approaches.length === 0) {
      await this.searchStorage.initializeDefaultSearchApproaches();
    }

    if (templates.length === 0) {
      await this.templateStorage.initializeDefaultEmailTemplates();
    }
  }
}

// Create and export a single instance
export const storage = new DatabaseStorage();

// Initialize default data using the public method
storage.initializeDefaultData().catch(console.error);