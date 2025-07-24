export interface UserTokens {
  gmailAccessToken: string;
  gmailRefreshToken?: string;
  tokenExpiry: number;
  scopes: string[];
  createdAt: number;
  updatedAt: number;
  senderName?: string;    // User-provided sender name from dialog
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  needsRefresh: boolean;
  remainingTime?: number;
}