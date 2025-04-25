/**
 * Script to check the logs for a specific search ID
 */
import fetch from 'node-fetch';

// The search ID provided by Rabbit in their technical report
const searchId = 'rabbit_search_1745537319451';

async function checkSearchIdLogs() {
  console.log(`Checking logs for searchId: ${searchId}...`);
  
  try {
    // Fetch logs from the deployed application
    const response = await fetch('https://Bear-App.replit.app/api/debug/logs');
    
    if (!response.ok) {
      console.error(`Error fetching logs: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    
    if (data && data.logs && Array.isArray(data.logs)) {
      console.log(`Found ${data.logs.length} total log entries.`);
      
      // Filter logs related to this specific search ID
      const relevantLogs = data.logs.filter(log => 
        log.message.includes(searchId)
      );
      
      if (relevantLogs.length > 0) {
        console.log(`\nFound ${relevantLogs.length} logs related to search ID ${searchId}:`);
        relevantLogs.forEach((log, index) => {
          console.log(`${index + 1}. [${log.timestamp}] [${log.type}] ${log.message}`);
        });
      } else {
        console.log(`\nNo logs found containing search ID ${searchId}.`);
        
        // If no specific logs were found, look for any webhook-related entries around the timestamp
        const webhookLogs = data.logs.filter(log => 
          log.message.includes('webhook') || 
          log.message.includes('Webhook') ||
          log.message.includes('WEBHOOK')
        );
        
        console.log(`\nFound ${webhookLogs.length} webhook-related logs. Showing the most recent ones:`);
        webhookLogs.slice(-10).forEach((log, index) => {
          console.log(`${index + 1}. [${log.timestamp}] [${log.type}] ${log.message}`);
        });
      }
    } else {
      console.log("No logs found or invalid log format returned.");
    }
    
    // Let's also check recent companies to see if any were created around that time
    try {
      const companyResponse = await fetch('https://Bear-App.replit.app/api/companies/recent?limit=20');
      const companies = await companyResponse.json();
      
      console.log(`\nChecking the most recent ${companies.length} companies for any that might be from this webhook:`);
      companies.forEach((company, index) => {
        let timestamp = company.createdAt ? new Date(company.createdAt).toISOString() : 'unknown time';
        console.log(`${index + 1}. ID: ${company.id}, Name: ${company.name}, Created: ${timestamp}`);
        if (company.location && company.location.toLowerCase().includes('denver')) {
          console.log(`   ^ MATCH! This company is in Denver`);
        }
        if (company.industry && (company.industry.toLowerCase().includes('transport') || company.industry.toLowerCase().includes('logistics'))) {
          console.log(`   ^ MATCH! This company is in the transport/logistics industry`);
        }
      });
    } catch (err) {
      console.error("Error fetching recent companies:", err);
    }
    
  } catch (error) {
    console.error("Error checking logs:", error);
  }
}

// Execute the function
checkSearchIdLogs();