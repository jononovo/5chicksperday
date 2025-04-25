/**
 * Webhook Logger
 * A standalone utility to log all webhook requests that hit our endpoint
 * Provides simple and efficient monitoring of webhook activity
 */
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

// Configure the logger
const LOG_DIR = './webhook-logs';
const DETAILED_LOGGING = true;
const MAX_LOGS = 150; // Store more logs for better history

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`Created webhook log directory: ${LOG_DIR}`);
  } catch (err) {
    console.error(`Failed to create webhook log directory: ${err}`);
  }
}

/**
 * Safe logging function that handles circular references and large objects
 */
function safeStringify(obj: any, maxDepth = 5, depth = 0): string {
  if (depth > maxDepth) return '[Object]';
  
  if (obj === null || obj === undefined) return String(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  
  const safe: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip circular references and functions
    if (typeof value === 'function') {
      safe[key] = '[Function]';
    } else if (typeof value === 'object' && value !== null) {
      safe[key] = safeStringify(value, maxDepth, depth + 1);
    } else {
      safe[key] = value;
    }
  }
  
  return JSON.stringify(safe);
}

/**
 * Determines which provider sent the webhook based on request characteristics
 */
function detectProvider(req: Request): { provider: string, providerDir: string } {
  const url = req.originalUrl;
  const headers = req.headers;
  const body = req.body || {};
  const userAgent = headers['user-agent'] as string || '';
  
  // Look for indicators in headers and body
  if (
    url.includes('rabbit') || 
    userAgent.includes('rabbit') || 
    headers['x-lgr-search-id'] || 
    (body.searchId && body.searchId.includes('rabbit'))
  ) {
    return { provider: 'rabbit', providerDir: PROVIDER_DIRS.RABBIT };
  } 
  
  if (
    url.includes('donkey') || 
    userAgent.includes('donkey') || 
    headers['x-lgd-search-id'] || 
    (body.searchId && body.searchId.includes('donkey'))
  ) {
    return { provider: 'donkey', providerDir: PROVIDER_DIRS.DONKEY };
  }
  
  if (
    url.includes('lion') || 
    userAgent.includes('lion') || 
    headers['x-lgl-search-id'] || 
    (body.searchId && body.searchId.includes('lion'))
  ) {
    return { provider: 'lion', providerDir: PROVIDER_DIRS.LION };
  }
  
  // If no specific provider detected, use unknown
  return { provider: 'unknown', providerDir: PROVIDER_DIRS.UNKNOWN };
}

/**
 * Log the full request details to a file
 */
export function logWebhookRequest(req: Request, logPrefix = 'webhook'): void {
  try {
    // Create a sanitized request object
    const timestamp = new Date().toISOString();
    const { provider, providerDir } = detectProvider(req);
    const requestId = `${logPrefix}-${provider}-${Date.now()}`;
    
    console.log(`[WEBHOOK-LOGGER] Received request from ${provider} at ${timestamp}, ID: ${requestId}`);
    
    // Extract searchId for better organization
    const body = req.body || {};
    let searchId = '';
    
    if (body.searchId) {
      searchId = body.searchId;
    } else if (body.data && body.data.searchId) {
      searchId = body.data.searchId;
    } else if (body.payload && body.payload.searchId) {
      searchId = body.payload.searchId;
    } else if (req.query.searchId) {
      searchId = req.query.searchId as string;
    }
    
    const sanitizedRequest = {
      timestamp,
      requestId,
      provider,
      searchId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      headers: req.headers,
      query: req.query,
      body: req.body
    };
    
    // Create the log file in the provider-specific directory
    const logFile = path.join(providerDir, `${requestId}.json`);
    fs.writeFileSync(logFile, safeStringify(sanitizedRequest, 10));
    
    // Also save to main directory for backwards compatibility
    const mainLogFile = path.join(LOG_DIR, `${requestId}.json`);
    fs.writeFileSync(mainLogFile, safeStringify(sanitizedRequest, 10));
    
    // Log basic request info to console
    console.log(`[WEBHOOK-LOGGER] Provider: ${provider}, SearchID: ${searchId || 'not found'}`);
    console.log(`[WEBHOOK-LOGGER] Saved request to ${logFile}`);
    console.log(`[WEBHOOK-LOGGER] Request: ${req.method} ${req.originalUrl}`);
    
    if (DETAILED_LOGGING) {
      console.log(`[WEBHOOK-LOGGER] IP: ${req.ip}`);
      console.log(`[WEBHOOK-LOGGER] User-Agent: ${req.headers['user-agent'] || 'none'}`);
      
      // Only log a summary of headers and body to avoid console spam
      const headerKeys = Object.keys(req.headers).join(', ');
      console.log(`[WEBHOOK-LOGGER] Headers: ${headerKeys}`);
      
      const bodyKeys = Object.keys(req.body || {}).join(', ');
      console.log(`[WEBHOOK-LOGGER] Body keys: ${bodyKeys}`);
    }
    
    // Cleanup old logs if there are too many
    cleanupOldLogs();
    
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error logging webhook request:', error);
  }
}

/**
 * Delete oldest log files when we have too many
 */
function cleanupOldLogs(): void {
  try {
    // Clean up main directory
    let files = fs.readdirSync(LOG_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(LOG_DIR, file));
    
    if (files.length > MAX_LOGS) {
      // Sort by modification time (oldest first)
      const sortedFiles = files.sort((a, b) => {
        return fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime();
      });
      
      // Delete oldest files
      const filesToDelete = sortedFiles.slice(0, files.length - MAX_LOGS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file);
        console.log(`[WEBHOOK-LOGGER] Deleted old log: ${file}`);
      });
    }
    
    // Clean up each provider directory
    Object.values(PROVIDER_DIRS).forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          files = fs.readdirSync(dir)
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(dir, file));
          
          if (files.length > MAX_LOGS / 2) { // Keep fewer logs per provider
            // Sort by modification time (oldest first)
            const sortedFiles = files.sort((a, b) => {
              return fs.statSync(a).mtime.getTime() - fs.statSync(b).mtime.getTime();
            });
            
            // Delete oldest files
            const filesToDelete = sortedFiles.slice(0, files.length - MAX_LOGS / 2);
            filesToDelete.forEach(file => {
              fs.unlinkSync(file);
              console.log(`[WEBHOOK-LOGGER] Deleted old provider log: ${file}`);
            });
          }
        }
      } catch (err) {
        console.error(`[WEBHOOK-LOGGER] Error cleaning up provider directory ${dir}:`, err);
      }
    });
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error cleaning up old logs:', error);
  }
}

/**
 * Get provider name from directory path
 */
function getProviderFromPath(dirPath: string): string {
  const parts = dirPath.split(path.sep);
  return parts[parts.length - 1];
}

/**
 * Utility function to get logs from a specific directory
 */
function getLogsFromDirectory(dir: string): Array<{file: string, timestamp: Date, requestId: string, provider: string}> {
  if (!fs.existsSync(dir)) {
    return [];
  }
  
  try {
    return fs.readdirSync(dir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const requestId = file.replace('.json', '');
        const provider = getProviderFromPath(dir);
        
        return {
          file: filePath,
          timestamp: stat.mtime,
          requestId,
          provider
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first
  } catch (error) {
    console.error(`[WEBHOOK-LOGGER] Error getting logs from directory ${dir}:`, error);
    return [];
  }
}

/**
 * Utility function to get a list of all webhook logs
 */
export function getWebhookLogs(): Array<{file: string, timestamp: Date, requestId: string, provider: string}> {
  try {
    // Get logs from main directory
    const mainLogs = getLogsFromDirectory(LOG_DIR);
    
    // Merge with provider-specific logs
    const providerLogs = Object.values(PROVIDER_DIRS)
      .flatMap(dir => getLogsFromDirectory(dir));
    
    // Combine and sort by timestamp
    return [...mainLogs, ...providerLogs]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error getting webhook logs:', error);
    return [];
  }
}

/**
 * Gets webhook logs from a specific provider
 */
export function getProviderWebhookLogs(provider: string): Array<{file: string, timestamp: Date, requestId: string, provider: string}> {
  const providerDir = provider === 'rabbit' ? PROVIDER_DIRS.RABBIT :
                      provider === 'donkey' ? PROVIDER_DIRS.DONKEY :
                      provider === 'lion' ? PROVIDER_DIRS.LION :
                      PROVIDER_DIRS.UNKNOWN;
  
  return getLogsFromDirectory(providerDir);
}

/**
 * Get the content of a specific webhook log
 */
export function getWebhookLog(requestId: string): any {
  try {
    // First check main directory
    let filePath = path.join(LOG_DIR, `${requestId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
    
    // Check each provider directory
    for (const dir of Object.values(PROVIDER_DIRS)) {
      filePath = path.join(dir, `${requestId}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    }
    
    return null;
  } catch (error) {
    console.error(`[WEBHOOK-LOGGER] Error getting webhook log ${requestId}:`, error);
    return null;
  }
}

/**
 * Gets statistics about webhook logs
 */
export function getWebhookStats(): any {
  try {
    const allLogs = getWebhookLogs();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get counts by provider
    const countsByProvider: Record<string, number> = {};
    const recentByProvider: Record<string, number> = {};
    const latestByProvider: Record<string, Date> = {};
    
    allLogs.forEach(log => {
      const provider = log.provider || 'unknown';
      
      // Count by provider
      countsByProvider[provider] = (countsByProvider[provider] || 0) + 1;
      
      // Count recent by provider
      if (log.timestamp > last24Hours) {
        recentByProvider[provider] = (recentByProvider[provider] || 0) + 1;
      }
      
      // Track latest timestamp by provider
      if (!latestByProvider[provider] || log.timestamp > latestByProvider[provider]) {
        latestByProvider[provider] = log.timestamp;
      }
    });
    
    // Get 5 most recent logs with content
    const recentLogs = allLogs.slice(0, 5).map(log => {
      const content = getWebhookLog(log.requestId);
      return {
        requestId: log.requestId,
        provider: log.provider,
        timestamp: log.timestamp,
        searchId: content?.searchId || 'unknown',
        method: content?.method || 'unknown',
        url: content?.url || 'unknown',
        ip: content?.ip || 'unknown',
        hasBody: !!content?.body
      };
    });
    
    return {
      totalLogs: allLogs.length,
      countsByProvider,
      recentByProvider,
      latestByProvider,
      recentLogs
    };
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error getting webhook stats:', error);
    return { error: 'Failed to get webhook stats' };
  }
}

export default {
  logWebhookRequest,
  getWebhookLogs,
  getWebhookLog
};