import { SearchSessionManager } from "./search-session-manager";

interface GuestCleanupResult {
  preservedQuery: string | null;
  wasGuest: boolean;
}

/**
 * Clean up guest user data and preserve search query for registered user
 */
export const cleanupGuestData = (): GuestCleanupResult => {
  console.log('Starting guest data cleanup...');
  
  // 1. Preserve search query from current search state
  const savedState = localStorage.getItem('searchState');
  let preservedQuery = null;
  
  if (savedState) {
    try {
      const { currentQuery } = JSON.parse(savedState);
      preservedQuery = currentQuery;
      console.log('Preserved search query:', preservedQuery);
    } catch (error) {
      console.error('Error parsing saved state:', error);
    }
  }
  
  // 2. Clean guest-specific data that shouldn't persist to registered user
  const keysToRemove = [
    'searchState',           // Remove search results (not owned by new user)
    'currentSessionId',      // Clear active search sessions
    // Keep user preferences: contactSearchConfig, searchType (will be upgraded automatically)
  ];
  
  console.log('Removing guest localStorage keys:', keysToRemove);
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // 3. Clean all search sessions to prevent orphaned session data
  try {
    SearchSessionManager.clearAllSessions();
    console.log('Cleared all search sessions');
  } catch (error) {
    console.error('Error clearing search sessions:', error);
  }
  
  console.log('Guest cleanup completed');
  
  return {
    preservedQuery,
    wasGuest: true
  };
};