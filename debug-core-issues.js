import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function debugCoreIssues() {
  console.log('=== DEBUGGING CORE ISSUES ===\n');
  
  // Test 1: List API Response Format
  console.log('1. TESTING LIST API RESPONSE FORMAT:');
  try {
    const response = await fetch(`${BASE_URL}/api/lists`, {
      headers: { 'Authorization': 'Bearer debug@test.com' }
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Raw response:', text.substring(0, 200) + '...');
    
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', json);
      console.log('Type of response:', typeof json);
      console.log('Array check:', Array.isArray(json));
    } catch (e) {
      console.log('JSON parse error:', e.message);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  // Test 2: Direct Database Inspection via API
  console.log('\n2. TESTING DATABASE INSPECTION:');
  try {
    const response = await fetch(`${BASE_URL}/api/debug/database`, {
      headers: { 'Authorization': 'Bearer debug@test.com' }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Database debug data:', data);
    } else {
      console.log('Debug endpoint not available, status:', response.status);
    }
  } catch (error) {
    console.log('Debug endpoint error:', error.message);
  }
  
  // Test 3: Search API Response Format
  console.log('\n3. TESTING SEARCH API RESPONSE:');
  try {
    const response = await fetch(`${BASE_URL}/api/search/quick`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer debug@test.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'test companies',
        searchType: 'companies'
      })
    });
    
    console.log('Search status:', response.status);
    console.log('Search headers:', Object.fromEntries(response.headers));
    
    const text = await response.text();
    console.log('Search raw response:', text.substring(0, 200) + '...');
    
    try {
      const json = JSON.parse(text);
      console.log('Search response structure:', {
        companies: json.companies?.length || 0,
        query: json.query,
        firstCompany: json.companies?.[0]?.name || 'none'
      });
    } catch (e) {
      console.log('Search JSON parse error:', e.message);
    }
  } catch (error) {
    console.log('❌ Search request failed:', error.message);
  }
}

debugCoreIssues().catch(console.error);