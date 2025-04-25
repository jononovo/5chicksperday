/**
 * Webhook Logger
 * A utility to log all webhook requests that hit our endpoint
 * Implementation includes both file-based and database logging
 */
import fs from 'fs';
import path from 'path';
import { Request } from 'express';
import { storage } from '../storage';

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
 * Helper to identify the source of a webhook for logging purposes only
 */
function guessSource(req: Request): string {
  const url = req.originalUrl;
  const headers = req.headers;
  const body = req.body || {};
  
  // Just for informational purposes in logs
  if (url.includes('rabbit') || headers['x-lgr-search-id'] || 
      (body.searchId && typeof body.searchId === 'string' && body.searchId.includes('rabbit'))) {
    return 'rabbit';
  } else if (url.includes('donkey') || headers['x-lgd-search-id']) {
    return 'donkey';
  } else if (url.includes('lion') || headers['x-lgl-search-id']) {
    return 'lion';
  }
  
  return 'unknown';
}

/**
 * Log the full request details to a file and database
 */
export function logWebhookRequest(req: Request, logPrefix = 'webhook'): void {
  try {
    // Create a sanitized request object
    const timestamp = new Date().toISOString();
    const source = guessSource(req); // Use the simpler source detection
    const requestId = `${logPrefix}-${source}-${Date.now()}`;
    
    console.log(`[WEBHOOK-LOGGER] Received request from ${source} at ${timestamp}, ID: ${requestId}`);
    
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
      source,
      searchId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      headers: req.headers,
      query: req.query,
      body: req.body
    };
    
    // Create the log file in the log directory
    const logFile = path.join(LOG_DIR, `${requestId}.json`);
    fs.writeFileSync(logFile, safeStringify(sanitizedRequest, 10));
    
    // Log basic request info to console
    console.log(`[WEBHOOK-LOGGER] SearchID: ${searchId || 'not found'}`);
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
    
    // Store in database
    try {
      const webhookLog = {
        requestId,
        searchId: searchId || undefined,
        source,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        headers: req.headers,
        body: req.body,
        status: 'received',
        processed: false
      };
      
      // Call the storage method to store the webhook log in the database
      storage.createWebhookLog(webhookLog)
        .then(() => {
          console.log(`[WEBHOOK-LOGGER] Successfully saved webhook log to database: ${requestId}`);
        })
        .catch((dbError) => {
          console.error(`[WEBHOOK-LOGGER] Error saving webhook log to database: ${dbError}`);
        });
    } catch (dbError) {
      console.error(`[WEBHOOK-LOGGER] Error preparing webhook log for database: ${dbError}`);
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
    // Clean up the logs directory
    const files = fs.readdirSync(LOG_DIR)
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
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error cleaning up old logs:', error);
  }
}

/**
 * Utility function to get a list of all webhook logs
 */
export function getWebhookLogs(): Array<{file: string, timestamp: Date, requestId: string}> {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(LOG_DIR, file);
        const stat = fs.statSync(filePath);
        const requestId = file.replace('.json', '');
        
        return {
          file: filePath,
          timestamp: stat.mtime,
          requestId
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first
    
    return files;
  } catch (error) {
    console.error('[WEBHOOK-LOGGER] Error getting webhook logs:', error);
    return [];
  }
}

/**
 * Get the content of a specific webhook log
 * First tries to fetch from database, then falls back to file system
 */
export async function getWebhookLog(requestId: string): Promise<any> {
  try {
    // First try to get from database
    try {
      const dbLog = await storage.getWebhookLog(requestId);
      if (dbLog) {
        console.log(`[WEBHOOK-LOGGER] Retrieved log from database: ${requestId}`);
        return dbLog;
      }
    } catch (dbError) {
      console.error(`[WEBHOOK-LOGGER] Error retrieving webhook log from database: ${dbError}`);
    }
    
    // Fall back to file system
    const filePath = path.join(LOG_DIR, `${requestId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`[WEBHOOK-LOGGER] Retrieved log from file system: ${requestId}`);
      return JSON.parse(content);
    }
    
    console.log(`[WEBHOOK-LOGGER] No log found for ID: ${requestId}`);
    return null;
  } catch (error) {
    console.error(`[WEBHOOK-LOGGER] Error getting webhook log ${requestId}:`, error);
    return null;
  }
}

/**
 * Gets statistics about webhook logs
 * Combines data from both database and file system
 */
export async function getWebhookStats(): Promise<any> {
  try {
    // Get file-based logs
    const fileLogs = getWebhookLogs();
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get database logs
    let dbLogs = [];
    try {
      dbLogs = await storage.listWebhookLogs(50);
      console.log(`[WEBHOOK-LOGGER] Retrieved ${dbLogs.length} logs from database`);
    } catch (dbError) {
      console.error(`[WEBHOOK-LOGGER] Error retrieving webhook logs from database: ${dbError}`);
    }
    
    // Count recent logs from file system
    const recentFileCount = fileLogs.filter(log => log.timestamp > last24Hours).length;
    
    // Process recent logs from both sources
    const recentFileLogPromises = fileLogs.slice(0, 10).map(async log => {
      const content = await getWebhookLog(log.requestId);
      return {
        requestId: log.requestId,
        timestamp: log.timestamp,
        source: 'file',
        searchId: content?.searchId || 'unknown',
        method: content?.method || 'unknown',
        url: content?.url || 'unknown',
        ip: content?.ip || 'unknown',
        userAgent: content?.headers?.['user-agent'] || 'unknown'
      };
    });
    
    const recentDbLogs = dbLogs.slice(0, 10).map(log => ({
      requestId: log.requestId,
      timestamp: log.createdAt || log.timestamp,
      source: 'database',
      searchId: log.searchId || 'unknown',
      method: log.method || 'unknown',
      url: log.url || 'unknown',
      ip: log.ip || 'unknown',
      userAgent: log.headers?.['user-agent'] || 'unknown'
    }));
    
    // Wait for all file log content to be fetched
    const recentFileLogs = await Promise.all(recentFileLogPromises);
    
    // Combine logs from both sources and sort by timestamp (newest first)
    const combinedLogs = [...recentFileLogs, ...recentDbLogs]
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      })
      .slice(0, 10); // Take the 10 most recent
    
    return {
      totalFileLogs: fileLogs.length,
      totalDbLogs: dbLogs.length,
      recentLogs24h: recentFileCount,
      mostRecentTimestamp: fileLogs.length > 0 ? fileLogs[0].timestamp : null,
      recentLogs: combinedLogs
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