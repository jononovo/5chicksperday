/**
 * Storage implementation - Clean Replit Database only
 */
import { cleanStorage } from './replit-storage-clean';

// Export clean Replit storage implementation
export const storage = cleanStorage;

// Log storage type
console.log('Using Clean Replit Database for storage');