import fetch from 'node-fetch';

async function sendExactRabbitPayload() {
  try {
    console.log("Sending exact Rabbit payload to our webhook endpoint...");
    
    // Use our temporary Replit URL
    const webhookUrl = "https://792ab54b-9c24-40c2-8c7a-936f8be76f49-00-2c33zjcioxp0j.picard.replit.dev/api/external-workflow/webhook";
    
    console.log("Webhook URL:", webhookUrl);
    
    // The exact payload from Rabbit
    const exactPayload = {
      "searchId": "rabbit_search_1745528215490",
      "status": "completed",
      "progress": 100,
      "results": {
        "companies": [
          {
            "name": "ExtraHop Networks",
            "website": "https://www.extrahop.com",
            "industry": "Cybersecurity",
            "location": "Seattle, WA",
            "description": "Cloud-native network detection and response solutions for enterprise security",
            "employeeCount": 450,
            "foundedYear": 2007,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Critical Insight",
            "website": "https://criticalinsight.com",
            "industry": "Cybersecurity",
            "location": "Seattle, WA",
            "description": "Managed detection and response services focusing on cloud environments",
            "employeeCount": 126,
            "foundedYear": 2011,
            "headquarters": "Seattle, WA"
          },
          {
            "name": "Polyverse",
            "website": "https://polyverse.com",
            "industry": "Cybersecurity",
            "location": "Bellevue, WA",
            "description": "Moving target defense and zero-trust security solutions for enterprise and cloud infrastructure",
            "employeeCount": 85,
            "foundedYear": 2015,
            "headquarters": "Bellevue, WA"
          },
          {
            "name": "Cyemptive Technologies",
            "website": "https://www.cyemptive.com",
            "industry": "Cybersecurity",
            "location": "Snohomish, WA",
            "description": "Advanced threat protection for cloud environments and critical infrastructure",
            "employeeCount": 67,
            "foundedYear": 2018,
            "headquarters": "Snohomish, WA"
          },
          {
            "name": "Auth0",
            "website": "https://auth0.com",
            "industry": "Identity Management",
            "location": "Bellevue, WA",
            "description": "Identity platform providing secure access for cloud applications",
            "employeeCount": 850,
            "foundedYear": 2013,
            "headquarters": "Bellevue, WA"
          }
        ],
        "metadata": {
          "moduleType": "COMPANY_SEARCH",
          "validationScores": {
            "companyScore": 89
          },
          "queryDetails": {
            "original": "Cybersecurity companies in Seattle specializing in cloud security",
            "refined": "Seattle cloud security cybersecurity companies"
          }
        }
      }
    };
    
    console.log("Sending Rabbit's exact payload...");
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exactPayload)
    });
    
    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);
    
    if (response.ok) {
      console.log("\n✅ Test completed successfully. Check your server logs to verify data processing.");
      console.log("You should now see these companies in your companies list:");
      console.log("- ExtraHop Networks");
      console.log("- Critical Insight");
      console.log("- Polyverse");
      console.log("- Cyemptive Technologies");
      console.log("- Auth0");
    } else {
      console.error("\n❌ Error testing webhook endpoint. See response details above.");
    }
    
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
sendExactRabbitPayload();