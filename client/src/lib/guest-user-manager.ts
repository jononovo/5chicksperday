/**
 * Guest User Manager - Handles persistent guest user IDs
 * Creates unique user IDs for guests that persist through registration
 */

interface GuestUser {
  id: number;
  isGuest: boolean;
  createdAt: string;
}

class GuestUserManager {
  private static readonly STORAGE_KEY = 'guest_user_data';
  private static readonly API_ENDPOINT = '/api/guest-user';

  /**
   * Get or create a guest user ID
   * Returns the same ID across browser sessions until registration
   */
  static async getOrCreateGuestUser(): Promise<number> {
    try {
      // Check if we already have a guest user stored locally
      const storedGuestData = localStorage.getItem(this.STORAGE_KEY);
      if (storedGuestData) {
        const guestUser: GuestUser = JSON.parse(storedGuestData);
        console.log('Retrieved existing guest user:', { id: guestUser.id, isGuest: guestUser.isGuest });
        return guestUser.id;
      }

      // Create new guest user on backend
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ createGuest: true })
      });

      if (!response.ok) {
        throw new Error(`Failed to create guest user: ${response.status}`);
      }

      const guestUser: GuestUser = await response.json();
      
      // Store guest user data locally
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(guestUser));
      
      console.log('Created new guest user:', { id: guestUser.id, isGuest: guestUser.isGuest });
      return guestUser.id;

    } catch (error) {
      console.error('Error managing guest user:', error);
      // Fallback to shared guest ID if something goes wrong
      return 1;
    }
  }

  /**
   * Clear guest user data after successful registration
   * Called when guest becomes authenticated user
   */
  static clearGuestData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Guest user data cleared after registration');
  }

  /**
   * Check if current user is a guest
   */
  static isGuestUser(): boolean {
    const storedGuestData = localStorage.getItem(this.STORAGE_KEY);
    return !!storedGuestData;
  }

  /**
   * Get current guest user ID if exists
   */
  static getCurrentGuestId(): number | null {
    try {
      const storedGuestData = localStorage.getItem(this.STORAGE_KEY);
      if (storedGuestData) {
        const guestUser: GuestUser = JSON.parse(storedGuestData);
        return guestUser.id;
      }
      return null;
    } catch (error) {
      console.error('Error getting current guest ID:', error);
      return null;
    }
  }
}

export default GuestUserManager;