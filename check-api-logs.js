/**
 * Script to check the API logs in the deployed application
 */
import fetch from 'node-fetch';

async function checkApiLogs() {
  console.log("Checking API logs from the deployed application...");
  
  try {
    // Fetch logs directly from the debug endpoint
    const response = await fetch('https://Bear-App.replit.app/api/debug/logs');
    
    // Check if we got a valid response
    if (!response.ok) {
      console.error(`Error fetching logs: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`);
      return;
    }
    
    const data = await response.json();
    
    if (data && data.logs && Array.isArray(data.logs)) {
      console.log(`Found ${data.logs.length} log entries.`);
      
      // Filter logs related to webhooks or API calls
      const relevantLogs = data.logs.filter(log => 
        log.message.includes('webhook') || 
        log.message.includes('API') || 
        log.message.includes('Rabbit') ||
        log.message.includes('denver') ||
        log.message.includes('transport')
      );
      
      console.log(`Found ${relevantLogs.length} relevant log entries.`);
      
      // Display the most recent 20 relevant logs
      console.log("\nMost recent relevant logs:");
      relevantLogs.slice(-20).forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] [${log.type}] ${log.message}`);
      });
    } else {
      console.log("No logs found or invalid log format returned.");
    }
  } catch (error) {
    console.error("Error checking API logs:", error);
  }
}

// Execute the function
checkApiLogs();