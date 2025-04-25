/**
 * Webhook Logger
 * A standalone utility to log all webhook requests that hit our endpoint
 * Simple implementation with all logs in one directory
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
 * Log the full request details to a file
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
 */
export function getWebhookLog(requestId: string): any {
  try {
    const filePath = path.join(LOG_DIR, `${requestId}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
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
    
    // Count recent logs
    const recentCount = allLogs.filter(log => log.timestamp > last24Hours).length;
    
    // Get most recent logs with content
    const recentLogs = allLogs.slice(0, 10).map(log => {
      const content = getWebhookLog(log.requestId);
      return {
        requestId: log.requestId,
        timestamp: log.timestamp,
        searchId: content?.searchId || 'unknown',
        method: content?.method || 'unknown',
        url: content?.url || 'unknown',
        ip: content?.ip || 'unknown',
        userAgent: content?.headers?.['user-agent'] || 'unknown'
      };
    });
    
    return {
      totalLogs: allLogs.length,
      recentLogs24h: recentCount,
      mostRecentTimestamp: allLogs.length > 0 ? allLogs[0].timestamp : null,
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