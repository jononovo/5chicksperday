// Test script for Lead-Gen Donkey production integration
import fetch from 'node-fetch';

// This should match our environment variable
const LEAD_GEN_DONKEY_PROD_API_KEY = process.env.LEAD_GEN_DONKEY_PROD_API_KEY;

// Donkey production endpoint with proper workflow ID structure
// Format should be: /api/webhooks/workflow/{workflowId}/node/webhook_trigger-1
const endpoint = "https://b45e11fa-5450-41c3-9aae-b0c5d9ba4636-00-2t2y9b3rc04rn.kirk.replit.dev/api/webhooks/workflow/6/node/webhook_trigger-1";

// Our webhook endpoint to receive results - using our current development URL
const callbackUrl = "https://792ab54b-9c24-40c2-8c7a-936f8be76f49-00-2c33zjcioxp0j.picard.replit.dev/api/external-workflow/webhook";

// Test query
const query = "software engineering firms in San Francisco specializing in AI";

async function testDonkeyIntegration() {
  console.log("Testing Lead-Gen Donkey Production Integration");
  console.log("Endpoint:", endpoint);
  console.log("Callback URL:", callbackUrl);
  
  // Build request payload in the simplified format Donkey expects
  const requestBody = {
    query,
    callbackUrl
  };
  
  console.log("Request Body:", JSON.stringify(requestBody, null, 2));
  
  try {
    // Make API request to Donkey provider
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LEAD_GEN_DONKEY_PROD_API_KEY}`
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
      console.error(`Donkey API error (${response.status}): ${errorText}`);
      return;
    }
    
    // Log the raw response
    const responseText = await response.text();
    console.log("Raw response:", responseText);
    
    // Parse and display the result
    const result = responseText ? JSON.parse(responseText) : {};
    console.log("Search request sent successfully");
    console.log("Search ID:", result.searchId);
    console.log("Status:", result.status);
    
    console.log("Test completed. Check webhook endpoint for incremental updates.");
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
testDonkeyIntegration();