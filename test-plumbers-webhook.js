import fetch from 'node-fetch';

async function simulateRabbitPlumbersWebhook() {
  try {
    console.log("Simulating Rabbit webhook for plumbers in Seattle...");
    
    // Use our local webhook URL
    const webhookUrl = "http://localhost:5000/api/external-workflow/webhook";
    
    console.log("Local webhook URL:", webhookUrl);
    
    // The exact payload from Rabbit
    const plumbersPayload = {
      "searchId": "rabbit_search_1745531869507",
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "Bob Oates Sewer & Rooter",
            "website": "https://www.boboates.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Full-service plumbing and sewer repair company serving residential and commercial clients in Seattle",
            "employeeCount": 38,
            "foundedYear": 1995,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Fischer Plumbing",
            "website": "https://www.fischerplumbing.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Family-owned plumbing services company specializing in residential and commercial plumbing repairs and installations",
            "employeeCount": 45,
            "foundedYear": 1979,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Best Plumbing",
            "website": "https://www.bestplumbing.com",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Full-service plumbing contractor serving Seattle area homes and businesses since 1968",
            "employeeCount": 52,
            "foundedYear": 1968,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Fox Plumbing & Heating",
            "website": "https://www.foxplumbing.com",
            "industry": "Plumbing & HVAC",
            "location": "Seattle, WA",
            "description": "Combined plumbing and heating services for residential and commercial customers throughout the Seattle area",
            "employeeCount": 47,
            "foundedYear": 1964,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "South West Plumbing",
            "website": "https://www.southwestplumbing.biz",
            "industry": "Plumbing Services",
            "location": "Seattle, WA",
            "description": "Family-owned plumbing company providing drain cleaning, water heater installation, and plumbing repairs",
            "employeeCount": 40,
            "foundedYear": 1982,
            "headquarters": "Seattle, WA"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 91
          },
          "queryDetails": {
            "original": "mid-sized plumbers in seattle",
            "refined": "seattle plumbing companies 30-60 employees"
          }
        }
      }
    };
    
    console.log("Sending Rabbit's plumbers payload to local webhook...");
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plumbersPayload)
    });
    
    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);
    
    if (response.ok) {
      console.log("\n✅ Test completed successfully. Check your server logs to verify data processing.");
      console.log("You should now see these companies in your companies list:");
      console.log("- Bob Oates Sewer & Rooter");
      console.log("- Fischer Plumbing");
      console.log("- Best Plumbing");
      console.log("- Fox Plumbing & Heating");
      console.log("- South West Plumbing");
    } else {
      console.error("\n❌ Error testing webhook endpoint. See response details above.");
    }
    
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
simulateRabbitPlumbersWebhook();