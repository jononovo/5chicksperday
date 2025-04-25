/**
 * Test script for the webhook monitor endpoints
 * This script allows you to test the monitoring dashboard without having to deploy
 */
const fetch = require('node-fetch');

async function testWebhookMonitor() {
  console.log('=== TESTING WEBHOOK MONITOR ===');
  
  try {
    // Test the basic monitor endpoint
    const testResponse = await fetch('http://localhost:5000/api/monitor/test');
    const testResult = await testResponse.json();
    
    console.log('\n== Basic Monitor Test ==');
    console.log(testResult);
    
    // Test the stats endpoint
    const statsResponse = await fetch('http://localhost:5000/api/monitor/webhook-stats');
    const statsResult = await statsResponse.json();
    
    console.log('\n== Webhook Stats ==');
    console.log(`Total logs: ${statsResult.totalLogs}`);
    console.log(`Recent logs (24h): ${statsResult.recentLogs24h}`);
    console.log(`Most recent timestamp: ${statsResult.mostRecentTimestamp}`);
    
    if (statsResult.recentLogs && statsResult.recentLogs.length > 0) {
      console.log('\n== Recent Log Examples ==');
      statsResult.recentLogs.slice(0, 3).forEach((log, i) => {
        console.log(`[${i+1}] ${log.requestId} - ${log.timestamp} - ${log.method} ${log.url}`);
      });
    } else {
      console.log('\nNo logs found. Use the test-webhook-endpoint.js script to generate some logs.');
    }
    
    // Test the dashboard endpoint
    const dashResponse = await fetch('http://localhost:5000/api/monitor/dashboard');
    const dashResult = await dashResponse.json();
    
    console.log('\n== Dashboard Overview ==');
    console.log(`Total logs: ${dashResult.totalLogs}`);
    console.log(`Unique IPs: ${dashResult.uniqueIps?.length || 0}`);
    console.log(`Unique URLs: ${dashResult.uniqueUrls?.length || 0}`);
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error testing webhook monitor:', error);
  }
}

testWebhookMonitor();