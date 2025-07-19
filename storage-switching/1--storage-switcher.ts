/**
 * Storage switcher - allows easy transition between PostgreSQL and Replit DB
 */
import { storage as pgStorage } from '../server/1--storage/database';
import { storage as replitStorage } from './simplified-storage-replit';
import { IStorage } from '../server/1--storage/index';

// Set to true to use Replit DB, false to use PostgreSQL
const USE_REPLIT_DB = true;

// Export the selected storage implementation
export const storage: IStorage = USE_REPLIT_DB ? replitStorage : pgStorage;

// Log which storage is being used
console.log(`Using ${USE_REPLIT_DB ? 'Replit Database' : 'PostgreSQL'} for storage`);