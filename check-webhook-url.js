import fetch from 'node-fetch';

// This script checks if our webhook URL is reachable from the public internet
async function checkWebhookUrl() {
  try {
    console.log("Checking webhook URL accessibility...");
    
    // Use the same URL that we're providing to Rabbit 
    // Get the Replit URL from the server logs or environment
    const protocol = 'https';
    const host = '792ab54b-9c24-40c2-8c7a-936f8be76f49-00-2c33zjcioxp0j.picard.replit.dev';
    const callbackUrl = `${protocol}://${host}/api/external-workflow/webhook`;
    
    console.log("Webhook URL:", callbackUrl);
    
    // Send a GET request to check basic reachability
    console.log("Testing with simple GET request...");
    const getResponse = await fetch(callbackUrl, {
      method: 'GET',
      timeout: 10000, // 10s timeout
    });
    
    console.log("GET Response status:", getResponse.status);
    console.log("GET Response headers:", getResponse.headers);
    const getText = await getResponse.text();
    console.log("GET Response text:", getText);
    
    // Now try a simple POST with minimal data
    console.log("\nTesting with minimal POST request...");
    const postResponse = await fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        searchId: 'public_url_test',
        status: 'in_progress'
      }),
      timeout: 10000, // 10s timeout
    });
    
    console.log("POST Response status:", postResponse.status);
    const postText = await postResponse.text();
    console.log("POST Response text:", postText);
    
    if (getResponse.ok || postResponse.ok) {
      console.log("\n✅ Webhook URL is accessible from the public internet.");
      console.log("This URL should be working correctly for Rabbit's callbacks.");
    } else {
      console.log("\n❌ Webhook URL is NOT accessible from the public internet.");
      console.log("This may be why we're not receiving callbacks from Rabbit.");
    }
    
  } catch (error) {
    console.error("\n❌ Error checking webhook URL:", error.message);
    console.log("This may indicate a connectivity issue with our webhook endpoint.");
  }
}

// Run the check
checkWebhookUrl();