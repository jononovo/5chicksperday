import fetch from 'node-fetch';

async function checkCompanies() {
  try {
    console.log("Checking for companies in the database...");
    const response = await fetch("https://bear-app.replit.app/api/companies/recent");
    const companies = await response.json();
    
    console.log(`Found ${companies.length} recent companies:`);
    
    // Filter for Orlando real estate companies
    const orlandoCompanies = companies.filter(company => 
      (company.name && company.name.toLowerCase().includes('orlando')) ||
      (company.industry && company.industry.toLowerCase().includes('real estate')) ||
      (company.location && company.location.toLowerCase().includes('orlando'))
    );
    
    console.log(`\nFound ${orlandoCompanies.length} Orlando/real estate related companies:`);
    orlandoCompanies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} - ${company.industry || 'Unknown industry'} (${company.location || 'Unknown location'}) - ID: ${company.id}`);
    });
    
  } catch (error) {
    console.error("Error checking companies:", error.message);
  }
}

// Run the check
checkCompanies();