import crypto from 'crypto';

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createExpirationDate(hours: number = 24): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > new Date(expiresAt);
}