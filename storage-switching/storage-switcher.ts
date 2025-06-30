/**
 * Storage implementation - Firebase-first with Replit Database
 */
import { firebaseStorage } from './firebase-storage';

// Export Firebase storage implementation
export const storage = firebaseStorage;

// Log storage type
console.log('Using Firebase-first storage with Replit Database');