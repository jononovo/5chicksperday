/**
 * Script to check for a specific company in the deployed application
 */

import fetch from 'node-fetch';

async function checkSpecificCompany(companyName) {
  try {
    console.log(`Checking for company: "${companyName}" at deployed application...`);
    
    // First, try to get all companies (not just recent ones)
    const allCompaniesUrl = 'https://bear-app.replit.app/api/companies';
    console.log(`Checking all companies at: ${allCompaniesUrl}`);
    
    try {
      const allCompaniesResponse = await fetch(allCompaniesUrl);
      const allCompanies = await allCompaniesResponse.json();
      
      console.log(`\nFound ${allCompanies.length} total companies.`);
      
      // Search for the specific company by name
      const matchingCompanies = allCompanies.filter(company => 
        company.name && company.name.toLowerCase().includes(companyName.toLowerCase())
      );
      
      if (matchingCompanies.length > 0) {
        console.log(`\nFound ${matchingCompanies.length} companies matching "${companyName}":`);
        matchingCompanies.forEach(company => {
          console.log(`- ${company.name} (ID: ${company.id})`);
          console.log(`  Location: ${company.location || 'Unknown'}`);
          console.log(`  Industry: ${company.industry || 'Unknown'}`);
          console.log(`  Created: ${company.createdAt || 'Unknown'}`);
        });
        return true;
      } else {
        console.log(`\nNo companies found matching "${companyName}" in all companies.`);
      }
    } catch (error) {
      console.log(`Error fetching all companies: ${error.message}`);
      console.log('Continuing with other search methods...');
    }
    
    // If all companies endpoint fails, try recent companies
    const recentCompaniesUrl = 'https://bear-app.replit.app/api/companies/recent';
    console.log(`\nChecking recent companies at: ${recentCompaniesUrl}`);
    
    const recentCompaniesResponse = await fetch(recentCompaniesUrl);
    const recentCompanies = await recentCompaniesResponse.json();
    
    console.log(`\nFound ${recentCompanies.length} recent companies.`);
    
    // Search for the specific company by name
    const matchingRecentCompanies = recentCompanies.filter(company => 
      company.name && company.name.toLowerCase().includes(companyName.toLowerCase())
    );
    
    if (matchingRecentCompanies.length > 0) {
      console.log(`\nFound ${matchingRecentCompanies.length} recent companies matching "${companyName}":`);
      matchingRecentCompanies.forEach(company => {
        console.log(`- ${company.name} (ID: ${company.id})`);
        console.log(`  Location: ${company.location || 'Unknown'}`);
        console.log(`  Industry: ${company.industry || 'Unknown'}`);
        console.log(`  Created: ${company.createdAt || 'Unknown'}`);
      });
      return true;
    } else {
      console.log(`\nNo companies found matching "${companyName}" in recent companies.`);
    }
    
    // Try to check companies by search ID if possible
    console.log('\nChecking for companies by search ID...');
    try {
      const searchResultsUrl = 'https://bear-app.replit.app/api/search-results/rabbit_search_1745536572139';
      console.log(`Checking search results at: ${searchResultsUrl}`);
      
      const searchResultsResponse = await fetch(searchResultsUrl);
      const searchResults = await searchResultsResponse.json();
      
      if (searchResults && searchResults.companies) {
        console.log(`\nFound ${searchResults.companies.length} companies in search results:`);
        
        // Search for the specific company in the search results
        const matchingSearchCompanies = searchResults.companies.filter(company => 
          company.name && company.name.toLowerCase().includes(companyName.toLowerCase())
        );
        
        if (matchingSearchCompanies.length > 0) {
          console.log(`\nFound ${matchingSearchCompanies.length} search result companies matching "${companyName}":`);
          matchingSearchCompanies.forEach(company => {
            console.log(`- ${company.name}`);
            console.log(`  Location: ${company.location || 'Unknown'}`);
            console.log(`  Industry: ${company.industry || 'Unknown'}`);
          });
          return true;
        } else {
          console.log(`\nNo companies found matching "${companyName}" in search results.`);
        }
      } else {
        console.log('No search results found or invalid format.');
      }
    } catch (error) {
      console.log(`Error fetching search results: ${error.message}`);
    }
    
    // If we get here, we didn't find the company
    return false;
    
  } catch (error) {
    console.error(`Error checking for specific company:`, error);
    return false;
  }
}

// Run the function with the company name
checkSpecificCompany('Texas Premier Plumbing');