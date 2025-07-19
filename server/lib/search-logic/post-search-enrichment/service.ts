import { enrichmentQueue } from './queue';
import type { EnrichmentQueueItem, QueueStatus } from './types';
import { storage } from '../../../storage';

class PostSearchEnrichmentService {
  async startEnrichment(searchId: string, contactIds: number[]): Promise<string> {
    console.log(`Starting post-search enrichment for contacts: ${contactIds?.join(',')}`);

    // Get contacts for enrichment
    let contacts = [];
    if (contactIds && contactIds.length > 0) {
      // Get only specified contacts
      contacts = await Promise.all(
        contactIds.map(id => storage.getContact(id))
      );
      contacts = contacts.filter(c => c !== undefined) as any[];
    }

    if (contacts.length === 0) {
      console.log('No contacts found to enrich');
      throw new Error('No contacts found to enrich');
    }

    console.log(`Found ${contacts.length} contacts for enrichment`);

    // Create queue items with proper prioritization
    const queueItems: EnrichmentQueueItem[] = contacts.map(contact => ({
      contactId: contact.id,
      companyId: contact.companyId,
      searchId,
      priority: contact.nameConfidenceScore || 50
    }));

    // Add to queue and start processing
    const queueId = await enrichmentQueue.addToQueue(searchId, queueItems);
    console.log(`Created enrichment queue ${queueId} for ${queueItems.length} contacts`);

    return queueId;
  }

  getEnrichmentStatus(queueId: string): QueueStatus | undefined {
    const status = enrichmentQueue.getStatus(queueId);
    if (status) {
      console.log(`Queue ${queueId} status: ${status.status}, completed ${status.completedItems}/${status.totalItems}`);
    }
    return status;
  }
}

export const postSearchEnrichmentService = new PostSearchEnrichmentService();