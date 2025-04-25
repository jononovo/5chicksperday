/**
 * Script to check for Scranton lawyers in the database
 */
import fetch from 'node-fetch';

async function checkScrantonLawyers() {
  try {
    console.log("Checking for Scranton lawyers in the database...");
    
    const response = await fetch('https://Bear-App.replit.app/api/companies');
    
    if (!response.ok) {
      console.error(`Error fetching companies: ${response.status} ${response.statusText}`);
      return;
    }
    
    const companies = await response.json();
    
    console.log(`Found ${companies.length} total companies in the database.`);
    
    // Filter for Scranton or lawyer companies
    const scrantonLawyers = companies.filter(c => 
      (c.name && c.location && c.location.includes('Scranton')) || 
      (c.industry && c.industry.includes('Legal'))
    );
    
    if (scrantonLawyers.length > 0) {
      console.log(`\nFound ${scrantonLawyers.length} Scranton/Legal companies:\n`);
      
      scrantonLawyers.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`   Industry: ${company.industry}`);
        if (company.location) console.log(`   Location: ${company.location}`);
        if (company.description) console.log(`   Description: ${company.description}`);
        console.log(`   Created: ${company.createdAt || 'unknown'}`);
        console.log();
      });
      
      // Check contacts for these companies
      console.log("\nChecking contacts for Scranton legal companies...\n");
      
      for (const company of scrantonLawyers.slice(0, 3)) {
        try {
          console.log(`Contacts for ${company.name}:`);
          
          const contactsResponse = await fetch(`https://Bear-App.replit.app/api/companies/${company.id}/contacts`);
          
          if (!contactsResponse.ok) {
            console.log(`  Error fetching contacts: ${contactsResponse.status}`);
            continue;
          }
          
          const contacts = await contactsResponse.json();
          
          if (contacts && contacts.length > 0) {
            contacts.forEach((contact, idx) => {
              console.log(`  ${idx + 1}. ${contact.name}${contact.role ? ` (${contact.role})` : ''}`);
              if (contact.email) console.log(`     Email: ${contact.email}`);
              if (contact.phoneNumber) console.log(`     Phone: ${contact.phoneNumber}`);
            });
          } else {
            console.log("  No contacts found for this company.");
          }
          console.log();
          
        } catch (err) {
          console.error(`Error checking contacts for company ${company.id}:`, err);
        }
      }
    } else {
      console.log("\nNo Scranton/Legal companies found in the database.");
    }
    
  } catch (error) {
    console.error("Error checking companies:", error);
  }
}

// Run the function
checkScrantonLawyers();