/**
 * Simple script to check the most recent companies in the database
 */
import fetch from 'node-fetch';

async function checkRecentCompanies() {
  try {
    console.log("Checking most recent companies in the database...");
    
    const response = await fetch('https://Bear-App.replit.app/api/companies/recent');
    
    if (!response.ok) {
      console.error(`Error fetching companies: ${response.status} ${response.statusText}`);
      return;
    }
    
    const companies = await response.json();
    
    console.log(`Found ${companies.length} recent companies:\n`);
    
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
      if (company.industry) console.log(`   Industry: ${company.industry}`);
      if (company.location) console.log(`   Location: ${company.location}`);
      if (company.description) console.log(`   Description: ${company.description}`);
      console.log(`   Created: ${company.createdAt || 'unknown'}`);
      console.log();
    });
    
    // Check specifically for Denver companies
    const denverCompanies = companies.filter(c => 
      (c.name && c.name.includes('Denver')) || 
      (c.location && c.location.includes('Denver'))
    );
    
    if (denverCompanies.length > 0) {
      console.log(`\nFound ${denverCompanies.length} Denver-related companies:`);
      denverCompanies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
        if (company.location) console.log(`   Location: ${company.location}`);
      });
    } else {
      console.log("\nNo Denver-related companies found in the recent results.");
    }
    
    // Check specifically for Transport companies
    const transportCompanies = companies.filter(c => 
      (c.name && (c.name.includes('Transport') || c.name.includes('Freight'))) || 
      (c.industry && (c.industry.includes('Transport') || c.industry.includes('Logistics')))
    );
    
    if (transportCompanies.length > 0) {
      console.log(`\nFound ${transportCompanies.length} Transport-related companies:`);
      transportCompanies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
        if (company.industry) console.log(`   Industry: ${company.industry}`);
      });
    } else {
      console.log("\nNo Transport-related companies found in the recent results.");
    }
    
  } catch (error) {
    console.error("Error checking companies:", error);
  }
}

// Run the function
checkRecentCompanies();