import { PgDatabase } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { searchTestResults, InsertSearchTestResult, SearchTestResult } from "../../shared/schema";
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage class for managing search test results
 */
export class SearchTestResultsStorage {
  constructor(private db: PgDatabase<any>) {}

  /**
   * Get a specific search test result by ID
   */
  async getSearchTestResult(id: number): Promise<SearchTestResult | undefined> {
    const results = await this.db
      .select()
      .from(searchTestResults)
      .where(eq(searchTestResults.id, id))
      .limit(1);
    
    return results[0];
  }

  /**
   * Get all test results for a specific user
   */
  async listSearchTestResults(userId: number): Promise<SearchTestResult[]> {
    return this.db
      .select()
      .from(searchTestResults)
      .where(eq(searchTestResults.userId, userId))
      .orderBy(searchTestResults.createdAt);
  }

  /**
   * Get test results by strategy ID
   */
  async getTestResultsByStrategy(strategyId: number, userId: number): Promise<SearchTestResult[]> {
    return this.db
      .select()
      .from(searchTestResults)
      .where(eq(searchTestResults.strategyId, strategyId))
      .where(eq(searchTestResults.userId, userId))
      .orderBy(searchTestResults.createdAt);
  }

  /**
   * Create a new search test result
   */
  async createSearchTestResult(result: InsertSearchTestResult): Promise<SearchTestResult> {
    // Generate a UUID for this test
    const testId = result.testId || uuidv4();
    
    const insertResult = await this.db
      .insert(searchTestResults)
      .values({
        ...result,
        testId,
        createdAt: new Date()
      })
      .returning();
    
    return insertResult[0];
  }

  /**
   * Update a test result status and metadata
   */
  async updateTestResultStatus(
    id: number, 
    status: 'completed' | 'running' | 'failed', 
    metadata?: Record<string, unknown>
  ): Promise<SearchTestResult> {
    const updateData: Partial<SearchTestResult> = { status };
    
    if (metadata) {
      updateData.metadata = metadata;
    }
    
    const results = await this.db
      .update(searchTestResults)
      .set(updateData)
      .where(eq(searchTestResults.id, id))
      .returning();
    
    return results[0];
  }

  /**
   * Get performance metrics for a strategy over time
   */
  async getStrategyPerformanceHistory(strategyId: number, userId: number): Promise<{ 
    dates: string[],
    scores: number[] 
  }> {
    const results = await this.getTestResultsByStrategy(strategyId, userId);
    
    // Format results for time-series chart
    return {
      dates: results.map(r => r.createdAt?.toISOString() || ''),
      scores: results.map(r => r.overallScore)
    };
  }
}