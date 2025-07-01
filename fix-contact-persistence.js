import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function fixContactPersistence() {
  console.log('=== COMPREHENSIVE CONTACT PERSISTENCE FIX ===\n');
  
  try {
    // Step 1: Create test user directly via simplified auth
    console.log('1. CREATING TEST USER:');
    const createUserResponse = await fetch(`${BASE_URL}/api/auth/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'debug@test.com',
        password: 'test123'
      })
    });
    
    let userId = null;
    if (createUserResponse.ok) {
      const userData = await createUserResponse.json();
      console.log('✅ User created:', userData);
      userId = userData.id;
    } else {
      console.log('User creation failed or user exists, proceeding...');
    }
    
    // Step 2: Test search API with proper authentication
    console.log('\n2. TESTING SEARCH WITH AUTHENTICATION:');
    const searchResponse = await fetch(`${BASE_URL}/api/companies/quick-search`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer debug@test.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'Tech startups in Boston',
        searchType: 'contacts'
      })
    });
    
    console.log('Search status:', searchResponse.status);
    const searchData = await searchResponse.json();
    
    if (searchData.companies && searchData.companies.length > 0) {
      console.log(`✅ Search successful: ${searchData.companies.length} companies found`);
      
      const firstCompany = searchData.companies[0];
      console.log(`First company: ${firstCompany.name}`);
      console.log(`Contacts in search: ${firstCompany.contacts?.length || 0}`);
      
      if (firstCompany.contacts && firstCompany.contacts.length > 0) {
        console.log('Sample contacts from search:');
        firstCompany.contacts.slice(0, 3).forEach((contact, i) => {
          console.log(`  ${i+1}. ${contact.name} - ${contact.role || 'No role'} - ID: ${contact.id || 'No ID'}`);
        });
        
        // Step 3: Save search as list
        console.log('\n3. SAVING SEARCH AS LIST:');
        const saveResponse = await fetch(`${BASE_URL}/api/lists`, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer debug@test.com',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companies: searchData.companies,
            prompt: 'Tech startups in Boston',
            contactSearchConfig: {}
          })
        });
        
        if (saveResponse.ok) {
          const savedList = await saveResponse.json();
          console.log(`✅ List saved with ID: ${savedList.listId}`);
          
          // Step 4: Immediate verification - check contacts exist in database
          console.log('\n4. VERIFYING CONTACT PERSISTENCE:');
          
          // Check companies for the list
          const companiesResponse = await fetch(`${BASE_URL}/api/lists/${savedList.listId}/companies`, {
            headers: { 'Authorization': 'Bearer debug@test.com' }
          });
          
          if (companiesResponse.ok) {
            const companies = await companiesResponse.json();
            console.log(`✅ Retrieved ${companies.length} companies from saved list`);
            
            if (companies.length > 0) {
              const firstSavedCompany = companies[0];
              console.log(`Checking company: ${firstSavedCompany.name} (ID: ${firstSavedCompany.id})`);
              
              // Check contacts for this company
              const contactsResponse = await fetch(`${BASE_URL}/api/companies/${firstSavedCompany.id}/contacts`, {
                headers: { 'Authorization': 'Bearer debug@test.com' }
              });
              
              if (contactsResponse.ok) {
                const contacts = await contactsResponse.json();
                console.log(`✅ Retrieved ${contacts.length} contacts for company ${firstSavedCompany.name}`);
                
                if (contacts.length > 0) {
                  console.log('✅ SUCCESS: Contacts persisted correctly!');
                  console.log('Sample persisted contacts:');
                  contacts.slice(0, 3).forEach((contact, i) => {
                    console.log(`  ${i+1}. ${contact.name} - ${contact.role || 'No role'} - Email: ${contact.email || 'None'}`);
                  });
                } else {
                  console.log('❌ PROBLEM: NO CONTACTS FOUND AFTER SAVING!');
                  await analyzeContactLoss(firstSavedCompany.id);
                }
              } else {
                console.log(`❌ Failed to fetch contacts: ${contactsResponse.status}`);
                const errorText = await contactsResponse.text();
                console.log('Error details:', errorText);
              }
            }
          } else {
            console.log(`❌ Failed to fetch companies: ${companiesResponse.status}`);
          }
          
          // Step 5: Test list loading (simulate clicking on saved search)
          console.log('\n5. TESTING LIST LOADING (CLICK SIMULATION):');
          await testListLoading(savedList.listId);
          
        } else {
          console.log(`❌ Failed to save list: ${saveResponse.status}`);
          const errorText = await saveResponse.text();
          console.log('Save error:', errorText);
        }
      } else {
        console.log('❌ NO CONTACTS CREATED DURING SEARCH!');
      }
    } else {
      console.log('❌ Search failed or returned no companies');
      console.log('Search response:', searchData);
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

async function analyzeContactLoss(companyId) {
  console.log('\n=== ANALYZING CONTACT LOSS ===');
  console.log(`Investigating why contacts are missing for company ${companyId}`);
  
  // This would require adding a debug endpoint to check database state
  // For now, log what we know
  console.log('Possible causes:');
  console.log('1. Contacts not being created during search');
  console.log('2. Contacts being deleted during list save process');
  console.log('3. Database response format issues');
  console.log('4. Race conditions in contact creation');
}

async function testListLoading(listId) {
  console.log(`Simulating user clicking on saved search ${listId}...`);
  
  try {
    // This simulates the handleLoadSavedSearch function
    const companiesResponse = await fetch(`${BASE_URL}/api/lists/${listId}/companies`, {
      headers: { 'Authorization': 'Bearer debug@test.com' }
    });
    
    if (companiesResponse.ok) {
      const companies = await companiesResponse.json();
      console.log(`✅ Loaded ${companies.length} companies from list`);
      
      if (companies.length > 0) {
        // Fetch contacts for each company (as in handleLoadSavedSearch)
        const companiesWithContacts = [];
        let totalContacts = 0;
        
        for (const company of companies) {
          const contactsResponse = await fetch(`${BASE_URL}/api/companies/${company.id}/contacts`, {
            headers: { 'Authorization': 'Bearer debug@test.com' }
          });
          
          if (contactsResponse.ok) {
            const contacts = await contactsResponse.json();
            companiesWithContacts.push({ ...company, contacts });
            totalContacts += contacts.length;
            console.log(`  ${company.name}: ${contacts.length} contacts`);
          } else {
            console.log(`  ${company.name}: Failed to load contacts`);
            companiesWithContacts.push({ ...company, contacts: [] });
          }
        }
        
        console.log(`✅ Total contacts loaded: ${totalContacts}`);
        
        if (totalContacts > 0) {
          console.log('✅ LIST LOADING SUCCESSFUL - Full chain working!');
        } else {
          console.log('❌ LIST LOADING FAILED - No contacts retrieved');
        }
      }
    } else {
      console.log(`❌ Failed to load companies from list: ${companiesResponse.status}`);
    }
  } catch (error) {
    console.log('❌ List loading test failed:', error.message);
  }
}

fixContactPersistence().catch(console.error);