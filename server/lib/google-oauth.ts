import { google } from 'googleapis';
import { TokenService } from './tokens/index.js';

// Initialize OAuth2 client
function getOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = `${process.env.BASE_URL || 'http://localhost:5000'}/api/gmail/oauth/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Gmail OAuth credentials not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.');
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

// Generate OAuth authorization URL
export function getGmailAuthUrl(userId: number): string {
  const oauth2Client = getOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: userId.toString() // Pass user ID in state parameter
  });

  console.log(`Generated Gmail OAuth URL for user ${userId}:`, {
    hasClientId: !!process.env.GMAIL_CLIENT_ID,
    hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
    scopes: scopes.length,
    accessType: 'offline'
  });

  return authUrl;
}

// Handle OAuth callback and exchange code for tokens
export async function handleOAuthCallback(code: string, userId: number): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
}> {
  const oauth2Client = getOAuth2Client();

  try {
    console.log(`Exchanging OAuth code for tokens for user ${userId}`);
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received from Google OAuth');
    }

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received from Google OAuth. User may need to revoke existing permissions first.');
    }

    const expiryDate = tokens.expiry_date || (Date.now() + 3600 * 1000); // Default to 1 hour

    console.log(`Successfully obtained Gmail tokens for user ${userId}:`, {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: new Date(expiryDate).toISOString()
    });

    // Store tokens using TokenService
    await TokenService.storeGmailTokens(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate
    });

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate
    };

  } catch (error) {
    console.error(`OAuth callback error for user ${userId}:`, error);
    throw new Error(`Failed to exchange OAuth code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Refresh Gmail access token using stored refresh token
export async function refreshGmailAccessToken(userId: number): Promise<{
  accessToken: string;
  expiryDate: number;
} | null> {
  try {
    const tokens = await TokenService.getUserTokens(userId);
    
    if (!tokens?.gmailRefreshToken) {
      console.log(`No refresh token available for user ${userId}`);
      return null;
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: tokens.gmailRefreshToken
    });

    console.log(`Attempting to refresh Gmail token for user ${userId}`);

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('No access token in refresh response');
    }

    const expiryDate = credentials.expiry_date || (Date.now() + 3600 * 1000);

    console.log(`Successfully refreshed Gmail token for user ${userId}:`, {
      newExpiryDate: new Date(expiryDate).toISOString()
    });

    // Update stored tokens
    await TokenService.updateGmailToken(userId, credentials.access_token, expiryDate);

    return {
      accessToken: credentials.access_token,
      expiryDate
    };

  } catch (error) {
    console.error(`Token refresh error for user ${userId}:`, error);
    return null;
  }
}

// Get valid Gmail access token (refresh if needed)
export async function getValidGmailToken(userId: number): Promise<string | null> {
  try {
    const tokens = await TokenService.getUserTokens(userId);
    
    if (!tokens) {
      console.log(`No tokens found for user ${userId}`);
      return null;
    }

    const validation = TokenService.isTokenValid(tokens);
    
    if (validation.isValid) {
      console.log(`Using existing valid token for user ${userId}`);
      return tokens.gmailAccessToken || null;
    }

    if (validation.needsRefresh && tokens.gmailRefreshToken) {
      console.log(`Token expired, attempting refresh for user ${userId}`);
      const refreshResult = await refreshGmailAccessToken(userId);
      
      if (refreshResult) {
        return refreshResult.accessToken;
      }
    }

    console.log(`Cannot provide valid token for user ${userId}:`, {
      hasToken: !!tokens.gmailAccessToken,
      hasRefreshToken: !!tokens.gmailRefreshToken,
      isExpired: validation.isExpired,
      needsRefresh: validation.needsRefresh
    });

    return null;

  } catch (error) {
    console.error(`Error getting valid Gmail token for user ${userId}:`, error);
    return null;
  }
}