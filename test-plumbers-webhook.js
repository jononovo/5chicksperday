import fetch from 'node-fetch';

async function simulateRabbitPlumbersWebhook() {
  try {
    // Testing with Seattle plumbers data
    const payload = {
      "searchId": `rabbit_search_${Date.now()}`,
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "Bob's Plumbing & Heating",
            "website": "https://www.bobsplumbing.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Full-service plumbing company offering residential and commercial services",
            "employeeCount": 28,
            "foundedYear": 1982,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Seattle Plumbing Experts",
            "website": "https://www.seattleplumbingexperts.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Professional plumbers specializing in emergency repairs and renovations",
            "employeeCount": 42,
            "foundedYear": 1995,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Pacific Northwest Plumbing",
            "website": "https://www.pnwplumbing.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Eco-friendly plumbing solutions for residential and commercial clients",
            "employeeCount": 35,
            "foundedYear": 2001,
            "headquarters": "Seattle, WA"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 92
          },
          "queryDetails": {
            "original": "mid-sized plumbers in Seattle",
            "refined": "seattle washington plumbing companies"
          }
        }
      }
    };

    // Use the exact same headers reported by Rabbit
    console.log("Sending test webhook payload with exact Rabbit headers...");
    const response = await fetch("https://bear-app.replit.app/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': payload.searchId,
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'LeadGenRabbit/1.0',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
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
    console.log("(Note: The companies might still be processing asynchronously)");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const companiesResponse = await fetch("https://bear-app.replit.app/api/companies/recent");
    const companies = await companiesResponse.json();
    
    console.log(`Found ${companies.length} recent companies:`);
    companies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
    console.log("\nWaiting a bit longer to allow background processing to complete...");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait another 3 seconds
    
    const companiesResponse2 = await fetch("https://bear-app.replit.app/api/companies/recent");
    const companies2 = await companiesResponse2.json();
    
    console.log(`\nAfter waiting: Found ${companies2.length} recent companies:`);
    companies2.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
  } catch (error) {
    console.error("Error sending test webhook:", error.message);
  }
}

// Run the test
simulateRabbitPlumbersWebhook();