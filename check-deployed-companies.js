/**
 * Script to check for companies in the deployed application
 */
import fetch from 'node-fetch';

async function checkDeployedCompanies() {
  console.log("Checking for companies in the deployed application...");
  
  try {
    // Deployed app endpoint for companies
    const response = await fetch('https://Bear-App.replit.app/api/companies/recent');
    const companies = await response.json();
    
    console.log(`Found ${companies.length} recent companies in the deployed application.`);
    
    // Get the most recent 5 companies
    const recentCompanies = companies.slice(0, 5);
    console.log("\nMost recent companies:");
    
    recentCompanies.forEach(company => {
      console.log(`- ${company.name} (ID: ${company.id})`);
      
      // Print additional fields if they exist
      if (company.industry) console.log(`  Industry: ${company.industry}`);
      if (company.location) console.log(`  Location: ${company.location}`);
      if (company.website) console.log(`  Website: ${company.website}`);
      
      console.log(); // Empty line for readability
    });
    
    // Check for any company with "DEPLOYED TEST" in the name
    const deployedTestCompanies = companies.filter(c => 
      c.name.includes('DEPLOYED TEST')
    );
    
    if (deployedTestCompanies.length > 0) {
      console.log(`\nFound ${deployedTestCompanies.length} DEPLOYED TEST companies:`);
      deployedTestCompanies.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`  Industry: ${company.industry}`);
        if (company.location) console.log(`  Location: ${company.location}`);
        if (company.website) console.log(`  Website: ${company.website}`);
        console.log();
      });
      
      // Check for contacts for the deployed test company
      for (const company of deployedTestCompanies) {
        try {
          const contactsUrl = `https://Bear-App.replit.app/api/companies/${company.id}/contacts`;
          console.log(`Checking for contacts at: ${contactsUrl}`);
          
          const contactsResponse = await fetch(contactsUrl);
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
      console.log("\nNo DEPLOYED TEST companies found yet. They may still be processing asynchronously.");
      console.log("Wait a few more seconds and run this script again.");
    }
    
  } catch (error) {
    console.error("Error checking deployed companies:", error);
  }
}

// Execute the function
checkDeployedCompanies();