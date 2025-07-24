import { UserTokens, TokenValidationResult } from "./types";
import Database from '@replit/database';

// Replit DB instance for persistent token storage
const db = new Database();

export class TokenService {
  private static readonly TOKEN_KEY_PREFIX = "user_tokens:";
  private static readonly FIREBASE_UID_PREFIX = "firebase_uid:";

  private static getTokenKey(userId: number): string {
    return `${this.TOKEN_KEY_PREFIX}${userId}`;
  }

  private static getFirebaseUidKey(firebaseUid: string): string {
    return `${this.FIREBASE_UID_PREFIX}${firebaseUid}`;
  }

  /**
   * Save user tokens to Replit DB
   */
  static async saveUserTokens(userId: number, tokens: UserTokens): Promise<void> {
    const key = this.getTokenKey(userId);
    
    try {
      console.log(`[TokenService] Saving tokens for user ${userId} with key: ${key}`);
      
      const tokenData = {
        ...tokens,
        updatedAt: Date.now()
      };

      await db.set(key, JSON.stringify(tokenData));
      console.log(`[TokenService] Successfully saved tokens for user ${userId}`);
    } catch (error) {
      console.error(`Error saving tokens for user ${userId}:`, error);
      throw new Error(`Failed to save user tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user tokens from Replit DB
   */
  static async getUserTokens(userId: number): Promise<UserTokens | null> {
    const key = this.getTokenKey(userId);
    
    try {
      console.log(`[TokenService] Getting tokens for user ${userId} with key: ${key}`);
      const tokensData = await db.get(key);
      console.log(`[TokenService] Raw DB data for user ${userId}:`, tokensData ? 'found' : 'not found');
      
      if (!tokensData || tokensData.ok === false) {
        console.log(`[TokenService] No tokens found for user ${userId}`);
        return null;
      }

      try {
        // Extract value from Replit DB response wrapper format (following credit system pattern)
        const rawData = tokensData.value || tokensData;
        const tokens: UserTokens = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        console.log(`[TokenService] Successfully retrieved tokens for user ${userId}`);
        return tokens;
      } catch (parseError) {
        console.error(`Error parsing tokens data for user ${userId}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`Error getting tokens for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update only the Gmail access token (for refresh scenarios)
   */
  static async updateGmailToken(userId: number, accessToken: string, tokenExpiry?: number): Promise<boolean> {
    try {
      const existingTokens = await this.getUserTokens(userId);
      if (!existingTokens) {
        console.warn(`[TokenService] Cannot update Gmail token - no existing tokens for user ${userId}`);
        return false;
      }

      const updatedTokens: UserTokens = {
        ...existingTokens,
        gmailAccessToken: accessToken,
        tokenExpiry: tokenExpiry || (Date.now() + (3600 * 1000)), // Default 1 hour if not provided
        updatedAt: Date.now()
      };

      await this.saveUserTokens(userId, updatedTokens);
      console.log(`[TokenService] Successfully updated Gmail token for user ${userId}`);
      return true;
    } catch (error) {
      console.error(`Error updating Gmail token for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Delete user tokens from Replit DB
   */
  static async deleteUserTokens(userId: number): Promise<void> {
    const key = this.getTokenKey(userId);
    
    try {
      console.log(`[TokenService] Deleting tokens for user ${userId}`);
      await db.delete(key);
      console.log(`[TokenService] Successfully deleted tokens for user ${userId}`);
    } catch (error) {
      console.error(`Error deleting tokens for user ${userId}:`, error);
      throw new Error(`Failed to delete user tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate if tokens are present and not expired
   */
  static isTokenValid(tokens: UserTokens | null): TokenValidationResult {
    if (!tokens) {
      return {
        isValid: false,
        isExpired: false,
        needsRefresh: false
      };
    }

    const now = Date.now();
    const timeUntilExpiry = tokens.tokenExpiry - now;
    const isExpired = timeUntilExpiry <= 0;
    const needsRefresh = timeUntilExpiry <= (5 * 60 * 1000); // Refresh if expires within 5 minutes

    return {
      isValid: !isExpired && !!tokens.gmailAccessToken,
      isExpired,
      needsRefresh,
      remainingTime: Math.max(0, timeUntilExpiry)
    };
  }

  /**
   * Store Gmail tokens after OAuth flow (simplified - no user info)
   */
  static async storeGmailTokens(userId: number, gmailTokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  }): Promise<void> {
    try {
      const existingTokens = await this.getUserTokens(userId);
      
      const tokens: UserTokens = {
        gmailAccessToken: gmailTokens.access_token,
        gmailRefreshToken: gmailTokens.refresh_token,
        tokenExpiry: gmailTokens.expiry_date || (Date.now() + (3600 * 1000)), // Default 1 hour
        scopes: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/userinfo.email'],
        createdAt: existingTokens?.createdAt || Date.now(),
        updatedAt: Date.now(),
        senderName: existingTokens?.senderName // Preserve existing sender name if set
      };
      
      await this.saveUserTokens(userId, tokens);
      console.log(`[TokenService] Successfully stored Gmail tokens for user ${userId}`);
    } catch (error) {
      console.error(`Error storing Gmail tokens for user ${userId}:`, error);
      throw new Error(`Failed to store Gmail tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if user has valid Gmail authentication
   */
  static async hasValidGmailAuth(userId: number): Promise<boolean> {
    try {
      const tokens = await this.getUserTokens(userId);
      const validationResult = this.isTokenValid(tokens);
      
      console.log(`Checking Gmail auth status: {
        userId: ${userId},
        hasValidAuth: ${validationResult.isValid},
        timestamp: '${new Date().toISOString()}'
      }`);
      
      return validationResult.isValid;
    } catch (error) {
      console.error(`Error checking Gmail auth for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Refresh Gmail access token using refresh token
   */
  static async refreshGmailToken(userId: number): Promise<boolean> {
    try {
      const tokens = await this.getUserTokens(userId);
      if (!tokens?.gmailRefreshToken) {
        console.warn(`[TokenService] Cannot refresh token - no refresh token for user ${userId}`);
        return false;
      }

      console.log(`[TokenService] Attempting to refresh Gmail token for user ${userId}`);

      // Import Google OAuth2 module at runtime
      const { google } = await import('googleapis');
      
      // Create OAuth2 client with correct Gmail API credentials (not Firebase)
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
        // No redirect URI needed for refresh
      );

      // Set refresh token
      oauth2Client.setCredentials({
        refresh_token: tokens.gmailRefreshToken
      });

      // Request new access token using Google OAuth2 library
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        console.warn(`[TokenService] Token refresh failed - no access token received for user ${userId}`);
        return false;
      }

      // Update stored token with new access token and expiry
      const success = await this.updateGmailToken(
        userId, 
        credentials.access_token,
        credentials.expiry_date || undefined
      );

      if (success) {
        console.log(`[TokenService] Successfully refreshed Gmail token for user ${userId}`);
        return true;
      } else {
        console.warn(`[TokenService] Failed to store refreshed token for user ${userId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error refreshing Gmail token for user ${userId}:`, error);
      // Common errors: refresh token expired, revoked, or invalid
      return false;
    }
  }



  /**
   * Get Gmail access token for API calls (with automatic validation)
   */
  static async getGmailAccessToken(userId: number): Promise<string | null> {
    const tokens = await this.getUserTokens(userId);
    const validation = this.isTokenValid(tokens);
    
    if (!validation.isValid) {
      console.warn(`[TokenService] Invalid or expired Gmail token for user ${userId}`);
      return null;
    }

    if (validation.needsRefresh) {
      console.log(`[TokenService] Token needs refresh for user ${userId}, attempting refresh`);
      const refreshed = await this.refreshGmailToken(userId);
      if (refreshed) {
        // Get updated token after refresh
        const refreshedTokens = await this.getUserTokens(userId);
        return refreshedTokens?.gmailAccessToken || null;
      }
      // If refresh failed, return null to trigger re-authorization
      return null;
    }

    return tokens!.gmailAccessToken;
  }

  /**
   * Get sender name from stored tokens
   */
  static async getSenderName(userId: number): Promise<string | null> {
    try {
      const tokens = await this.getUserTokens(userId);
      if (!tokens) {
        console.log(`[TokenService] No tokens found for user ${userId}`);
        return null;
      }

      console.log(`[TokenService] Retrieved sender name for user ${userId}: ${tokens.senderName ? 'set' : 'not set'}`);
      return tokens.senderName || null;
    } catch (error) {
      console.error(`Error getting sender name for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update sender name for user
   */
  static async updateSenderName(userId: number, senderName: string): Promise<void> {
    try {
      const tokens = await this.getUserTokens(userId);
      if (!tokens) {
        throw new Error(`No Gmail tokens found for user ${userId}`);
      }

      tokens.senderName = senderName.trim();
      tokens.updatedAt = Date.now();
      
      await this.saveUserTokens(userId, tokens);
      console.log(`[TokenService] Updated sender name for user ${userId}`);
    } catch (error) {
      console.error(`Error updating sender name for user ${userId}:`, error);
      throw new Error(`Failed to update sender name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store Firebase UID to User ID mapping (optional index for fast lookup)
   */
  static async storeFirebaseUidMapping(firebaseUid: string, userId: number): Promise<void> {
    const key = this.getFirebaseUidKey(firebaseUid);
    try {
      await db.set(key, JSON.stringify(userId));
      console.log(`[TokenService] Stored Firebase UID mapping: ${firebaseUid} -> ${userId}`);
    } catch (error) {
      console.error(`Error storing Firebase UID mapping:`, error);
      // Don't throw - this is optional functionality
    }
  }

  /**
   * Get User ID from Firebase UID (optional lookup)
   */
  static async getUserIdFromFirebaseUid(firebaseUid: string): Promise<number | null> {
    const key = this.getFirebaseUidKey(firebaseUid);
    try {
      const userIdData = await db.get(key);
      if (!userIdData || userIdData.ok === false) {
        return null;
      }
      
      // Extract value from Replit DB response wrapper format
      const rawData = userIdData.value || userIdData;
      const userId = typeof rawData === 'string' ? parseInt(rawData) : rawData;
      return typeof userId === 'number' ? userId : null;
    } catch (error) {
      console.error(`Error getting user ID from Firebase UID:`, error);
      return null;
    }
  }
}

// Export types
export type { UserTokens, TokenValidationResult } from "./types";