import { PgDatabase } from 'drizzle-orm/pg-core';
import { eq, max } from 'drizzle-orm';
import {
  type Campaign,
  type InsertCampaign,
  type CampaignList,
  type InsertCampaignList,
  type List,
  campaigns,
  campaignLists,
  lists
} from '@shared/schema';

export class CampaignStorage {
  constructor(private db: PgDatabase<any>) {}

  async getCampaign(campaignId: number): Promise<Campaign | undefined> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.campaignId, campaignId));
    return campaign;
  }

  async listCampaigns(): Promise<Campaign[]> {
    return this.db.select().from(campaigns).orderBy(campaigns.campaignId);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [created] = await this.db
      .insert(campaigns)
      .values({
        ...campaign,
        totalCompanies: campaign.totalCompanies || 0,
      })
      .returning();
    return created;
  }

  async updateCampaign(
    id: number,
    updates: Partial<Campaign>,
  ): Promise<Campaign | undefined> {
    const [updated] = await this.db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async getNextCampaignId(): Promise<number> {
    const [result] = await this.db
      .select({ maxCampaignId: max(campaigns.campaignId) })
      .from(campaigns);
    return (result?.maxCampaignId || 2000) + 1;
  }

  async addListToCampaign(
    campaignList: InsertCampaignList,
  ): Promise<CampaignList> {
    const [created] = await this.db
      .insert(campaignLists)
      .values(campaignList)
      .returning();
    await this.updateCampaignTotalCompanies(campaignList.campaignId);
    return created;
  }

  async removeListFromCampaign(
    campaignId: number,
    listId: number,
  ): Promise<void> {
    await this.db
      .delete(campaignLists)
      .where(eq(campaignLists.campaignId, campaignId))
      .where(eq(campaignLists.listId, listId));
    await this.updateCampaignTotalCompanies(campaignId);
  }

  async getListsByCampaign(campaignId: number): Promise<List[]> {
    const campaignListsResult = await this.db
      .select()
      .from(campaignLists)
      .where(eq(campaignLists.campaignId, campaignId));

    const listIds = campaignListsResult.map((cl) => cl.listId);

    if (listIds.length === 0) return [];

    return this.db.select().from(lists).where(eq(lists.listId, listIds[0]));
  }

  async updateCampaignTotalCompanies(campaignId: number): Promise<void> {
    const campaignListsResult = await this.getListsByCampaign(campaignId);
    const totalCompanies = campaignListsResult.reduce(
      (sum, list) => sum + list.resultCount,
      0,
    );

    await this.db
      .update(campaigns)
      .set({ totalCompanies })
      .where(eq(campaigns.campaignId, campaignId));
  }
}