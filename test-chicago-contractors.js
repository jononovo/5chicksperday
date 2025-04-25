import fetch from 'node-fetch';

async function testChicagoContractors() {
  try {
    // Create a test payload based on Rabbit's Chicago electrical contractors data
    const payload = {
      "searchId": "rabbit_search_1745534489271", // Use the same ID Rabbit sent
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "Taylor Electric Company",
            "website": "https://www.taylorelectric.com",
            "industry": "Electrical Contractors",
            "location": "Chicago, IL",
            "description": "Mid-sized electrical contracting firm specializing in commercial and industrial projects",
            "employeeCount": 78,
            "foundedYear": 1922,
            "headquarters": "Chicago, IL"
          },
          {
            "name": "Kelso-Burnett Co.",
            "website": "https://www.kelso-burnett.com",
            "industry": "Electrical Contractors",
            "location": "Chicago, IL",
            "description": "Full-service electrical and technology contractor serving the Chicago area",
            "employeeCount": 120,
            "foundedYear": 1908,
            "headquarters": "Rolling Meadows, IL"
          },
          {
            "name": "McWilliams Electric Company",
            "website": "https://www.mcwilliamselectric.com",
            "industry": "Electrical Contractors",
            "location": "Chicago, IL",
            "description": "Commercial and industrial electrical contractor serving Chicagoland area",
            "employeeCount": 85,
            "foundedYear": 1948,
            "headquarters": "Schaumburg, IL"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 94
          },
          "queryDetails": {
            "original": "mid-sized electrical contractor companies in chicago",
            "refined": "electrical contractors chicago illinois 50-150 employees"
          }
        }
      }
    };

    // Send the test webhook to our local server now that it's running
    console.log("Sending test webhook for Chicago electrical contractors...");
    const response = await fetch("http://localhost:5000/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': payload.searchId,
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'LeadGenRabbit/1.0'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    console.log(`Response status: ${response.status}`);
    console.log("Response data:", responseData);
    
    // Wait a moment for data to be processed
    console.log("\nWaiting for data to be processed...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if companies were added
    console.log("Checking for Chicago electrical contractors...");
    const companiesResponse = await fetch("http://localhost:5000/api/companies/recent");
    const companies = await companiesResponse.json();
    
    const chicagoCompanies = companies.filter(c => 
      c.name.includes('Electric') || 
      c.name.includes('Electrical') || 
      (c.location && c.location.includes('Chicago'))
    );
    
    console.log(`\nFound ${chicagoCompanies.length} Chicago electrical companies:`);
    chicagoCompanies.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name} (ID: ${company.id})`);
    });
    
  } catch (error) {
    console.error("Error testing Chicago contractors webhook:", error);
  }
}

// Run the test
testChicagoContractors();