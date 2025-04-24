import fetch from 'node-fetch';

async function simulateRabbitPlumbersWebhook() {
  try {
    // This is an exact copy of the JSON format from the Rabbit response for "lawyers in Scranton"
    const payload = {
      "searchId": "rabbit_search_1745532088419",
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "Munley Law",
            "website": "https://www.munley.com",
            "industry": "Legal Services",
            "location": "Scranton, PA",
            "description": "Personal injury law firm specializing in truck accidents, workers' compensation and product liability",
            "employeeCount": 47,
            "foundedYear": 1959,
            "headquarters": "Scranton, PA"
          },
          {
            "name": "Mazzoni Karam Petorak & Valvano",
            "website": "https://www.mkkpvlaw.com",
            "industry": "Legal Services",
            "location": "Scranton, PA",
            "description": "Full-service law firm handling criminal defense, personal injury, and business law",
            "employeeCount": 18,
            "foundedYear": 1962,
            "headquarters": "Scranton, PA"
          },
          {
            "name": "O'Malley & Langan Law Offices",
            "website": "https://www.omalleylangan.com",
            "industry": "Legal Services",
            "location": "Scranton, PA",
            "description": "Workers' compensation and personal injury law firm serving northeastern Pennsylvania",
            "employeeCount": 23,
            "foundedYear": 1990,
            "headquarters": "Scranton, PA"
          },
          {
            "name": "Schwartz Law Firm LLC",
            "website": "https://www.schwartzlawfirmllc.com",
            "industry": "Legal Services",
            "location": "Scranton, PA",
            "description": "General practice law firm focusing on family law, estate planning, and real estate",
            "employeeCount": 12,
            "foundedYear": 2003,
            "headquarters": "Scranton, PA"
          },
          {
            "name": "Cognetti & Cimini",
            "website": "https://www.cognetti-law.com",
            "industry": "Legal Services",
            "location": "Scranton, PA",
            "description": "Law firm specializing in family law, divorce, and custody matters",
            "employeeCount": 14,
            "foundedYear": 1995,
            "headquarters": "Scranton, PA"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 95
          },
          "queryDetails": {
            "original": "lawyers in scranton",
            "refined": "scranton pennsylvania law firms"
          }
        }
      }
    };

    // Send to both the local and deployed webhook endpoints for testing
    console.log("Sending test webhook payload to deployed endpoint...");
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
    console.log("\nChecking for companies after webhook...");
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
simulateRabbitPlumbersWebhook();