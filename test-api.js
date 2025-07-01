import fetch from 'node-fetch';

async function testAPI() {
  try {
    const response = await fetch('https://3223af30-a19b-47c5-ab14-a698c118cd66-00-38xs4kvuqdka9.janeway.replit.dev/api/companies', {
      headers: {
        'Authorization': 'Bearer 2017@test.com'
      }
    });
    
    const data = await response.json();
    console.log('Companies data:', JSON.stringify(data, null, 2));
    
    // Check for duplicates
    const ids = data.map(company => company.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    console.log('Duplicate IDs found:', duplicates);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();