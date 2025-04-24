import fetch from 'node-fetch';

async function checkDeployedLogs() {
  try {
    // Use the deployed URL to check webhook status
    const url = "https://bear-app.replit.app/api/debug/webhook-status";
    console.log("Checking deployed webhook logs at:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    
    // Also check the full logs
    console.log("\nFetching full logs from deployed app...");
    const logsResponse = await fetch("https://bear-app.replit.app/api/debug/logs");
    
    if (!logsResponse.ok) {
      console.error(`Error: ${logsResponse.status} ${logsResponse.statusText}`);
      return;
    }
    
    const logsData = await logsResponse.json();
    console.log(`Found ${logsData.logs ? logsData.logs.length : 0} log entries`);
    
    // Show the most recent 10 logs
    const recentLogs = logsData.logs ? logsData.logs.slice(0, 10) : [];
    console.log("\nMost recent logs:");
    recentLogs.forEach(log => {
      console.log(`[${log.timestamp}] [${log.type}] ${log.message.substring(0, 100)}${log.message.length > 100 ? '...' : ''}`);
    });
    
  } catch (error) {
    console.error("Error fetching webhook status:", error.message);
  }
}

// Run the check
checkDeployedLogs();