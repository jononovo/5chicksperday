/**
 * Batch Processing Utilities
 * 
 * Centralized utilities for batch processing with error isolation
 * and configurable batch sizes for improved performance
 */

/**
 * Process items in batches with error isolation
 * Each batch runs concurrently, but batches are processed sequentially
 * Failed items don't fail the whole batch (uses Promise.allSettled)
 * 
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param batchSize - Number of items to process concurrently (default 5)
 * @returns Array of successful results
 */
export async function processBatch<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Use Promise.allSettled for error isolation
    const batchResults = await Promise.allSettled(
      batch.map(processor)
    );
    
    // Extract successful results and log errors
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`[Batch Processing] Item ${i + index} failed:`, result.reason);
      }
    });
  }
  
  return results;
}

/**
 * Process items in batches without error isolation (fail-fast)
 * Each batch runs concurrently, batches are processed sequentially
 * If any item fails, the whole batch fails
 * 
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param batchSize - Number of items to process concurrently (default 5)
 * @returns Array of results
 */
export async function processBatchStrict<T, R>(
  items: T[], 
  processor: (item: T) => Promise<R>, 
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Process items with configurable concurrency and progress reporting
 * 
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Configuration options
 * @returns Array of results with metadata
 */
export async function processBatchWithProgress<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    onProgress?: (completed: number, total: number) => void;
    failFast?: boolean;
  } = {}
): Promise<{ results: R[]; errors: Error[]; successCount: number }> {
  const { 
    batchSize = 5, 
    onProgress, 
    failFast = false 
  } = options;
  
  const results: R[] = [];
  const errors: Error[] = [];
  let successCount = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    if (failFast) {
      // Use Promise.all for fail-fast behavior
      try {
        const batchResults = await Promise.all(
          batch.map((item, idx) => processor(item, i + idx))
        );
        results.push(...batchResults);
        successCount += batchResults.length;
      } catch (error) {
        throw error;
      }
    } else {
      // Use Promise.allSettled for error isolation
      const batchResults = await Promise.allSettled(
        batch.map((item, idx) => processor(item, i + idx))
      );
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          successCount++;
        } else {
          errors.push(result.reason);
        }
      });
    }
    
    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }
  }
  
  return { results, errors, successCount };
}

/**
 * Process multiple companies concurrently using tiered email search
 * Each company processes its top 3 contacts using the tiered approach
 * All companies are processed in parallel batches for maximum efficiency
 * 
 * @param companiesWithContacts - Array of {company, contacts} objects
 * @param tieredSearchFn - Function to perform tiered search on a company's contacts
 * @param options - Configuration options
 * @returns Results map of company ID to email search results
 */
export async function processTieredBatch<C, T>(
  companiesWithContacts: Array<{ company: C & { id: number; name: string }, contacts: T[] }>,
  tieredSearchFn: (contacts: T[], company: C) => Promise<Map<number, boolean>>,
  options: {
    batchSize?: number;  // Number of companies to process simultaneously
    onProgress?: (completed: number, total: number, emailsFound: number) => void;
    onCompanyComplete?: (company: C, results: Map<number, boolean>) => void;
  } = {}
): Promise<{
  results: Map<number, Map<number, boolean>>;  // Company ID -> Contact results
  totalEmailsFound: number;
  companiesProcessed: number;
  errors: Array<{ companyId: number; error: Error }>;
}> {
  const { 
    batchSize = 5,  // Process 5 companies concurrently by default
    onProgress,
    onCompanyComplete
  } = options;
  
  const results = new Map<number, Map<number, boolean>>();
  const errors: Array<{ companyId: number; error: Error }> = [];
  let totalEmailsFound = 0;
  let companiesProcessed = 0;
  
  console.log(`[processTieredBatch] Starting parallel processing of ${companiesWithContacts.length} companies`);
  const startTime = Date.now();
  
  // Process companies in concurrent batches
  for (let i = 0; i < companiesWithContacts.length; i += batchSize) {
    const batch = companiesWithContacts.slice(i, i + batchSize);
    
    console.log(`[processTieredBatch] Processing batch ${Math.floor(i/batchSize) + 1} (companies ${i + 1}-${Math.min(i + batchSize, companiesWithContacts.length)})`);
    
    // Process all companies in this batch concurrently
    const batchPromises = batch.map(async ({ company, contacts }) => {
      try {
        // Only process top 3 contacts per company
        const topContacts = contacts.slice(0, 3);
        
        // Run tiered search for this company
        const companyResults = await tieredSearchFn(topContacts, company);
        
        // Count emails found
        const emailsFound = Array.from(companyResults.values()).filter(v => v).length;
        totalEmailsFound += emailsFound;
        
        // Store results
        results.set(company.id, companyResults);
        
        // Callback for individual company completion
        if (onCompanyComplete) {
          onCompanyComplete(company, companyResults);
        }
        
        console.log(`[processTieredBatch] Company ${company.name}: ${emailsFound}/${topContacts.length} emails found`);
        
        return { companyId: company.id, success: true, emailsFound };
      } catch (error) {
        console.error(`[processTieredBatch] Error processing company ${company.name}:`, error);
        errors.push({ 
          companyId: company.id, 
          error: error instanceof Error ? error : new Error(String(error))
        });
        return { companyId: company.id, success: false, emailsFound: 0 };
      }
    });
    
    // Wait for all companies in this batch to complete
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Update progress
    companiesProcessed += batch.length;
    if (onProgress) {
      onProgress(companiesProcessed, companiesWithContacts.length, totalEmailsFound);
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[processTieredBatch] Completed ${companiesProcessed} companies in ${elapsed}ms. Total emails found: ${totalEmailsFound}`);
  
  return {
    results,
    totalEmailsFound,
    companiesProcessed,
    errors
  };
}

/**
 * Process a single company's contacts using tiered email search with proper concurrency
 * This is a helper function for processing individual companies
 * 
 * @param contacts - Array of contacts to search (will take top 3)
 * @param company - Company object
 * @param searchFunctions - Object containing the search functions for each tier
 * @returns Map of contact ID to success status
 */
export async function processSingleCompanyTiered<T extends { id: number; name: string; email?: string }>(
  contacts: T[],
  company: { id: number; name: string },
  searchFunctions: {
    apolloSearch?: (contact: T, company: any) => Promise<{ success: boolean; email?: string }>;
    perplexitySearch?: (contact: T, company: any) => Promise<{ email?: string }>;
    hunterSearch?: (contact: T, company: any) => Promise<{ success: boolean; email?: string }>;
  }
): Promise<Map<number, boolean>> {
  const results = new Map<number, boolean>();
  const topContacts = contacts.slice(0, 3);
  
  // Skip contacts with existing emails
  const contactsToSearch = topContacts.filter(c => {
    if (c.email && c.email.includes('@')) {
      results.set(c.id, false);  // Already has email
      return false;
    }
    return true;
  });
  
  if (contactsToSearch.length === 0) return results;
  
  // TIER 1: Apollo for all contacts
  if (searchFunctions.apolloSearch) {
    const apolloPromises = contactsToSearch.map(contact => 
      searchFunctions.apolloSearch!(contact, company).catch(() => ({ success: false }))
    );
    
    const apolloResults = await Promise.allSettled(apolloPromises);
    // Process results...
  }
  
  // TIER 2: Perplexity + Hunter in parallel
  // Implementation continues...
  
  return results;
}