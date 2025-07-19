import type { EnrichmentQueueItem, QueueStatus, EnrichmentResult } from './types';
import { storage } from '../../../storage';
import { searchContactDetails } from '../../api-interactions';

class EnrichmentQueue {
  private queue: Map<string, EnrichmentQueueItem[]> = new Map();
  private status: Map<string, QueueStatus> = new Map();
  private processing: boolean = false;

  generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async addToQueue(searchId: string, contacts: EnrichmentQueueItem[]): Promise<string> {
    const queueId = this.generateQueueId();
    this.queue.set(queueId, contacts);
    this.status.set(queueId, {
      queueId,
      totalItems: contacts.length,
      completedItems: 0,
      status: 'pending',
      lastUpdated: new Date(),
      searchId
    });

    // Start processing immediately if not already processing
    if (!this.processing) {
      void this.processQueue(queueId);
    }

    return queueId;
  }

  getStatus(queueId: string): QueueStatus | undefined {
    return this.status.get(queueId);
  }

  private async processQueue(queueId: string): Promise<void> {
    if (this.processing) return;

    this.processing = true;
    const items = this.queue.get(queueId);

    if (!items || items.length === 0) {
      this.processing = false;
      return;
    }

    try {
      this.updateStatus(queueId, 'processing');
      console.log(`Starting to process queue ${queueId} with ${items.length} items`);

      for (const item of items) {
        try {
          const contact = await storage.getContact(item.contactId);
          if (!contact) {
            console.log(`Contact ${item.contactId} not found, skipping`);
            continue;
          }

          const company = await storage.getCompany(item.companyId);
          if (!company) {
            console.log(`Company ${item.companyId} not found for contact ${item.contactId}, skipping`);
            continue;
          }

          console.log(`Processing contact ${contact.name} from ${company.name}`);
          const enrichedDetails = await searchContactDetails(contact.name, company.name);

          if (Object.keys(enrichedDetails).length > 0) {
            await storage.updateContact(item.contactId, {
              ...enrichedDetails,
              completedSearches: [...(contact.completedSearches || []), 'contact_enrichment'],
              lastEnriched: new Date()
            });
            console.log(`Successfully enriched contact ${contact.name}`);
          } else {
            console.log(`No enriched details found for contact ${contact.name}`);
          }

          this.incrementCompleted(queueId);

          // Add a small delay between processing items to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Error processing contact ${item.contactId}:`, error);
          // Continue processing other items even if one fails
        }
      }

      this.updateStatus(queueId, 'completed');
      console.log(`Completed processing queue ${queueId}`);

    } catch (error) {
      console.error('Queue processing error:', error);
      this.updateStatus(queueId, 'failed');
    } finally {
      this.processing = false;
      this.queue.delete(queueId); // Clean up the queue after processing
    }
  }

  private updateStatus(queueId: string, status: QueueStatus['status']): void {
    const current = this.status.get(queueId);
    if (current) {
      this.status.set(queueId, {
        ...current,
        status,
        lastUpdated: new Date()
      });
      console.log(`Updated queue ${queueId} status to ${status}`);
    }
  }

  private incrementCompleted(queueId: string): void {
    const current = this.status.get(queueId);
    if (current) {
      const completedItems = current.completedItems + 1;
      this.status.set(queueId, {
        ...current,
        completedItems,
        lastUpdated: new Date()
      });
      console.log(`Queue ${queueId}: Completed ${completedItems}/${current.totalItems} items`);
    }
  }
}

export const enrichmentQueue = new EnrichmentQueue();