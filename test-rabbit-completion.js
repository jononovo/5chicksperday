// Test script for sending a new search request to Lead-Gen Rabbit
import fetch from 'node-fetch';

// Our API key for Rabbit
const LEAD_GEN_RABBIT_API_KEY = process.env.LEAD_GEN_RABBIT_API_KEY;

// Rabbit API endpoint
const rabbitEndpoint = "https://358f51b5-fd9b-4fb9-82f8-7cf56a3f18d6-00-161sbihgzmt13.worf.replit.dev/api/webhooks/workflow/6/node/webhook_trigger-1";

// Our webhook endpoint where we will receive the results
const ourWebhookEndpoint = "https://792ab54b-9c24-40c2-8c7a-936f8be76f49-00-2c33zjcioxp0j.picard.replit.dev/api/external-workflow/webhook";

async function testRabbitIntegration() {
  console.log("Testing Lead-Gen Rabbit Integration");
  console.log("Rabbit Endpoint:", rabbitEndpoint);
  console.log("Our Webhook URL:", ourWebhookEndpoint);
  
  // Test query
  const query = "software engineering firms in San Francisco specializing in AI";
  
  // Build the request payload according to Rabbit's requirements
  const requestBody = {
    searchId: `rabbit_search_${Date.now()}`,
    query,
    moduleTypes: ["COMPANY_OVERVIEW", "DECISION_MAKER", "EMAIL_DISCOVERY"],
    configuration: {
      incrementalUpdates: true,
      validationThresholds: {
        companyScore: 60,
        contactScore: 70,
        emailScore: 65
      },
      filterCriteria: {
        companySize: { min: 10, max: 500 }
      }
    },
    callbackUrl: ourWebhookEndpoint
  };
  
  console.log("Sending search request with payload:", JSON.stringify(requestBody, null, 2));
  
  try {
    // Make API request to Rabbit
    const response = await fetch(rabbitEndpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LEAD_GEN_RABBIT_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });
    
    // Check for rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '10', 10);
      console.error(`Rate limit hit. Retry after ${retryAfter} seconds.`);
      return;
    }
    
    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Rabbit API error (${response.status}): ${errorText}`);
      return;
    }
    
    // Log the raw response
    const responseText = await response.text();
    console.log("Raw response:", responseText);
    
    // Parse and display the result
    const result = responseText ? JSON.parse(responseText) : {};
    console.log("Search request sent successfully");
    
    // Extract the search ID from our request payload - this is what we'll use to track the search
    const searchId = requestBody.searchId;
    console.log("Search ID:", searchId);
    
    // The status starts as 'in_progress' and will be updated via webhooks
    console.log("Initial Status: in_progress");
    
    console.log("\nTest completed. Check your server logs for webhook callbacks from Rabbit.");
    console.log("They should be sending progress updates (10%, 35%, 70%) and a final completion (100%)");
    console.log("with company and contact data to your webhook endpoint.");
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
testRabbitIntegration();