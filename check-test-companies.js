/**
 * Script to check for any companies with "test" in the name in the database
 */
import fetch from 'node-fetch';

async function checkTestCompanies() {
  console.log("Checking for test companies in the database...");
  
  try {
    // Local endpoint to get all companies
    const response = await fetch('http://localhost:5000/api/companies/recent');
    const companies = await response.json();
    
    // Filter for any company with "test" in the name (case insensitive)
    const testCompanies = companies.filter(c => 
      c.name.toLowerCase().includes('test')
    );
    
    if (testCompanies.length > 0) {
      console.log(`Found ${testCompanies.length} test companies in the database:`);
      testCompanies.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        
        // Print additional fields if they exist
        if (company.industry) console.log(`  Industry: ${company.industry}`);
        if (company.location) console.log(`  Location: ${company.location}`);
        if (company.website) console.log(`  Website: ${company.website}`);
        
        console.log(); // Empty line for readability
      });
    } else {
      console.log("No test companies found in the database.");
    }
    
    // Now query the API to check for contacts associated with test companies
    console.log("\nChecking for contacts associated with test companies...");
    
    for (const company of testCompanies) {
      try {
        const contactsResponse = await fetch(`http://localhost:5000/api/companies/${company.id}/contacts`);
        const contacts = await contactsResponse.json();
        
        if (contacts && contacts.length > 0) {
          console.log(`Found ${contacts.length} contacts for company "${company.name}":`);
          contacts.forEach(contact => {
            console.log(`- ${contact.name}${contact.role ? ` (${contact.role})` : ''}`);
            if (contact.email) console.log(`  Email: ${contact.email}`);
            if (contact.phoneNumber) console.log(`  Phone: ${contact.phoneNumber}`);
          });
        } else {
          console.log(`No contacts found for company "${company.name}"`);
        }
        
        console.log(); // Empty line for readability
      } catch (err) {
        console.error(`Error fetching contacts for company ${company.id}:`, err);
      }
    }
    
  } catch (error) {
    console.error("Error checking for test companies:", error);
  }
}

// Execute the function
checkTestCompanies();