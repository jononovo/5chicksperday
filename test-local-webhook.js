import fetch from 'node-fetch';

async function testDeployedWebhook() {
  try {
    // Create a test payload for Orlando real estate
    const payload = {
      "searchId": `test_orlando_deployed_${Date.now()}`,
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "Century 21 Orlando",
            "website": "https://www.century21orlando.com",
            "industry": "Real Estate",
            "location": "Orlando, FL",
            "description": "Residential and commercial real estate agency serving Orlando metropolitan area",
            "employeeCount": 85,
            "foundedYear": 1988,
            "headquarters": "Orlando, FL"
          },
          {
            "name": "RE/MAX Orlando Properties",
            "website": "https://www.remaxorlando.com",
            "industry": "Real Estate",
            "location": "Orlando, FL",
            "description": "Full-service real estate brokerage specializing in Orlando residential properties",
            "employeeCount": 110,
            "foundedYear": 1992,
            "headquarters": "Orlando, FL"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 92
          },
          "queryDetails": {
            "original": "real estate companies in orlando",
            "refined": "orlando florida real estate agencies"
          }
        }
      }
    };

    console.log("Testing deployed webhook endpoint...")
    
    // Test the deployed endpoint
    const deployedResponse = await fetch("https://bear-app.replit.app/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': payload.searchId,
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'LeadGenRabbit/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Deployed webhook response status: ${deployedResponse.status}`);
    if (deployedResponse.ok) {
      const deployedData = await deployedResponse.json();
      console.log("Deployed webhook response:", deployedData);
      
      // Wait for data to be processed
      console.log("Waiting for data to be processed...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if companies were added
      console.log("Checking for Orlando real estate companies...");
      const companiesResponse = await fetch("https://bear-app.replit.app/api/companies/recent");
      const companies = await companiesResponse.json();
      
      console.log(`Found ${companies.length} recent companies:`);
      companies.slice(0, 5).forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (${company.location || 'No location'}) - ID: ${company.id}`);
      });
    } else {
      const errorText = await deployedResponse.text();
      console.error("Error response:", errorText);
    }
    
  } catch (error) {
    console.error("Error testing deployed webhook:", error.message);
  }
}

// Run the test
testDeployedWebhook();