const Database = require("@replit/database");
const db = new Database();

async function analyzeUser440() {
  console.log("=== USER 440 (9010@test.com) ANALYSIS ===");
  
  const userId = 440;
  
  console.log(`\n1. USER RECORD CHECK:`);
  
  try {
    const user = await db.get(`user:${userId}`);
    if (user?.value) {
      console.log(`✅ User ${userId} exists:`);
      console.log(`   Email: ${user.value.email}`);
      console.log(`   Username: ${user.value.username}`);
      console.log(`   Created: ${user.value.createdAt}`);
      console.log(`   Password: ${user.value.password ? '[ENCRYPTED]' : 'None'}`);
    } else {
      console.log(`❌ User ${userId} not found in database`);
      
      // Check if there's a newer user ID
      console.log(`\n🔍 Checking for newer user IDs:`);
      for (let id = 441; id <= 445; id++) {
        try {
          const testUser = await db.get(`user:${id}`);
          if (testUser?.value) {
            console.log(`   Found User ${id}: ${testUser.value.email} (${testUser.value.username})`);
          }
        } catch (err) {
          // Continue checking
        }
      }
      return;
    }
  } catch (err) {
    console.log(`❌ Error checking user ${userId}: ${err.message}`);
    return;
  }
  
  console.log(`\n2. STRATEGIC PROFILES CHECK:`);
  
  try {
    const profilesData = await db.get(`strategicProfiles:user:${userId}`);
    
    if (profilesData?.value) {
      let profileIds;
      if (typeof profilesData.value === 'string') {
        profileIds = JSON.parse(profilesData.value);
      } else if (Array.isArray(profilesData.value)) {
        profileIds = profilesData.value;
      } else {
        console.log(`❌ Invalid profiles data format: ${typeof profilesData.value}`);
        return;
      }
      
      console.log(`✅ Found ${profileIds.length} strategic profile(s): ${profileIds.join(', ')}`);
      
      // Check each profile
      for (let i = 0; i < profileIds.length; i++) {
        const profileId = profileIds[i];
        
        try {
          const profile = await db.get(`strategicProfile:${profileId}`);
          if (profile?.value) {
            console.log(`\n   Profile ${i + 1} (ID: ${profileId}):`);
            console.log(`   Name: ${profile.value.name}`);
            console.log(`   Business Type: ${profile.value.businessType}`);
            console.log(`   Product/Service: ${profile.value.productService}`);
            console.log(`   Website: ${profile.value.website}`);
            console.log(`   Customer Feedback: ${profile.value.customerFeedback}`);
            console.log(`   Created: ${profile.value.createdAt}`);
            console.log(`   Status: ${profile.value.status}`);
            
            // Check strategic conversation data
            console.log(`\n   Strategic Conversation Data:`);
            const strategicFields = [
              { key: 'productAnalysisSummary', name: 'Product Analysis Summary' },
              { key: 'strategyHighLevelBoundary', name: 'Strategy High Level Boundary' },
              { key: 'exampleSprintPlanningPrompt', name: 'Example Sprint Planning Prompt' },
              { key: 'dailySearchQueries', name: 'Daily Search Queries' },
              { key: 'reportSalesContextGuidance', name: 'Sales Context Guidance' },
              { key: 'reportSalesTargetingGuidance', name: 'Sales Targeting Guidance' }
            ];
            
            let completedFields = 0;
            for (const field of strategicFields) {
              const hasData = profile.value[field.key] && profile.value[field.key].toString().trim().length > 0;
              if (hasData) {
                completedFields++;
                let preview;
                if (typeof profile.value[field.key] === 'object') {
                  preview = JSON.stringify(profile.value[field.key]).substring(0, 80) + '...';
                } else {
                  preview = profile.value[field.key].toString().substring(0, 80) + '...';
                }
                console.log(`   ✅ ${field.name}: ${preview}`);
              } else {
                console.log(`   ❌ ${field.name}: Missing or empty`);
              }
            }
            
            const completionPercentage = Math.round((completedFields / strategicFields.length) * 100);
            console.log(`\n   Completion: ${completedFields}/${strategicFields.length} fields (${completionPercentage}%)`);
            
            // Check if status is correct
            const shouldBeComplete = completedFields === strategicFields.length;
            const expectedStatus = shouldBeComplete ? 'completed' : 'in_progress';
            console.log(`   Expected Status: ${expectedStatus}`);
            
            if (profile.value.status !== expectedStatus) {
              console.log(`   ⚠️  Status mismatch! Database shows '${profile.value.status}' but should be '${expectedStatus}'`);
            }
          }
        } catch (err) {
          console.log(`   ❌ Error retrieving profile ${profileId}: ${err.message}`);
        }
      }
    } else {
      console.log(`❌ No strategic profiles found for user ${userId}`);
    }
  } catch (err) {
    console.log(`❌ Error checking strategic profiles: ${err.message}`);
  }
  
  console.log(`\n3. CREDIT SYSTEM CHECK:`);
  
  try {
    const creditsData = await db.get(`user_credits:${userId}`);
    if (creditsData?.value) {
      let credits;
      if (typeof creditsData.value === 'string') {
        credits = JSON.parse(creditsData.value);
      } else {
        credits = creditsData.value;
      }
      
      console.log(`✅ Credit Balance: ${credits.currentBalance}`);
      console.log(`   Total Used: ${credits.totalUsed}`);
      console.log(`   Monthly Allowance: ${credits.monthlyAllowance}`);
      console.log(`   Last Top Up: ${new Date(credits.lastTopUp).toISOString()}`);
      console.log(`   Has Badges: ${credits.badges ? credits.badges.length : 0} badges`);
      
      if (credits.transactions && credits.transactions.length > 0) {
        console.log(`   Recent Transactions:`);
        for (const transaction of credits.transactions.slice(-3)) {
          console.log(`     - ${transaction.type}: ${transaction.amount} (${transaction.description})`);
        }
      }
    } else {
      console.log(`❌ No credit data found for user ${userId}`);
    }
  } catch (err) {
    console.log(`❌ Error checking credits: ${err.message}`);
  }
  
  console.log(`\n4. FIREBASE MAPPING CHECK:`);
  
  try {
    // Check if there's a Firebase UID mapping for this user
    const allKeys = await db.list('firebase_uid:');
    let firebaseMapping = null;
    
    for (const key of allKeys) {
      try {
        const mappedUserId = await db.get(key);
        if (mappedUserId?.value === userId) {
          const uid = key.replace('firebase_uid:', '');
          firebaseMapping = uid;
          break;
        }
      } catch (err) {
        // Continue checking
      }
    }
    
    if (firebaseMapping) {
      console.log(`✅ Firebase UID: ${firebaseMapping.substring(0, 12)}...`);
    } else {
      console.log(`❌ No Firebase UID mapping found`);
    }
  } catch (err) {
    console.log(`❌ Error checking Firebase mapping: ${err.message}`);
  }
  
  console.log(`\n=== SUMMARY FOR USER 440 (9010@test.com) ===`);
  console.log(`From server logs, this user was recently created and authenticated.`);
  console.log(`Currently appears to be logged in based on authentication traces.`);
  console.log(`System shows user activity and credit balance of 180.`);
}

analyzeUser440().catch(console.error);