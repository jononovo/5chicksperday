import { google } from 'googleapis';
import { EmailProvider, EmailProviderService, EmailMessage, AuthState } from './types.js';
import { EmailProviderStorage } from './storage.js';

export class GmailProvider implements EmailProviderService {
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  private getOAuth2Client() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    
    // Determine the correct base URL for the current environment
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      // Try to get the domain from REPLIT_DOMAINS or fall back to localhost
      const replitDomains = process.env.REPLIT_DOMAINS;
      if (replitDomains) {
        // Use the first domain from the list
        const domains = replitDomains.split(',');
        baseUrl = `https://${domains[0]}`;
      } else {
        baseUrl = 'http://localhost:5000';
      }
    }
    
    const redirectUri = `${baseUrl}/api/email-providers/gmail/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.');
    }

    console.log(`[GmailProvider] Using OAuth redirect URI: ${redirectUri}`);

    return new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  /**
   * Start Gmail OAuth authentication flow
   */
  async authenticate(userId: number): Promise<string> {
    const oauth2Client = this.getOAuth2Client();
    
    // Create state parameter with user context
    const state: AuthState = {
      userId,
      type: 'gmail',
      timestamp: Date.now()
    };

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GmailProvider.SCOPES,
      prompt: 'consent',
      state: JSON.stringify(state)
    });

    console.log(`[GmailProvider] Generated OAuth URL for user ${userId}:`, {
      hasClientId: !!process.env.GMAIL_CLIENT_ID,
      hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
      scopes: GmailProvider.SCOPES.length,
      accessType: 'offline'
    });

    return authUrl;
  }

  /**
   * Handle OAuth callback and create email provider
   */
  async handleCallback(code: string, state: string): Promise<EmailProvider> {
    const oauth2Client = this.getOAuth2Client();

    try {
      // Parse state parameter
      const authState: AuthState = JSON.parse(state);
      const userId = authState.userId;

      console.log(`[GmailProvider] Exchanging OAuth code for tokens for user ${userId}`);
      
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received from Google OAuth');
      }

      if (!tokens.refresh_token) {
        throw new Error('No refresh token received from Google OAuth. User may need to revoke existing permissions first.');
      }

      const expiryDate = tokens.expiry_date || (Date.now() + 3600 * 1000);

      // Get user email from Google
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      
      if (!userInfo.data.email) {
        throw new Error('Could not retrieve user email from Google');
      }

      const userEmail = userInfo.data.email;
      
      console.log(`[GmailProvider] Successfully obtained Gmail tokens for user ${userId}:`, {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        userEmail: userEmail,
        expiryDate: new Date(expiryDate).toISOString()
      });

      // Create email provider
      const providerId = EmailProviderStorage.generateProviderId('gmail', userEmail);
      const provider: EmailProvider = {
        id: providerId,
        userId,
        type: 'gmail',
        displayName: `Gmail - ${userEmail}`,
        email: userEmail,
        status: 'connected',
        authData: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry: expiryDate,
          scopes: GmailProvider.SCOPES
        },
        isDefault: false, // Will be set by storage if first provider
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Store the provider
      await EmailProviderStorage.storeProvider(provider);

      return provider;

    } catch (error) {
      console.error(`[GmailProvider] OAuth callback error:`, error);
      throw new Error(`Failed to exchange OAuth code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh Gmail access token
   */
  async refreshAuth(provider: EmailProvider): Promise<EmailProvider> {
    const oauth2Client = this.getOAuth2Client();

    try {
      console.log(`[GmailProvider] Refreshing token for provider ${provider.id}`);

      if (!provider.authData.refreshToken) {
        throw new Error('No refresh token available');
      }

      oauth2Client.setCredentials({
        refresh_token: provider.authData.refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('No access token in refresh response');
      }

      const expiryDate = credentials.expiry_date || (Date.now() + 3600 * 1000);

      console.log(`[GmailProvider] Successfully refreshed token for provider ${provider.id}:`, {
        newExpiryDate: new Date(expiryDate).toISOString()
      });

      // Update provider with new token
      const updatedProvider = await EmailProviderStorage.updateProvider(
        provider.userId,
        provider.id,
        {
          authData: {
            ...provider.authData,
            accessToken: credentials.access_token,
            tokenExpiry: expiryDate
          },
          status: 'connected',
          updatedAt: Date.now()
        }
      );

      if (!updatedProvider) {
        throw new Error('Failed to update provider after token refresh');
      }

      return updatedProvider;

    } catch (error) {
      console.error(`[GmailProvider] Token refresh error for provider ${provider.id}:`, error);
      
      // Mark provider as expired
      await EmailProviderStorage.updateProvider(
        provider.userId,
        provider.id,
        {
          status: 'expired',
          updatedAt: Date.now()
        }
      );

      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email using Gmail API
   */
  async sendEmail(provider: EmailProvider, message: EmailMessage): Promise<boolean> {
    try {
      console.log(`[GmailProvider] Sending email via provider ${provider.id}`);

      // Check if token needs refresh
      const validProvider = await this.ensureValidToken(provider);
      
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: validProvider.authData.accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Construct email
      const emailLines = [
        `From: ${validProvider.email}`,
        `To: ${message.to.join(', ')}`,
        ...(message.cc ? [`Cc: ${message.cc.join(', ')}`] : []),
        ...(message.bcc ? [`Bcc: ${message.bcc.join(', ')}`] : []),
        `Subject: ${message.subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        message.html || message.text || ''
      ];

      const rawEmail = emailLines.join('\r\n');
      const encodedEmail = Buffer.from(rawEmail).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      if (response.status === 200) {
        console.log(`[GmailProvider] Successfully sent email via provider ${provider.id}, messageId: ${response.data.id}`);
        return true;
      } else {
        console.error(`[GmailProvider] Failed to send email, status: ${response.status}`);
        return false;
      }

    } catch (error) {
      console.error(`[GmailProvider] Error sending email via provider ${provider.id}:`, error);
      
      // If error is auth-related, mark provider as expired
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('unauthorized'))) {
        await EmailProviderStorage.updateProvider(
          provider.userId,
          provider.id,
          {
            status: 'expired',
            updatedAt: Date.now()
          }
        );
      }

      return false;
    }
  }

  /**
   * Disconnect Gmail provider
   */
  async disconnect(provider: EmailProvider): Promise<void> {
    try {
      console.log(`[GmailProvider] Disconnecting provider ${provider.id}`);

      // Optionally revoke tokens with Google
      if (provider.authData.accessToken) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${provider.authData.accessToken}`, {
            method: 'POST'
          });
        } catch (revokeError) {
          console.warn(`[GmailProvider] Failed to revoke token with Google:`, revokeError);
          // Continue with local cleanup even if revoke fails
        }
      }

      // Remove provider from storage
      await EmailProviderStorage.removeProvider(provider.userId, provider.id);

      console.log(`[GmailProvider] Successfully disconnected provider ${provider.id}`);
    } catch (error) {
      console.error(`[GmailProvider] Error disconnecting provider ${provider.id}:`, error);
      throw new Error(`Failed to disconnect Gmail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Gmail provider connection
   */
  async validateConnection(provider: EmailProvider): Promise<boolean> {
    try {
      console.log(`[GmailProvider] Validating connection for provider ${provider.id}`);

      const validProvider = await this.ensureValidToken(provider);
      
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        access_token: validProvider.authData.accessToken
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Test connection by getting profile
      const response = await gmail.users.getProfile({ userId: 'me' });
      
      if (response.status === 200) {
        console.log(`[GmailProvider] Connection valid for provider ${provider.id}`);
        
        // Update status to connected if it was expired
        if (provider.status !== 'connected') {
          await EmailProviderStorage.updateProvider(
            provider.userId,
            provider.id,
            {
              status: 'connected',
              updatedAt: Date.now()
            }
          );
        }
        
        return true;
      } else {
        console.warn(`[GmailProvider] Connection invalid for provider ${provider.id}, status: ${response.status}`);
        return false;
      }

    } catch (error) {
      console.error(`[GmailProvider] Connection validation failed for provider ${provider.id}:`, error);
      
      // Mark provider as expired or error
      await EmailProviderStorage.updateProvider(
        provider.userId,
        provider.id,
        {
          status: error instanceof Error && error.message.includes('401') ? 'expired' : 'error',
          updatedAt: Date.now()
        }
      );

      return false;
    }
  }

  /**
   * Ensure provider has valid token, refresh if needed
   */
  private async ensureValidToken(provider: EmailProvider): Promise<EmailProvider> {
    const now = Date.now();
    const tokenExpiry = provider.authData.tokenExpiry || 0;
    const timeUntilExpiry = tokenExpiry - now;
    const needsRefresh = timeUntilExpiry <= (5 * 60 * 1000); // Refresh if expires within 5 minutes

    if (needsRefresh) {
      console.log(`[GmailProvider] Token needs refresh for provider ${provider.id}`);
      return await this.refreshAuth(provider);
    }

    return provider;
  }
}