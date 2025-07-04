import { EmailProvider, EmailProviderService, EmailMessage } from './types.js';
import { EmailProviderStorage } from './storage.js';
import { GmailProvider } from './gmail-provider.js';

export class EmailProviderManager {
  private providers: Map<string, EmailProviderService> = new Map();

  constructor() {
    // Register available email providers
    this.providers.set('gmail', new GmailProvider());
    // Future providers:
    // this.providers.set('outlook', new OutlookProvider());
    // this.providers.set('smtp', new SMTPProvider());
  }

  /**
   * Get available provider types
   */
  getAvailableProviderTypes(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all email providers for a user
   */
  async getUserProviders(userId: number): Promise<EmailProvider[]> {
    try {
      console.log(`[EmailProviderManager] Getting providers for user ${userId}`);
      const providers = await EmailProviderStorage.getUserProviders(userId);
      
      console.log(`[EmailProviderManager] Found ${providers.length} providers for user ${userId}`);
      return providers;
    } catch (error) {
      console.error(`[EmailProviderManager] Error getting providers for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user's default email provider
   */
  async getDefaultProvider(userId: number): Promise<EmailProvider | null> {
    try {
      console.log(`[EmailProviderManager] Getting default provider for user ${userId}`);
      const defaultProvider = await EmailProviderStorage.getDefaultProvider(userId);
      
      if (defaultProvider) {
        console.log(`[EmailProviderManager] Default provider for user ${userId}: ${defaultProvider.id} (${defaultProvider.email})`);
      } else {
        console.log(`[EmailProviderManager] No default provider found for user ${userId}`);
      }
      
      return defaultProvider;
    } catch (error) {
      console.error(`[EmailProviderManager] Error getting default provider for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Start OAuth flow for new email provider
   */
  async addProvider(userId: number, providerType: string): Promise<string> {
    try {
      console.log(`[EmailProviderManager] Starting OAuth flow for ${providerType} provider for user ${userId}`);
      
      const providerService = this.providers.get(providerType);
      if (!providerService) {
        throw new Error(`Unsupported provider type: ${providerType}`);
      }

      const authUrl = await providerService.authenticate(userId);
      
      console.log(`[EmailProviderManager] Generated OAuth URL for ${providerType} provider for user ${userId}`);
      return authUrl;
    } catch (error) {
      console.error(`[EmailProviderManager] Error starting OAuth for ${providerType} provider for user ${userId}:`, error);
      throw new Error(`Failed to start OAuth flow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle OAuth callback for email provider
   */
  async handleCallback(providerType: string, code: string, state: string): Promise<EmailProvider> {
    try {
      console.log(`[EmailProviderManager] Handling OAuth callback for ${providerType} provider`);
      
      const providerService = this.providers.get(providerType);
      if (!providerService) {
        throw new Error(`Unsupported provider type: ${providerType}`);
      }

      const provider = await providerService.handleCallback(code, state);
      
      console.log(`[EmailProviderManager] Successfully created ${providerType} provider: ${provider.id} for user ${provider.userId}`);
      return provider;
    } catch (error) {
      console.error(`[EmailProviderManager] Error handling OAuth callback for ${providerType}:`, error);
      throw new Error(`Failed to handle OAuth callback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove email provider
   */
  async removeProvider(userId: number, providerId: string): Promise<void> {
    try {
      console.log(`[EmailProviderManager] Removing provider ${providerId} for user ${userId}`);
      
      const provider = await EmailProviderStorage.getProvider(userId, providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      const providerService = this.providers.get(provider.type);
      if (!providerService) {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      // Disconnect via provider service
      await providerService.disconnect(provider);
      
      console.log(`[EmailProviderManager] Successfully removed provider ${providerId} for user ${userId}`);
    } catch (error) {
      console.error(`[EmailProviderManager] Error removing provider ${providerId} for user ${userId}:`, error);
      throw new Error(`Failed to remove provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set default email provider
   */
  async setDefaultProvider(userId: number, providerId: string): Promise<void> {
    try {
      console.log(`[EmailProviderManager] Setting default provider ${providerId} for user ${userId}`);
      
      const provider = await EmailProviderStorage.getProvider(userId, providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      await EmailProviderStorage.setDefaultProvider(userId, providerId);
      
      console.log(`[EmailProviderManager] Successfully set default provider ${providerId} for user ${userId}`);
    } catch (error) {
      console.error(`[EmailProviderManager] Error setting default provider for user ${userId}:`, error);
      throw new Error(`Failed to set default provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email using specified or default provider
   */
  async sendEmail(userId: number, message: EmailMessage, providerId?: string): Promise<{
    success: boolean;
    providerId?: string;
    error?: string;
  }> {
    try {
      console.log(`[EmailProviderManager] Sending email for user ${userId}, providerId: ${providerId || 'default'}`);
      
      let provider: EmailProvider | null;
      
      if (providerId) {
        provider = await EmailProviderStorage.getProvider(userId, providerId);
        if (!provider) {
          throw new Error(`Provider not found: ${providerId}`);
        }
      } else {
        provider = await this.getDefaultProvider(userId);
        if (!provider) {
          throw new Error('No default email provider configured');
        }
      }

      const providerService = this.providers.get(provider.type);
      if (!providerService) {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      console.log(`[EmailProviderManager] Sending email via provider ${provider.id} (${provider.email})`);
      
      const success = await providerService.sendEmail(provider, message);
      
      if (success) {
        console.log(`[EmailProviderManager] Successfully sent email via provider ${provider.id}`);
        return { success: true, providerId: provider.id };
      } else {
        console.error(`[EmailProviderManager] Failed to send email via provider ${provider.id}`);
        return { success: false, providerId: provider.id, error: 'Email sending failed' };
      }

    } catch (error) {
      console.error(`[EmailProviderManager] Error sending email for user ${userId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate email provider connection
   */
  async validateProvider(userId: number, providerId: string): Promise<boolean> {
    try {
      console.log(`[EmailProviderManager] Validating provider ${providerId} for user ${userId}`);
      
      const provider = await EmailProviderStorage.getProvider(userId, providerId);
      if (!provider) {
        console.warn(`[EmailProviderManager] Provider not found: ${providerId}`);
        return false;
      }

      const providerService = this.providers.get(provider.type);
      if (!providerService) {
        console.warn(`[EmailProviderManager] Unsupported provider type: ${provider.type}`);
        return false;
      }

      const isValid = await providerService.validateConnection(provider);
      
      console.log(`[EmailProviderManager] Provider ${providerId} validation result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error(`[EmailProviderManager] Error validating provider ${providerId} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Refresh provider authentication
   */
  async refreshProvider(userId: number, providerId: string): Promise<EmailProvider | null> {
    try {
      console.log(`[EmailProviderManager] Refreshing provider ${providerId} for user ${userId}`);
      
      const provider = await EmailProviderStorage.getProvider(userId, providerId);
      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      const providerService = this.providers.get(provider.type);
      if (!providerService) {
        throw new Error(`Unsupported provider type: ${provider.type}`);
      }

      const refreshedProvider = await providerService.refreshAuth(provider);
      
      console.log(`[EmailProviderManager] Successfully refreshed provider ${providerId} for user ${userId}`);
      return refreshedProvider;
    } catch (error) {
      console.error(`[EmailProviderManager] Error refreshing provider ${providerId} for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get provider status summary for user
   */
  async getProviderStatusSummary(userId: number): Promise<{
    total: number;
    connected: number;
    expired: number;
    error: number;
    defaultProvider?: EmailProvider;
  }> {
    try {
      const providers = await this.getUserProviders(userId);
      const defaultProvider = await this.getDefaultProvider(userId);
      
      const summary = {
        total: providers.length,
        connected: providers.filter(p => p.status === 'connected').length,
        expired: providers.filter(p => p.status === 'expired').length,
        error: providers.filter(p => p.status === 'error').length,
        defaultProvider: defaultProvider || undefined
      };

      console.log(`[EmailProviderManager] Provider status summary for user ${userId}:`, summary);
      return summary;
    } catch (error) {
      console.error(`[EmailProviderManager] Error getting provider status summary for user ${userId}:`, error);
      return { total: 0, connected: 0, expired: 0, error: 0 };
    }
  }

  /**
   * Health check for all user providers
   */
  async healthCheckProviders(userId: number): Promise<{
    providerId: string;
    status: string;
    isValid: boolean;
  }[]> {
    try {
      console.log(`[EmailProviderManager] Running health check for all providers for user ${userId}`);
      
      const providers = await this.getUserProviders(userId);
      const results = [];

      for (const provider of providers) {
        const isValid = await this.validateProvider(userId, provider.id);
        results.push({
          providerId: provider.id,
          status: provider.status,
          isValid
        });
      }

      console.log(`[EmailProviderManager] Health check completed for user ${userId}, checked ${results.length} providers`);
      return results;
    } catch (error) {
      console.error(`[EmailProviderManager] Error during health check for user ${userId}:`, error);
      return [];
    }
  }
}