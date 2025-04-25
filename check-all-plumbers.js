/**
 * Script to check for any plumbing companies or Austin-based companies in the deployed application
 */

import fetch from 'node-fetch';

async function checkForPlumbers() {
  try {
    console.log(`Checking for any plumbing companies or Austin-based companies...`);
    
    // Get all companies
    const allCompaniesUrl = 'https://bear-app.replit.app/api/companies';
    console.log(`\nChecking all companies at: ${allCompaniesUrl}`);
    
    const allCompaniesResponse = await fetch(allCompaniesUrl);
    const allCompanies = await allCompaniesResponse.json();
    
    console.log(`\nFound ${allCompanies.length} total companies.`);
    
    // Search for plumbing companies or Austin-based companies
    const plumbingKeywords = ['plumb', 'plumbing', 'pipe', 'water', 'drain'];
    const locationKeywords = ['austin', 'texas', 'tx'];
    
    const matchingCompanies = allCompanies.filter(company => {
      // Check name for plumbing keywords
      const nameMatch = company.name && plumbingKeywords.some(keyword => 
        company.name.toLowerCase().includes(keyword)
      );
      
      // Check industry for plumbing keywords
      const industryMatch = company.industry && plumbingKeywords.some(keyword => 
        company.industry.toLowerCase().includes(keyword)
      );
      
      // Check description for plumbing keywords
      const descriptionMatch = company.description && plumbingKeywords.some(keyword => 
        company.description.toLowerCase().includes(keyword)
      );
      
      // Check location for Austin keywords
      const locationMatch = company.location && locationKeywords.some(keyword => 
        company.location.toLowerCase().includes(keyword)
      );
      
      return nameMatch || industryMatch || descriptionMatch || locationMatch;
    });
    
    if (matchingCompanies.length > 0) {
      console.log(`\nFound ${matchingCompanies.length} companies related to plumbing or Austin:`);
      matchingCompanies.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        console.log(`  Location: ${company.location || 'Unknown'}`);
        console.log(`  Industry: ${company.industry || 'Unknown'}`);
        console.log(`  Description: ${company.description ? company.description.substring(0, 100) + '...' : 'Not available'}`);
        console.log(`  Created: ${company.createdAt || 'Unknown'}`);
        console.log(``);
      });
      return true;
    } else {
      console.log(`\nNo companies found related to plumbing or Austin.`);
    }
    
    return false;
    
  } catch (error) {
    console.error(`Error checking for plumbing companies:`, error);
    return false;
  }
}

// Run the function
checkForPlumbers();