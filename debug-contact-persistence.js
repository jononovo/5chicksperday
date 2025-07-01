import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const AUTH_HEADER = { 'Authorization': 'Bearer debug@test.com' };

async function debugContactPersistence() {
  console.log('=== CONTACT PERSISTENCE DEBUG ===\n');
  
  try {
    // 1. Check if there are any existing lists
    console.log('1. CHECKING EXISTING LISTS:');
    const listsResponse = await fetch(`${BASE_URL}/api/lists`, {
      headers: AUTH_HEADER
    });
    const lists = await listsResponse.json();
    console.log(`Found ${lists.length} lists`);
    
    if (lists.length > 0) {
      const firstList = lists[0];
      console.log(`Using list: ${firstList.prompt} (ID: ${firstList.listId})`);
      
      // 2. Check companies for this list
      console.log('\n2. CHECKING COMPANIES FOR LIST:');
      const companiesResponse = await fetch(`${BASE_URL}/api/lists/${firstList.listId}/companies`, {
        headers: AUTH_HEADER
      });
      
      if (companiesResponse.ok) {
        const companies = await companiesResponse.json();
        console.log(`Found ${companies.length} companies for list ${firstList.listId}`);
        
        if (companies.length > 0) {
          const firstCompany = companies[0];
          console.log(`Checking company: ${firstCompany.name} (ID: ${firstCompany.id})`);
          
          // 3. Check contacts for this company
          console.log('\n3. CHECKING CONTACTS FOR COMPANY:');
          const contactsResponse = await fetch(`${BASE_URL}/api/companies/${firstCompany.id}/contacts`, {
            headers: AUTH_HEADER
          });
          
          if (contactsResponse.ok) {
            const contacts = await contactsResponse.json();
            console.log(`Found ${contacts.length} contacts for company ${firstCompany.id}`);
            
            if (contacts.length > 0) {
              console.log('Sample contacts:');
              contacts.slice(0, 3).forEach((contact, i) => {
                console.log(`  ${i+1}. ${contact.name} - ${contact.role || 'No role'} - ${contact.email || 'No email'}`);
              });
            } else {
              console.log('❌ NO CONTACTS FOUND FOR COMPANY!');
            }
          } else {
            console.log(`❌ Failed to fetch contacts: ${contactsResponse.status} ${contactsResponse.statusText}`);
            const errorText = await contactsResponse.text();
            console.log('Error:', errorText);
          }
        } else {
          console.log('❌ NO COMPANIES FOUND FOR LIST!');
        }
      } else {
        console.log(`❌ Failed to fetch companies: ${companiesResponse.status} ${companiesResponse.statusText}`);
        const errorText = await companiesResponse.text();
        console.log('Error:', errorText);
      }
    } else {
      console.log('❌ NO LISTS FOUND - Need to create some data first');
      
      // Create test data
      console.log('\n4. CREATING TEST DATA:');
      await createTestData();
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

async function createTestData() {
  console.log('Creating test search with companies and contacts...');
  
  // Simulate a search that creates companies with contacts
  const searchResponse = await fetch(`${BASE_URL}/api/search/quick`, {
    method: 'POST',
    headers: {
      ...AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'AI startups in Boston',
      searchType: 'contacts'
    })
  });
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    console.log(`Search created ${searchData.companies?.length || 0} companies`);
    
    // Check if contacts were created
    if (searchData.companies && searchData.companies.length > 0) {
      const firstCompany = searchData.companies[0];
      console.log(`First company: ${firstCompany.name} with ${firstCompany.contacts?.length || 0} contacts`);
      
      if (firstCompany.contacts && firstCompany.contacts.length > 0) {
        console.log('Sample contacts from search:');
        firstCompany.contacts.slice(0, 3).forEach((contact, i) => {
          console.log(`  ${i+1}. ${contact.name} - ${contact.role || 'No role'}`);
        });
        
        // Now save this as a list
        console.log('\n5. SAVING AS LIST:');
        const saveResponse = await fetch(`${BASE_URL}/api/lists`, {
          method: 'POST',
          headers: {
            ...AUTH_HEADER,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companies: searchData.companies,
            prompt: 'AI startups in Boston',
            contactSearchConfig: {}
          })
        });
        
        if (saveResponse.ok) {
          const savedList = await saveResponse.json();
          console.log(`✅ List saved with ID: ${savedList.listId}`);
          
          // Now test loading this list
          console.log('\n6. TESTING LIST LOADING:');
          await testListLoading(savedList.listId);
        } else {
          console.log(`❌ Failed to save list: ${saveResponse.status}`);
          const errorText = await saveResponse.text();
          console.log('Error:', errorText);
        }
      } else {
        console.log('❌ NO CONTACTS CREATED DURING SEARCH!');
      }
    }
  } else {
    console.log(`❌ Search failed: ${searchResponse.status}`);
    const errorText = await searchResponse.text();
    console.log('Error:', errorText);
  }
}

async function testListLoading(listId) {
  console.log(`Testing loading of list ${listId}...`);
  
  // Fetch companies for the list
  const companiesResponse = await fetch(`${BASE_URL}/api/lists/${listId}/companies`, {
    headers: AUTH_HEADER
  });
  
  if (companiesResponse.ok) {
    const companies = await companiesResponse.json();
    console.log(`✅ Loaded ${companies.length} companies from list`);
    
    if (companies.length > 0) {
      // Check contacts for first company
      const firstCompany = companies[0];
      const contactsResponse = await fetch(`${BASE_URL}/api/companies/${firstCompany.id}/contacts`, {
        headers: AUTH_HEADER
      });
      
      if (contactsResponse.ok) {
        const contacts = await contactsResponse.json();
        console.log(`✅ Loaded ${contacts.length} contacts for company ${firstCompany.name}`);
        
        if (contacts.length > 0) {
          console.log('✅ FULL CHAIN WORKING: List → Companies → Contacts');
        } else {
          console.log('❌ CONTACTS MISSING AFTER LIST SAVE!');
        }
      } else {
        console.log(`❌ Failed to load contacts: ${contactsResponse.status}`);
      }
    }
  } else {
    console.log(`❌ Failed to load companies from list: ${companiesResponse.status}`);
  }
}

debugContactPersistence().catch(console.error);