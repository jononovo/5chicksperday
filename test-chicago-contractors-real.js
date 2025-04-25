import fetch from 'node-fetch';

async function testRealChicagoRequest() {
  console.log("Testing real Chicago electrical contractors search with keep-alive...");
  
  try {
    // Send a request to the Rabbit endpoint
    console.log("Sending search request to Rabbit endpoint...");
    const response = await fetch("http://localhost:5000/api/external-provider/rabbit", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: "mid-sized electrical contractor companies in Chicago"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Search initiated successfully:");
    console.log(JSON.stringify(data, null, 2));
    console.log("Search ID:", data.searchId);
    console.log("Keep-alive activated:", data.keepAlive === true ? "Yes" : "No");
    
    console.log("\nThe application will now stay awake for 15 minutes");
    console.log("waiting for webhook responses from Lead-Gen Rabbit.");
    
    // You can now use another terminal window to check logs
    console.log("\nTo monitor the logs and see keep-alive activity, run:");
    console.log("  curl http://localhost:5000/api/debug/logs");
    
  } catch (error) {
    console.error("Error testing Chicago search:", error);
  }
}

// Run the test
testRealChicagoRequest();