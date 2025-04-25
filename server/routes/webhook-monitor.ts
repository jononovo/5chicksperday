/**
 * Webhook Monitor API
 * Provides endpoints to view webhook logs and diagnostics
 * Simple implementation with all logs in one place
 */
import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// Import webhook logger
import { getWebhookLogs, getWebhookLog, getWebhookStats } from '../lib/webhook-logger';

const router = Router();

// List all webhook logs
router.get('/webhook-logs', (req: Request, res: Response) => {
  try {
    const logs = getWebhookLogs();
    const limit = parseInt(req.query.limit as string) || 50;
    
    return res.json({
      success: true,
      count: logs.length,
      logs: logs.slice(0, limit).map(log => ({
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
router.get('/webhook-logs/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const log = await getWebhookLog(requestId);
    
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
router.get('/webhook-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getWebhookStats();
    return res.json({
      success: true,
      ...stats
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

// Dashboard endpoint
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const logs = getWebhookLogs();
    const stats = await getWebhookStats();
    
    // Extract IPs from the recent logs for the dashboard
    const ips = new Set<string>();
    const userAgents = new Set<string>();
    const methods = new Set<string>();
    const urls = new Set<string>();
    
    // Process logs in parallel using Promise.all
    const logPromises = logs.slice(0, 20).map(async (logInfo) => {
      try {
        const log = await getWebhookLog(logInfo.requestId);
        
        if (log) {
          if (log.ip) ips.add(log.ip);
          if (log.headers && log.headers['user-agent']) userAgents.add(log.headers['user-agent'] as string);
          if (log.method) methods.add(log.method);
          if (log.url) urls.add(log.url);
          
          return {
            requestId: logInfo.requestId,
            timestamp: log.timestamp,
            method: log.method,
            url: log.url,
            ip: log.ip,
            searchId: log.searchId || 'none',
            hasBody: !!log.body
          };
        }
      } catch (err) {
        console.error(`Error processing log ${logInfo.requestId}:`, err);
      }
      return null;
    });
    
    const recentLogs = (await Promise.all(logPromises)).filter(Boolean);
    
    // Get last 24 hour activity
    const now = new Date();
    const hourly: number[] = Array(24).fill(0);
    
    logs.forEach(log => {
      const logTime = new Date(log.timestamp);
      const hourDiff = Math.floor((now.getTime() - logTime.getTime()) / (1000 * 60 * 60));
      
      if (hourDiff >= 0 && hourDiff < 24) {
        hourly[hourDiff]++;
      }
    });
    
    return res.json({
      success: true,
      totalLogs: logs.length,
      uniqueIps: Array.from(ips),
      uniqueUserAgents: Array.from(userAgents),
      uniqueMethods: Array.from(methods),
      uniqueUrls: Array.from(urls),
      hourlyActivity: hourly.reverse(), // Most recent first
      recentLogs,
      stats
    });
  } catch (error) {
    console.error('Error getting webhook dashboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving webhook dashboard data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Test route to confirm the monitor is working
router.get('/test', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Webhook monitor is active',
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl
  });
});

export default router;