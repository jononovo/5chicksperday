/**
 * Simple script to test if our webhook endpoint is reachable and responsive
 */
import fetch from 'node-fetch';

async function testWebhookConnectivity() {
  console.log("Testing webhook endpoint connectivity...");
  
  const url = "https://Bear-App.replit.app/api/external-workflow/webhook";
  const payload = {
    searchId: `test_connectivity_${Date.now()}`,
    status: "completed",
    progress: 100,
    results: {
      companies: [
        {
          name: "CONNECTIVITY TEST COMPANY",
          location: "Test Location",
          industry: "Test Industry"
        }
      ]
    }
  };
  
  console.log(`Sending test request to ${url} at ${new Date().toISOString()}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': payload.searchId,
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'ConnectivityTest/1.0'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`Response Body: ${responseText}`);
    
    if (response.ok) {
      console.log("Webhook endpoint is reachable and responding correctly!");
      console.log("Wait 30 seconds for processing to complete...");
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check if the test company was added
      console.log("Checking if our test company was added to the database...");
      const companiesResponse = await fetch("https://Bear-App.replit.app/api/companies/recent");
      const companies = await companiesResponse.json();
      
      const testCompany = companies.find(c => c.name === "CONNECTIVITY TEST COMPANY");
      
      if (testCompany) {
        console.log("SUCCESS! Test company was successfully added to the database!");
        console.log("Company details:", testCompany);
      } else {
        console.log("FAILURE: Test company was not added to the database.");
        console.log("This indicates a problem with webhook processing.");
        console.log("Most recent companies:");
        companies.slice(0, 5).forEach((c, i) => console.log(`${i+1}. ${c.name}`));
      }
    } else {
      console.log("Webhook endpoint returned an error response.");
    }
  } catch (error) {
    console.error("Error connecting to webhook endpoint:", error);
    console.log("This may indicate network connectivity issues or that the endpoint doesn't exist.");
  }
}

// Run the test
testWebhookConnectivity();