import { log } from '../vite';

/**
 * Check if specific environment variables/secrets are available
 * @param keys Array of secret keys to check
 * @returns Boolean indicating if all secrets are available
 */
export async function check_secrets(keys: string[]): Promise<boolean> {
  const missing = keys.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log(`Missing required secrets: ${missing.join(', ')}`, 'secrets');
    return false;
  }
  
  return true;
}