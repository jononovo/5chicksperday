/**
 * Script to check for Denver transport companies in the database
 */
import fetch from 'node-fetch';

async function checkDenverTransport() {
  console.log("Checking for Denver transport companies in the database...");
  
  try {
    // Get all companies and webhook logs from endpoints
    const [localResponse, deployedResponse, webhookStatusResponse] = await Promise.all([
      fetch('http://localhost:5000/api/companies/recent?limit=100'),
      fetch('https://Bear-App.replit.app/api/companies/recent?limit=100'),
      fetch('https://Bear-App.replit.app/api/debug/webhook-status')
    ]);
    
    const localCompanies = await localResponse.json();
    const deployedCompanies = await deployedResponse.json();
    const webhookStatus = await webhookStatusResponse.json();
    
    console.log(`Found ${localCompanies.length} companies in local database`);
    console.log(`Found ${deployedCompanies.length} companies in deployed database`);
    
    // Check webhook status
    console.log("\nWebhook Status:");
    console.log(`Recent webhook activity: ${webhookStatus.webhookActivity ? 'Yes' : 'No'}`);
    console.log(`Recent webhook hits: ${webhookStatus.recentWebhookHits || 0}`);
    
    if (webhookStatus.lastWebhookLogs && webhookStatus.lastWebhookLogs.length > 0) {
      console.log("\nRecent webhook logs:");
      webhookStatus.lastWebhookLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] ${log.message.substring(0, 100)}${log.message.length > 100 ? '...' : ''}`);
      });
    }
    
    // Look for Denver or Transport companies in local database
    const localDenverTransport = localCompanies.filter(c => 
      (c.name && (c.name.toLowerCase().includes('denver') || 
                 c.name.toLowerCase().includes('transport') || 
                 c.name.toLowerCase().includes('logistics'))) ||
      (c.location && c.location.toLowerCase().includes('denver')) ||
      (c.industry && (c.industry.toLowerCase().includes('transport') || 
                     c.industry.toLowerCase().includes('logistics')))
    );
    
    // Look for Denver or Transport companies in deployed database
    const deployedDenverTransport = deployedCompanies.filter(c => 
      (c.name && (c.name.toLowerCase().includes('denver') || 
                 c.name.toLowerCase().includes('transport') || 
                 c.name.toLowerCase().includes('logistics'))) ||
      (c.location && c.location.toLowerCase().includes('denver')) ||
      (c.industry && (c.industry.toLowerCase().includes('transport') || 
                     c.industry.toLowerCase().includes('logistics')))
    );
    
    // Output results
    if (localDenverTransport.length > 0) {
      console.log(`\nFound ${localDenverTransport.length} Denver/transport companies in LOCAL database:`);
      localDenverTransport.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`  Industry: ${company.industry}`);
        if (company.location) console.log(`  Location: ${company.location}`);
        if (company.website) console.log(`  Website: ${company.website}`);
        console.log();
      });
    } else {
      console.log("\nNo Denver/transport companies found in LOCAL database yet.");
    }
    
    if (deployedDenverTransport.length > 0) {
      console.log(`\nFound ${deployedDenverTransport.length} Denver/transport companies in DEPLOYED database:`);
      deployedDenverTransport.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`  Industry: ${company.industry}`);
        if (company.location) console.log(`  Location: ${company.location}`);
        if (company.website) console.log(`  Website: ${company.website}`);
        console.log();
      });
      
      // Check for contacts for each transport company
      console.log("\nChecking for contacts for transport companies...");
      for (const company of deployedDenverTransport) {
        try {
          const contactsResponse = await fetch(`https://Bear-App.replit.app/api/companies/${company.id}/contacts`);
          const contacts = await contactsResponse.json();
          
          if (contacts && contacts.length > 0) {
            console.log(`Found ${contacts.length} contacts for "${company.name}":`);
            contacts.forEach(contact => {
              console.log(`- ${contact.name}${contact.role ? ` (${contact.role})` : ''}`);
              if (contact.email) console.log(`  Email: ${contact.email}`);
              if (contact.phoneNumber) console.log(`  Phone: ${contact.phoneNumber}`);
            });
          } else {
            console.log(`No contacts found for "${company.name}"`);
          }
          
          console.log(); // Empty line for readability
        } catch (err) {
          console.error(`Error fetching contacts for company ${company.id}:`, err);
        }
      }
    } else {
      console.log("\nNo Denver/transport companies found in DEPLOYED database yet.");
      console.log("It may take some time for the webhook data to be processed.");
      console.log("Try running this script again in a few minutes.");
    }
  } catch (error) {
    console.error("Error checking for Denver transport companies:", error);
  }
}

// Execute the function
checkDenverTransport();