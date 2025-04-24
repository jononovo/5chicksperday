// Simple test script for Lead-Gen Donkey integration
import fetch from 'node-fetch';

// URL to our own API endpoint that handles Donkey integration
const endpoint = "http://localhost:5000/api/external-provider/donkey";

// Test query
const query = "software engineering firms in San Francisco specializing in AI";

async function testSimpleDonkeyIntegration() {
  console.log("Testing Simplified Lead-Gen Donkey Integration");
  console.log("Query:", query);
  
  try {
    // Make API request to our endpoint that handles Donkey integration
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error (${response.status}): ${errorText}`);
      return;
    }
    
    // Parse and display the result
    const result = await response.json();
    console.log("Search completed successfully");
    console.log("Response:", JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error("Error during test:", error.message);
  }
}

// Run the test
testSimpleDonkeyIntegration();