import fetch from 'node-fetch';

async function sendExactRabbitPayload() {
  try {
    // This mirrors the exact payload structure from Rabbit's webhook
    const payload = {
      searchId: "rabbit_search_manual_test",
      status: "completed",
      progress: 100,
      results: {
        companies: [
          {
            name: "Munley Law",
            website: "https://munley.com",
            industry: "Legal Services",
            location: "Scranton, PA",
            description: "Personal injury law firm specializing in truck accidents, car accidents, and workers' compensation in Scranton, PA",
            employeeCount: 32,
            foundedYear: 1959,
            headquarters: "Scranton, PA"
          },
          {
            name: "Scanlon Law",
            website: "https://scanlonlawfirm.com",
            industry: "Legal Services",
            location: "Scranton, PA",
            description: "Full-service law firm focusing on personal injury, medical malpractice, and estate planning in Scranton",
            employeeCount: 15,
            foundedYear: 1985,
            headquarters: "Scranton, PA"
          },
          {
            name: "Cognetti & Cimini",
            website: "https://cognetti-law.com",
            industry: "Legal Services",
            location: "Scranton, PA",
            description: "Law firm specializing in family law, divorce, custody, and domestic relations cases in Scranton",
            employeeCount: 8,
            foundedYear: 1992,
            headquarters: "Scranton, PA"
          }
        ],
        metadata: {
          moduleType: "COMPANY_SEARCH",
          validationScores: {
            companyScore: 95
          },
          queryDetails: {
            original: "lawyers in scranton",
            refined: "legal services scranton pennsylvania law firms"
          }
        }
      }
    };

    // Send the webhook directly to our endpoint
    console.log("Sending test webhook payload for Scranton lawyers...");
    const response = await fetch("https://bear-app.replit.app/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error("Response:", errorText);
      return;
    }

    const data = await response.json();
    console.log("Webhook response:", data);
    
    // Now check if the companies were added to the database
    console.log("\nChecking for recent companies after webhook...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    
    const companiesResponse = await fetch("https://bear-app.replit.app/api/companies/recent");
    const companies = await companiesResponse.json();
    
    console.log(`Found ${companies.length} recent companies:`);
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
  } catch (error) {
    console.error("Error sending test webhook:", error.message);
  }
}

// Run the test
sendExactRabbitPayload();