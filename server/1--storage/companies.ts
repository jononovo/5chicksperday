import { PgDatabase } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import {
  type Company,
  type InsertCompany,
  type List,
  type InsertList,
  companies,
  lists
} from '@shared/schema';

export class CompanyStorage {
  constructor(private db: PgDatabase<any>) {}

  async getCompany(id: number, userId: number): Promise<Company | undefined> {
    console.log('CompanyStorage.getCompany called with:', { id, userId });
    try {
      const result = await this.db
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .where(eq(companies.userId, userId))
        .limit(1);

      console.log('CompanyStorage.getCompany result:', {
        requested: { id, userId },
        found: result[0] ? { id: result[0].id, name: result[0].name } : null
      });

      return result[0];
    } catch (error) {
      console.error('Error in CompanyStorage.getCompany:', error);
      throw error;
    }
  }

  // Lists
  async getList(listId: number): Promise<List | undefined> {
    const [list] = await this.db
      .select()
      .from(lists)
      .where(eq(lists.listId, listId));
    return list;
  }

  async listLists(): Promise<List[]> {
    return this.db.select().from(lists);
  }

  async createList(list: InsertList): Promise<List> {
    const [created] = await this.db.insert(lists).values(list).returning();
    return created;
  }

  async getNextListId(): Promise<number> {
    const [result] = await this.db
      .select()
      .from(lists)
      .orderBy(lists.listId);
    return (result?.listId || 1000) + 1;
  }

  // Companies

  async listCompanies(): Promise<Company[]> {
    return this.db.select().from(companies);
  }

  async listCompaniesByList(listId: number): Promise<Company[]> {
    return this.db
      .select()
      .from(companies)
      .where(eq(companies.listId, listId));
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await this.db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(
    id: number,
    updates: Partial<Company>,
  ): Promise<Company | undefined> {
    const [updated] = await this.db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, id))
      .returning();
    return updated;
  }

  async updateCompanyList(
    companyId: number,
    listId: number,
  ): Promise<Company | undefined> {
    const [updated] = await this.db
      .update(companies)
      .set({ listId })
      .where(eq(companies.id, companyId))
      .returning();
    return updated;
  }
}