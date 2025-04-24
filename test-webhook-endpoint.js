import fetch from 'node-fetch';

async function testWebhookEndpoint() {
  try {
    // First, test if the endpoint is accessible
    console.log("Testing webhook endpoint accessibility...");
    
    // Simple GET request to see if the endpoint is accessible
    const getResponse = await fetch("https://bear-app.replit.app/api/external-workflow/webhook");
    console.log(`GET Response status: ${getResponse.status} ${getResponse.statusText}`);
    
    // Now test with a simple POST request
    const simplePayload = {
      test: true,
      message: "Simple test of webhook endpoint"
    };
    
    const postResponse = await fetch("https://bear-app.replit.app/api/external-workflow/webhook", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(simplePayload)
    });
    
    console.log(`POST Response status: ${postResponse.status} ${postResponse.statusText}`);
    const postResponseText = await postResponse.text();
    console.log("POST Response body:", postResponseText);
    
  } catch (error) {
    console.error("Error testing webhook endpoint:", error.message);
  }
}

// Run the test
testWebhookEndpoint();