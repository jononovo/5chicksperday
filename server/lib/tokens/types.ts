export interface UserTokens {
  firebaseIdToken?: string;  // Optional since Gmail OAuth is separate from Firebase
  gmailAccessToken?: string;
  gmailRefreshToken?: string;
  tokenExpiry?: number;
  scopes?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  needsRefresh: boolean;
  remainingTime?: number;
}