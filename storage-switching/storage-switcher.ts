/**
 * Storage switcher - allows easy transition between PostgreSQL and Replit DB
 */
import { ReplitStorage } from './simplified-storage-replit';
import { IStorage } from '../server/storage/index';

// Set to true to use Replit DB, false to use PostgreSQL
const USE_REPLIT_DB = true;

// Create the Replit storage instance
const replitStorage = new ReplitStorage();

// Export the selected storage implementation
export const storage: IStorage = replitStorage;

// Log which storage is being used
console.log(`Using Replit Database for storage`);