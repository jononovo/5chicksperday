export interface EmailProvider {
  id: string;                    // Unique provider instance ID
  userId: number;               // Owner user ID
  type: 'gmail' | 'outlook' | 'smtp';
  displayName: string;          // User-friendly name
  email: string;               // Sender email address
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  authData: Record<string, any>; // Provider-specific auth data
  isDefault: boolean;          // Default sender for user
  createdAt: number;
  updatedAt: number;
}

export interface EmailProviderService {
  authenticate(userId: number): Promise<string>; // Returns auth URL
  handleCallback(code: string, state: string): Promise<EmailProvider>;
  refreshAuth(provider: EmailProvider): Promise<EmailProvider>;
  sendEmail(provider: EmailProvider, message: EmailMessage): Promise<boolean>;
  disconnect(provider: EmailProvider): Promise<void>;
  validateConnection(provider: EmailProvider): Promise<boolean>;
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface AuthState {
  userId: number;
  type: 'gmail' | 'outlook' | 'smtp';
  timestamp: number;
  redirectUrl?: string;
}