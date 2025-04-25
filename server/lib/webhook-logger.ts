/**
 * Webhook Logger
 * A standalone utility to log all webhook requests that hit our endpoint
 */
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

// Configure the logger
const LOG_DIR = './webhook-logs';
const DETAILED_LOGGING = true;
const MAX_LOGS = 50;

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
 * Log the full request details to a file
 */
export function logWebhookRequest(req: Request, logPrefix = 'webhook'): void {
  try {
    // Create a sanitized request object
    const timestamp = new Date().toISOString();
    const requestId = `${logPrefix}-${Date.now()}`;
    
    console.log(`[WEBHOOK-LOGGER] Received request at ${timestamp}, ID: ${requestId}`);
    
    const sanitizedRequest = {
      timestamp,
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      headers: req.headers,
      query: req.query,
      body: req.body
    };
    
    // Create the log file
    const logFile = path.join(LOG_DIR, `${requestId}.json`);
    fs.writeFileSync(logFile, safeStringify(sanitizedRequest, 10));
    
    // Log basic request info to console
    console.log(`[WEBHOOK-LOGGER] Saved request to ${logFile}`);
    console.log(`[WEBHOOK-LOGGER] Request: ${req.method} ${req.originalUrl}`);
    
    if (DETAILED_LOGGING) {
      console.log(`[WEBHOOK-LOGGER] Headers: ${safeStringify(req.headers)}`);
      console.log(`[WEBHOOK-LOGGER] Body: ${safeStringify(req.body)}`);
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

export default {
  logWebhookRequest,
  getWebhookLogs,
  getWebhookLog
};