/**
 * Script to check for all companies in the database
 */
import fetch from 'node-fetch';

async function checkAllCompanies() {
  console.log("Checking ALL companies in the database...");
  
  try {
    // Get logs to understand what's happening
    const logsResponse = await fetch('https://Bear-App.replit.app/api/debug/logs');
    const logsData = await logsResponse.json();
    
    if (logsData && logsData.logs) {
      console.log(`Found ${logsData.logs.length} log entries.`);
      
      // Print the most recent 10 logs of any type
      console.log("\nMost recent logs (all types):");
      logsData.logs.slice(-10).forEach((log, index) => {
        console.log(`${index + 1}. [${log.timestamp}] [${log.type}] ${log.message.substring(0, 150)}${log.message.length > 150 ? '...' : ''}`);
      });
    }
    
    // Create a custom endpoint to get ALL companies
    const response = await fetch('https://Bear-App.replit.app/api/companies');
    
    if (!response.ok) {
      console.error(`Error fetching companies: ${response.status} ${response.statusText}`);
      return;
    }
    
    const companies = await response.json();
    
    console.log(`\nFound ${companies.length} total companies in the database.`);
    
    // Look for Denver or Transport companies
    const denverTransport = companies.filter(c => 
      (c.name && (c.name.toLowerCase().includes('denver') || 
                 c.name.toLowerCase().includes('transport') || 
                 c.name.toLowerCase().includes('logistics'))) ||
      (c.location && c.location.toLowerCase().includes('denver')) ||
      (c.industry && (c.industry.toLowerCase().includes('transport') || 
                     c.industry.toLowerCase().includes('logistics')))
    );
    
    if (denverTransport.length > 0) {
      console.log(`\nFound ${denverTransport.length} Denver/transport companies:`);
      denverTransport.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`   Industry: ${company.industry}`);
        if (company.location) console.log(`   Location: ${company.location}`);
        if (company.website) console.log(`   Website: ${company.website}`);
        console.log(`   Created: ${company.createdAt}`);
        console.log();
      });
      
      // Check for contacts for these companies
      for (const company of denverTransport.slice(0, 3)) { // Just check the first 3 to keep output manageable
        try {
          console.log(`Checking contacts for company: ${company.name} (ID: ${company.id})`);
          const contactsResponse = await fetch(`https://Bear-App.replit.app/api/companies/${company.id}/contacts`);
          const contacts = await contactsResponse.json();
          
          if (contacts && contacts.length > 0) {
            console.log(`Found ${contacts.length} contacts:`);
            contacts.forEach((contact, index) => {
              console.log(`${index + 1}. ${contact.name}${contact.role ? ` (${contact.role})` : ''}`);
              if (contact.email) console.log(`   Email: ${contact.email}`);
              if (contact.phoneNumber) console.log(`   Phone: ${contact.phoneNumber}`);
            });
          } else {
            console.log("No contacts found for this company.");
          }
          console.log();
        } catch (err) {
          console.error(`Error fetching contacts for company ${company.id}:`, err);
        }
      }
    } else {
      console.log("\nNo Denver/transport companies found in the database.");
      
      // If no matches, show the most recent 5 companies for context
      console.log("\nMost recent 5 companies for reference:");
      const recentCompanies = [...companies].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }).slice(0, 5);
      
      recentCompanies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`   Industry: ${company.industry}`);
        if (company.location) console.log(`   Location: ${company.location}`);
        console.log(`   Created: ${company.createdAt}`);
        console.log();
      });
    }
  } catch (error) {
    console.error("Error checking companies:", error);
  }
}

// Execute the function
checkAllCompanies();