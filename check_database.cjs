const Database = require('@replit/database');

async function checkDatabase() {
  try {
    const db = new Database();
    
    // Check all strategic profile keys
    const keysResponse = await db.list('strategic_profiles:');
    console.log('Strategic profile keys raw response:', keysResponse);
    
    // Handle wrapped response format
    let keys = [];
    if (keysResponse && typeof keysResponse === 'object' && 'ok' in keysResponse && 'value' in keysResponse) {
      keys = keysResponse.value || [];
    } else if (Array.isArray(keysResponse)) {
      keys = keysResponse;
    }
    
    console.log('Processed keys:', keys);
    
    if (keys.length === 0) {
      console.log('No strategic profiles found');
      return;
    }
    
    // Check specific profile data
    for (const key of keys) {
      const profile = await db.get(key);
      console.log(`\nProfile ${key}:`);
      console.log('Name:', profile?.name || 'No name');
      console.log('Product Service:', profile?.productService || 'No product service');
      console.log('Created At:', profile?.createdAt || 'No creation date');
      
      // Check strategic conversation data
      console.log('\nStrategic Data:');
      console.log('Product Analysis Summary:', profile?.productAnalysisSummary ? 'EXISTS' : 'MISSING');
      console.log('Strategy Boundary:', profile?.strategyHighLevelBoundary ? 'EXISTS' : 'MISSING');
      console.log('Sprint Planning:', profile?.exampleSprintPlanningPrompt ? 'EXISTS' : 'MISSING');
      console.log('Daily Queries:', profile?.dailySearchQueries ? 'EXISTS' : 'MISSING');
      console.log('Sales Context:', profile?.reportSalesContextGuidance ? 'EXISTS' : 'MISSING');
      
      if (profile?.productAnalysisSummary) {
        console.log('Product Analysis Preview:', JSON.stringify(profile.productAnalysisSummary).substring(0, 200) + '...');
      }
      
      if (profile?.reportSalesContextGuidance) {
        console.log('Sales Context Preview:', JSON.stringify(profile.reportSalesContextGuidance).substring(0, 200) + '...');
      }
      
      console.log('\n' + '='.repeat(50));
    }
    
    // Check user 427 specifically (from previous logs)
    const user427Keys = keys.filter(key => key.includes('427'));
    console.log('\nUser 427 profiles:', user427Keys);
    
  } catch (error) {
    console.error('Database error:', error);
  }
}

checkDatabase();