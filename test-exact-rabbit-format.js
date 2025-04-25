/**
 * Test script to exactly replicate what Lead-Gen Rabbit says they sent
 * Based on the technical report they provided
 */
import fetch from 'node-fetch';

async function testExactRabbitFormat() {
  console.log("Testing with EXACT Lead-Gen Rabbit format from their technical report...");
  
  const searchId = 'rabbit_search_1745537319451';
  const url = "https://Bear-App.replit.app/api/external-workflow/webhook";
  
  // Create an exact payload based on the Rabbit technical report
  const payload = {
    searchId: searchId,
    status: "completed",
    progress: 100,
    results: {
      companies: [
        {
          name: "Denver Transport Solutions",
          website: "https://denvertransport.example.com",
          industry: "Transportation & Logistics",
          location: "Denver, CO",
          description: "Mid-sized transportation company serving the Denver metropolitan area",
          employeeCount: 75,
          foundedYear: 2005,
          revenue: "$5-10 million",
          headquarters: "Denver, CO",
          contacts: [
            {
              name: "Michael Johnson",
              role: "Operations Director",
              email: "mjohnson@denvertransport.example.com",
              phoneNumber: "303-555-1234"
            }
          ]
        },
        {
          name: "Colorado Freight Systems",
          website: "https://coloradofreight.example.com",
          industry: "Transportation & Logistics",
          location: "Denver, CO",
          description: "Specialized freight transport company operating throughout Colorado",
          employeeCount: 60,
          foundedYear: 2008
        }
      ],
      metadata: {
        moduleType: "COMPANY_OVERVIEW",
        completedSearches: ["LOCAL_SOURCES", "COMPANY_PROFILER"],
        validationScores: {
          companyScore: 85,
          contactScore: 78
        },
        queryDetails: {
          original: "mid-sized transport companies in Denver",
          refined: "medium-sized transportation and logistics companies in Denver, Colorado"
        }
      }
    }
  };
  
  console.log(`Sending exact Rabbit format test to ${url} at ${new Date().toISOString()}`);
  console.log(`Using the same searchId they mentioned: ${searchId}`);
  
  try {
    // Using EXACTLY the same headers they mentioned in their report
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LGR-Search-ID': searchId,
        'X-LGR-Webhook-Type': 'progress_update',
        'User-Agent': 'LeadGenRabbit/1.0',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`Response Body: ${responseText}`);
    
    if (response.ok) {
      console.log("Webhook endpoint acknowledged our request!");
      console.log("Wait 30 seconds for processing to complete...");
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check if the test companies were added
      console.log("Checking if our test Denver transport companies were added to the database...");
      const companiesResponse = await fetch("https://Bear-App.replit.app/api/companies/recent");
      const companies = await companiesResponse.json();
      
      // Look for our test Denver companies
      const denverCompanies = companies.filter(c => 
        c.name === "Denver Transport Solutions" || 
        c.name === "Colorado Freight Systems"
      );
      
      if (denverCompanies.length > 0) {
        console.log("SUCCESS! Denver transport companies were successfully added to the database!");
        denverCompanies.forEach(company => {
          console.log(`Company: ${company.name} (ID: ${company.id})`);
          console.log(`  Industry: ${company.industry}`);
          console.log(`  Location: ${company.location}`);
        });
      } else {
        console.log("FAILURE: Denver transport companies were not added to the database.");
        console.log("This indicates a problem with webhook processing for this specific format.");
        console.log("Most recent companies:");
        companies.slice(0, 5).forEach((c, i) => console.log(`${i+1}. ${c.name} (ID: ${c.id})`));
      }
    } else {
      console.log("Webhook endpoint returned an error response.");
    }
  } catch (error) {
    console.error("Error sending test:", error);
  }
}

// Run the test
testExactRabbitFormat();