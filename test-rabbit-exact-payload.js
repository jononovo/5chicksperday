import fetch from 'node-fetch';

async function sendExactRabbitPayload() {
  try {
    // This is an exact copy of the JSON payload as reported by Lead-Gen Rabbit
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

    // Test with the exact same headers and parameters as Rabbit is using
    console.log("=== Testing with exact Rabbit headers and configuration ===");
    await testWebhookWithExactRabbitConfig(payload);
    
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
    console.error("Error in test:", error.message);
  }
}

async function testWebhookWithExactRabbitConfig(payload) {
  const url = "https://Bear-App.replit.app/api/external-workflow/webhook";
  
  try {
    console.log(`Testing webhook at ${url} with exact Rabbit configuration`);
    
    // Use the EXACT same headers reported by Rabbit
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': 'rabbit_search_1745532088419',
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'LeadGenRabbit/1.0',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(payload),
      // Add a timeout to mimic Rabbit's behavior
      timeout: 30000
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      const data = await response.json();
      console.log("Response data:", data);
    } else {
      const errorText = await response.text();
      console.error("Error response:", errorText);
    }
  } catch (error) {
    console.error(`Failed to test webhook at ${url}:`, error.message);
    
    // This is likely the same error Rabbit is encountering
    if (error.type === 'request-timeout' || error.message.includes('timeout')) {
      console.error('\nTIMEOUT ERROR - This matches the error reported by Rabbit');
      console.error('The webhook is not responding within the expected timeframe (30 seconds)');
    }
  }
}

// Run the test
sendExactRabbitPayload();