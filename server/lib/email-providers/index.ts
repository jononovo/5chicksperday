// Main entry point for email providers system
import { EmailProviderManager } from './provider-manager.js';

export { EmailProviderManager } from './provider-manager.js';
export { EmailProviderStorage } from './storage.js';
export { GmailProvider } from './gmail-provider.js';
export type { 
  EmailProvider, 
  EmailProviderService, 
  EmailMessage, 
  EmailAttachment, 
  AuthState 
} from './types.js';

// Create singleton instance for use throughout the application
export const emailProviderManager = new EmailProviderManager();