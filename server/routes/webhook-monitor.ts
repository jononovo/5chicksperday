/**
 * Webhook Monitor API
 * Provides endpoints to view webhook logs and diagnostics
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Import webhook logger
import { getWebhookLogs, getWebhookLog } from '../lib/webhook-logger';

const router = Router();

// List all webhook logs
router.get('/webhook-logs', (req: Request, res: Response) => {
  try {
    const logs = getWebhookLogs();
    return res.json({
      success: true,
      count: logs.length,
      logs: logs.map(log => ({
        requestId: log.requestId,
        timestamp: log.timestamp,
        file: path.basename(log.file)
      }))
    });
  } catch (error) {
    console.error('Error getting webhook logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving webhook logs',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get a specific webhook log
router.get('/webhook-logs/:requestId', (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const log = getWebhookLog(requestId);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: `No log found with requestId: ${requestId}`
      });
    }
    
    return res.json({
      success: true,
      log
    });
  } catch (error) {
    console.error(`Error getting webhook log ${req.params.requestId}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving webhook log',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get webhook log stats
router.get('/webhook-stats', (req: Request, res: Response) => {
  try {
    const logs = getWebhookLogs();
    
    // Group logs by hour
    const hourCounts: Record<string, number> = {};
    const ipCounts: Record<string, number> = {};
    const methodCounts: Record<string, number> = {};
    
    // Track the most recent logs
    const recentLogs = logs.slice(0, 10).map(logInfo => {
      const log = getWebhookLog(logInfo.requestId);
      
      if (log) {
        // Count by hour
        const hour = new Date(log.timestamp).toISOString().slice(0, 13);
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        
        // Count by IP
        if (log.ip) {
          ipCounts[log.ip] = (ipCounts[log.ip] || 0) + 1;
        }
        
        // Count by method
        if (log.method) {
          methodCounts[log.method] = (methodCounts[log.method] || 0) + 1;
        }
        
        return {
          requestId: logInfo.requestId,
          timestamp: log.timestamp,
          method: log.method,
          url: log.url,
          ip: log.ip,
          bodyKeys: log.body ? Object.keys(log.body) : []
        };
      }
      return null;
    }).filter(Boolean);
    
    return res.json({
      success: true,
      totalLogs: logs.length,
      hourCounts,
      ipCounts,
      methodCounts,
      recentLogs
    });
  } catch (error) {
    console.error('Error getting webhook stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving webhook stats',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Testing route to confirm the monitor is working
router.get('/webhook-monitor-test', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Webhook monitor is active',
    timestamp: new Date().toISOString()
  });
});

export default router;