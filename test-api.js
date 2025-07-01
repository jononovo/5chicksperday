import fetch from 'node-fetch';

async function testAPI() {
  try {
    // First, create a test list
    console.log('Creating test list...');
    const createResponse = await fetch('https://3223af30-a19b-47c5-ab14-a698c118cd66-00-38xs4kvuqdka9.janeway.replit.dev/api/lists', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 2017@test.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        companies: [
          { id: 34426900, name: 'Test Company 1' },
          { id: 34426901, name: 'Test Company 2' }
        ],
        prompt: 'Test search query for list creation'
      })
    });
    
    const createData = await createResponse.json();
    console.log('Created list:', JSON.stringify(createData, null, 2));

    // Then fetch all lists
    console.log('\nFetching all lists...');
    const listResponse = await fetch('https://3223af30-a19b-47c5-ab14-a698c118cd66-00-38xs4kvuqdka9.janeway.replit.dev/api/lists', {
      headers: {
        'Authorization': 'Bearer 2017@test.com'
      }
    });
    
    const listData = await listResponse.json();
    console.log('Lists data:', JSON.stringify(listData, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();