/**
 * Test script to send a test webhook to our endpoint
 * This helps us verify that the webhook logging is working properly
 */
import fetch from 'node-fetch';

async function sendTestWebhook() {
  console.log('=== SENDING TEST WEBHOOK ===');
  
  const searchId = `test-search-${Date.now()}`;
  
  const webhookPayload = {
    searchId,
    status: 'completed',
    progress: 100,
    results: {
      companies: [
        {
          name: 'Test Company 1',
          website: 'https://testcompany1.example.com',
          industry: 'Software Testing',
          description: 'A company used for testing',
          address: '123 Test Street, Testville',
          employees: 50
        },
        {
          name: 'Test Company 2',
          website: 'https://testcompany2.example.com',
          industry: 'QA Services',
          description: 'Another test company',
          address: '456 Test Avenue, Testopolis',
          employees: 120
        }
      ],
      metadata: {
        searchQuery: 'test companies',
        timestamp: new Date().toISOString(),
        searchEngine: 'test-engine'
      }
    }
  };
  
  try {
    // Send the test webhook
    const response = await fetch('http://localhost:5000/api/external-workflow/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TestScript/1.0',
        'X-Test-Source': 'webhook-monitor-test'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    const result = await response.json();
    
    console.log(`Webhook sent with searchId: ${searchId}`);
    console.log('Response:', result);
    
    // Wait a moment then check if our webhook was logged
    console.log('\nWaiting 2 seconds to check logs...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check the logs
    const logsResponse = await fetch('http://localhost:5000/api/monitor/webhook-logs?limit=5');
    const logsResult = await logsResponse.json();
    
    console.log('\n== Recent Webhook Logs ==');
    console.log(`Total logs: ${logsResult.count}`);
    
    if (logsResult.logs && logsResult.logs.length > 0) {
      logsResult.logs.forEach((log, i) => {
        console.log(`[${i+1}] ${log.requestId} - ${log.timestamp}`);
      });
      
      // Get the first log content
      const firstLogId = logsResult.logs[0].requestId;
      const logContentResponse = await fetch(`http://localhost:5000/api/monitor/webhook-logs/${firstLogId}`);
      const logContent = await logContentResponse.json();
      
      console.log('\n== Latest Log Content ==');
      console.log(`Request ID: ${logContent.log.requestId}`);
      console.log(`Timestamp: ${logContent.log.timestamp}`);
      console.log(`Method: ${logContent.log.method}`);
      console.log(`URL: ${logContent.log.url}`);
      console.log(`Search ID: ${logContent.log.searchId}`);
    } else {
      console.log('No logs found. Something may be wrong with the webhook logger.');
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Error sending test webhook:', error);
  }
}

sendTestWebhook();