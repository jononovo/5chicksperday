import fetch from 'node-fetch';

async function testAPI() {
  try {
    // Test saved searches/lists API
    const response = await fetch('https://3223af30-a19b-47c5-ab14-a698c118cd66-00-38xs4kvuqdka9.janeway.replit.dev/api/lists', {
      headers: {
        'Authorization': 'Bearer 2017@test.com'
      }
    });
    
    const data = await response.json();
    console.log('Lists data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();