/**
 * Storage implementation - Replit Database only
 */
import { storage as replitStorage } from './simplified-storage-replit';
import { IStorage } from '../server/storage/index';

// Export Replit storage implementation
export const storage: IStorage = replitStorage;

// Log storage type
console.log('Using Replit Database for storage');