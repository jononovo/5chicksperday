import Database from '@replit/database';
import { EmailProvider } from './types.js';

const db = new Database();

export class EmailProviderStorage {
  private static readonly PROVIDER_PREFIX = "email_provider:";
  private static readonly USER_PROVIDERS_PREFIX = "user_email_providers:";
  private static readonly DEFAULT_PROVIDER_PREFIX = "default_email_provider:";

  /**
   * Store email provider in Replit DB
   */
  static async storeProvider(provider: EmailProvider): Promise<void> {
    const key = `${this.PROVIDER_PREFIX}${provider.userId}:${provider.id}`;
    
    try {
      console.log(`[EmailProviderStorage] Storing provider ${provider.id} for user ${provider.userId}`);
      
      const providerData = {
        ...provider,
        updatedAt: Date.now()
      };

      await db.set(key, JSON.stringify(providerData));
      
      // Update user's provider list
      await this.addToUserProvidersList(provider.userId, provider.id);
      
      // Set as default if it's the first provider
      const userProviders = await this.getUserProviders(provider.userId);
      if (userProviders.length === 1 || provider.isDefault) {
        await this.setDefaultProvider(provider.userId, provider.id);
      }
      
      console.log(`[EmailProviderStorage] Successfully stored provider ${provider.id} for user ${provider.userId}`);
    } catch (error) {
      console.error(`Error storing provider ${provider.id} for user ${provider.userId}:`, error);
      throw new Error(`Failed to store email provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific email provider
   */
  static async getProvider(userId: number, providerId: string): Promise<EmailProvider | null> {
    const key = `${this.PROVIDER_PREFIX}${userId}:${providerId}`;
    
    try {
      console.log(`[EmailProviderStorage] Getting provider ${providerId} for user ${userId}`);
      const data = await db.get(key);
      
      if (!data || data.ok === false) {
        console.log(`[EmailProviderStorage] No provider found: ${providerId} for user ${userId}`);
        return null;
      }

      try {
        const rawData = data.value || data;
        const provider: EmailProvider = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        
        console.log(`[EmailProviderStorage] Successfully retrieved provider ${providerId} for user ${userId}`);
        return provider;
      } catch (parseError) {
        console.error(`Error parsing provider data for ${providerId}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`Error getting provider ${providerId} for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get all email providers for a user
   */
  static async getUserProviders(userId: number): Promise<EmailProvider[]> {
    const listKey = `${this.USER_PROVIDERS_PREFIX}${userId}`;
    
    try {
      console.log(`[EmailProviderStorage] Getting all providers for user ${userId}`);
      const providerIds = await db.get(listKey);
      
      if (!providerIds || providerIds.ok === false) {
        console.log(`[EmailProviderStorage] No providers found for user ${userId}`);
        return [];
      }
      
      const rawData = providerIds.value || providerIds;
      const ids: string[] = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      const providers: EmailProvider[] = [];
      
      for (const id of ids) {
        const provider = await this.getProvider(userId, id);
        if (provider) {
          providers.push(provider);
        }
      }
      
      console.log(`[EmailProviderStorage] Found ${providers.length} providers for user ${userId}`);
      return providers;
    } catch (error) {
      console.error(`Error getting providers for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Set default email provider for user
   */
  static async setDefaultProvider(userId: number, providerId: string): Promise<void> {
    const key = `${this.DEFAULT_PROVIDER_PREFIX}${userId}`;
    
    try {
      console.log(`[EmailProviderStorage] Setting default provider ${providerId} for user ${userId}`);
      
      // First, unset default flag on all user providers
      const userProviders = await this.getUserProviders(userId);
      for (const provider of userProviders) {
        if (provider.isDefault && provider.id !== providerId) {
          await this.updateProvider(userId, provider.id, { isDefault: false });
        }
      }
      
      // Set new default provider
      await db.set(key, providerId);
      await this.updateProvider(userId, providerId, { isDefault: true });
      
      console.log(`[EmailProviderStorage] Successfully set default provider ${providerId} for user ${userId}`);
    } catch (error) {
      console.error(`Error setting default provider for user ${userId}:`, error);
      throw new Error(`Failed to set default provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default email provider for user
   */
  static async getDefaultProvider(userId: number): Promise<EmailProvider | null> {
    const key = `${this.DEFAULT_PROVIDER_PREFIX}${userId}`;
    
    try {
      console.log(`[EmailProviderStorage] Getting default provider for user ${userId}`);
      const defaultId = await db.get(key);
      
      if (!defaultId || defaultId.ok === false) {
        console.log(`[EmailProviderStorage] No default provider set for user ${userId}`);
        
        // Try to get the first available provider
        const userProviders = await this.getUserProviders(userId);
        if (userProviders.length > 0) {
          await this.setDefaultProvider(userId, userProviders[0].id);
          return userProviders[0];
        }
        
        return null;
      }
      
      const rawData = defaultId.value || defaultId;
      const providerId = typeof rawData === 'string' ? rawData : rawData.toString();
      
      return await this.getProvider(userId, providerId);
    } catch (error) {
      console.error(`Error getting default provider for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Update email provider
   */
  static async updateProvider(userId: number, providerId: string, updates: Partial<EmailProvider>): Promise<EmailProvider | null> {
    try {
      const existingProvider = await this.getProvider(userId, providerId);
      if (!existingProvider) {
        console.warn(`[EmailProviderStorage] Cannot update provider - not found: ${providerId} for user ${userId}`);
        return null;
      }

      const updatedProvider: EmailProvider = {
        ...existingProvider,
        ...updates,
        updatedAt: Date.now()
      };

      await this.storeProvider(updatedProvider);
      console.log(`[EmailProviderStorage] Successfully updated provider ${providerId} for user ${userId}`);
      return updatedProvider;
    } catch (error) {
      console.error(`Error updating provider ${providerId} for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Remove email provider
   */
  static async removeProvider(userId: number, providerId: string): Promise<void> {
    const key = `${this.PROVIDER_PREFIX}${userId}:${providerId}`;
    
    try {
      console.log(`[EmailProviderStorage] Removing provider ${providerId} for user ${userId}`);
      
      // Remove from user's provider list
      await this.removeFromUserProvidersList(userId, providerId);
      
      // Remove provider data
      await db.delete(key);
      
      // If this was the default provider, clear default
      const defaultProvider = await this.getDefaultProvider(userId);
      if (defaultProvider && defaultProvider.id === providerId) {
        const defaultKey = `${this.DEFAULT_PROVIDER_PREFIX}${userId}`;
        await db.delete(defaultKey);
        
        // Set a new default if other providers exist
        const remainingProviders = await this.getUserProviders(userId);
        if (remainingProviders.length > 0) {
          await this.setDefaultProvider(userId, remainingProviders[0].id);
        }
      }
      
      console.log(`[EmailProviderStorage] Successfully removed provider ${providerId} for user ${userId}`);
    } catch (error) {
      console.error(`Error removing provider ${providerId} for user ${userId}:`, error);
      throw new Error(`Failed to remove email provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add provider ID to user's provider list
   */
  private static async addToUserProvidersList(userId: number, providerId: string): Promise<void> {
    const listKey = `${this.USER_PROVIDERS_PREFIX}${userId}`;
    
    try {
      const existingData = await db.get(listKey);
      let providerIds: string[] = [];
      
      if (existingData && existingData.ok !== false) {
        const rawData = existingData.value || existingData;
        providerIds = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      }
      
      if (!providerIds.includes(providerId)) {
        providerIds.push(providerId);
        await db.set(listKey, JSON.stringify(providerIds));
      }
    } catch (error) {
      console.error(`Error adding provider to user list:`, error);
      throw error;
    }
  }

  /**
   * Remove provider ID from user's provider list
   */
  private static async removeFromUserProvidersList(userId: number, providerId: string): Promise<void> {
    const listKey = `${this.USER_PROVIDERS_PREFIX}${userId}`;
    
    try {
      const existingData = await db.get(listKey);
      if (!existingData || existingData.ok === false) {
        return;
      }
      
      const rawData = existingData.value || existingData;
      const providerIds: string[] = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      
      const filteredIds = providerIds.filter(id => id !== providerId);
      await db.set(listKey, JSON.stringify(filteredIds));
    } catch (error) {
      console.error(`Error removing provider from user list:`, error);
      throw error;
    }
  }

  /**
   * Generate unique provider ID
   */
  static generateProviderId(type: string, email: string): string {
    return `${type}_${email.replace('@', '_').replace('.', '_')}_${Date.now()}`;
  }
}