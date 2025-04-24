import fetch from 'node-fetch';

async function checkWebhookResults(searchId) {
  try {
    // Connect to the deployed app and check for recent companies
    const url = "https://bear-app.replit.app/api/companies/recent";
    console.log("Checking recent companies at:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const companies = await response.json();
    console.log(`Found ${companies.length} recent companies:`);
    
    // Display the company names
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
  } catch (error) {
    console.error("Error checking webhook results:", error.message);
  }
}

// Execute with search ID from command line argument or default to "recent"
const searchId = process.argv[2] || "recent";
checkWebhookResults(searchId);