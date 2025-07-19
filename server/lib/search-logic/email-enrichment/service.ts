import { searchContactDetails } from '../../api-interactions';
import type { Contact } from '@shared/schema';
import type { EnrichmentResult, BatchEnrichmentResult, EnrichmentQueueItem } from './types';
import { storage } from '../../../storage';

class EmailEnrichmentService {
  private queue: EnrichmentQueueItem[] = [];
  private isProcessing: boolean = false;

  async addToQueue(items: EnrichmentQueueItem[]): Promise<void> {
    console.log('Adding items to enrichment queue:', items.length);
    this.queue.push(...items);
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const results: EnrichmentResult[] = [];

    try {
      console.log(`Starting to process enrichment queue with ${this.queue.length} items`);

      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;

        try {
          console.log(`Processing enrichment for contact: ${item.contactName}`);
          const enrichedDetails = await searchContactDetails(item.contactName, item.companyName);

          if (Object.keys(enrichedDetails).length > 0) {
            const contact = await storage.getContact(item.contactId);
            if (!contact) {
              console.log(`Contact ${item.contactId} not found, skipping`);
              continue;
            }

            const updatedContact = await storage.updateContact(item.contactId, {
              ...enrichedDetails,
              completedSearches: [...(contact.completedSearches || []), 'contact_enrichment'],
              lastEnriched: new Date()
            });

            results.push({
              contactId: item.contactId,
              success: true,
              enrichedData: updatedContact
            });
            console.log(`Successfully enriched contact ${item.contactName}`);
          } else {
            results.push({
              contactId: item.contactId,
              success: false,
              error: 'No enrichment data found'
            });
            console.log(`No enrichment data found for ${item.contactName}`);
          }

          // Add a small delay between processing items
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error enriching contact ${item.contactId}:`, error);
          results.push({
            contactId: item.contactId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }

    // Store batch results
    const batchResult: BatchEnrichmentResult = {
      results,
      completedAt: new Date().toISOString(),
      totalProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length
    };

    console.log('Batch enrichment completed:', batchResult);
  }

  async enrichTopProspects(companyId: number): Promise<EnrichmentResult[]> {
    console.log(`Starting top prospects enrichment for company ${companyId}`);
    const contacts = await storage.listContactsByCompany(companyId);

    const topProspects = contacts
      .filter(contact => contact.nameConfidenceScore && contact.nameConfidenceScore >= 70)
      .sort((a, b) => (b.nameConfidenceScore || 0) - (a.nameConfidenceScore || 0))
      .slice(0, 10);

    console.log(`Found ${topProspects.length} top prospects for enrichment`);

    const company = await storage.getCompany(companyId);
    if (!company) throw new Error('Company not found');

    const queueItems: EnrichmentQueueItem[] = topProspects.map(contact => ({
      contactId: contact.id,
      priority: contact.nameConfidenceScore || 50,
      companyName: company.name,
      contactName: contact.name
    }));

    await this.addToQueue(queueItems);

    return queueItems.map(item => ({
      contactId: item.contactId,
      success: false,
      error: 'Queued for processing'
    }));
  }
}

export const emailEnrichmentService = new EmailEnrichmentService();