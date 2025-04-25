/**
 * Script to check for Austin plumbers in the deployed application
 */

import fetch from 'node-fetch';

async function checkAustinPlumbers() {
  try {
    console.log(`Checking for Austin plumbers at deployed application...`);
    
    // First check the recent webhook logs
    const webhookUrl = 'https://bear-app.replit.app/api/debug/webhook-status';
    console.log(`Checking webhook logs at: ${webhookUrl}`);
    
    const webhookResponse = await fetch(webhookUrl);
    const webhookData = await webhookResponse.json();
    
    console.log(`\nWebhook activity detected: ${webhookData.webhookActivity}`);
    console.log(`Recent webhook hits: ${webhookData.recentWebhookHits}`);
    
    // Look for the specific search ID in the logs
    const searchId = 'rabbit_search_1745536572139'; // The Austin plumbers search ID
    let foundSearchId = false;
    
    console.log(`\nLooking for search ID: ${searchId} in webhook logs...`);
    
    if (webhookData.lastWebhookLogs) {
      for (const log of webhookData.lastWebhookLogs) {
        if (log.message && log.message.includes(searchId)) {
          console.log(`\nFound matching search ID in logs!`);
          console.log(`Timestamp: ${log.timestamp}`);
          console.log(`Type: ${log.type}`);
          console.log(`Message: ${log.message.substring(0, 100)}...`); // Just show the beginning
          foundSearchId = true;
          break;
        }
      }
    }
    
    if (!foundSearchId) {
      console.log(`\nSearch ID ${searchId} not found in recent webhook logs.`);
    }
    
    // Now check for Austin plumbers in the companies list
    const companiesUrl = 'https://bear-app.replit.app/api/companies/recent';
    console.log(`\nChecking companies at: ${companiesUrl}`);
    
    const companiesResponse = await fetch(companiesUrl);
    const companies = await companiesResponse.json();
    
    console.log(`\nFound ${companies.length} recent companies:`);
    
    let foundAustinPlumbers = false;
    
    for (const company of companies) {
      if (
        (company.name && company.name.toLowerCase().includes('plumb')) ||
        (company.location && company.location.toLowerCase().includes('austin')) ||
        (company.industry && company.industry.toLowerCase().includes('plumb'))
      ) {
        console.log(`Found potential match: ${company.name} (ID: ${company.id})`);
        console.log(`  Location: ${company.location || 'Unknown'}`);
        console.log(`  Industry: ${company.industry || 'Unknown'}`);
        console.log(`  Created: ${company.createdAt || 'Unknown'}`);
        foundAustinPlumbers = true;
      }
    }
    
    if (!foundAustinPlumbers) {
      console.log(`No Austin plumbers found in recent companies.`);
    }
    
  } catch (error) {
    console.error(`Error checking for Austin plumbers:`, error);
  }
}

checkAustinPlumbers();