import fetch from 'node-fetch';

async function checkWebhookLogs() {
  try {
    console.log("Checking for recent webhook activity...");
    const response = await fetch("https://bear-app.replit.app/api/webhook-status");
    const data = await response.json();
    
    console.log(`Webhook activity detected: ${data.webhookActivity ? 'Yes' : 'No'}`);
    console.log(`Recent webhook hits: ${data.recentWebhookHits || 0}`);
    
    if (data.lastWebhookLogs && data.lastWebhookLogs.length > 0) {
      console.log("\nRecent webhook logs:");
      data.lastWebhookLogs.forEach((log, index) => {
        if (log.includes("WEBHOOK RECEIVED")) {
          console.log(`\n--- Webhook ${index + 1} ---`);
        }
        console.log(log);
      });
    } else {
      console.log("\nNo recent webhook logs found.");
    }
    
    if (data.recentCompanies && data.recentCompanies.length > 0) {
      console.log("\nRecent companies from webhooks:");
      data.recentCompanies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} - ID: ${company.id}`);
      });
    }
    
  } catch (error) {
    console.error("Error checking webhook logs:", error.message);
  }
}

// Run the check
checkWebhookLogs();