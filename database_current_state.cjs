const Database = require("@replit/database");
const db = new Database();

async function checkCurrentDatabaseState() {
  console.log("=== CURRENT DATABASE STATE ANALYSIS ===");
  
  // Check all users in the database
  console.log("\n1. SCANNING ALL USERS IN DATABASE:");
  
  try {
    const userKeys = await db.list("user:");
    console.log(`Found ${userKeys.length} user keys`);
    
    const users = [];
    for (const key of userKeys) {
      try {
        const user = await db.get(key);
        if (user?.value) {
          users.push({
            id: user.value.id,
            email: user.value.email,
            username: user.value.username,
            createdAt: user.value.createdAt
          });
        }
      } catch (err) {
        console.log(`Error reading user key ${key}: ${err.message}`);
      }
    }
    
    // Sort by ID descending to see newest first
    users.sort((a, b) => b.id - a.id);
    
    console.log("\nAll users in database:");
    for (const user of users) {
      console.log(`  User ${user.id}: ${user.email} (${user.username}) - Created: ${user.createdAt}`);
    }
    
    // Identify the most recent user
    if (users.length > 0) {
      const latestUser = users[0];
      console.log(`\n🎯 LATEST USER: ${latestUser.id} (${latestUser.email})`);
      
      // Check strategic profiles for this user
      console.log(`\n2. CHECKING STRATEGIC PROFILES FOR USER ${latestUser.id}:`);
      
      try {
        const profilesData = await db.get(`strategicProfiles:user:${latestUser.id}`);
        
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
                  'productAnalysisSummary',
                  'strategyHighLevelBoundary',
                  'exampleSprintPlanningPrompt',
                  'dailySearchQueries',
                  'reportSalesContextGuidance',
                  'reportSalesTargetingGuidance'
                ];
                
                let completedFields = 0;
                for (const field of strategicFields) {
                  const hasData = profile.value[field] && profile.value[field].trim().length > 0;
                  if (hasData) {
                    completedFields++;
                    const preview = profile.value[field].substring(0, 80) + '...';
                    console.log(`   ✅ ${field}: ${preview}`);
                  } else {
                    console.log(`   ❌ ${field}: Missing or empty`);
                  }
                }
                
                const completionPercentage = Math.round((completedFields / strategicFields.length) * 100);
                console.log(`\n   Completion Status: ${completedFields}/${strategicFields.length} fields (${completionPercentage}%)`);
                
                // Determine if this should be marked as complete
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
          console.log(`❌ No strategic profiles found for user ${latestUser.id}`);
        }
      } catch (err) {
        console.log(`❌ Error checking strategic profiles: ${err.message}`);
      }
    } else {
      console.log("❌ No users found in database");
    }
  } catch (err) {
    console.log(`❌ Error scanning users: ${err.message}`);
  }
  
  console.log("\n=== SYSTEM HEALTH STATUS ===");
  
  // Check if there are any issues to report
  const issues = [];
  const successes = [];
  
  if (users.length > 0) {
    successes.push(`✅ User system working: ${users.length} users in database`);
    
    // Check the most recent user
    const latestUser = users[0];
    if (latestUser.id >= 440) {
      successes.push(`✅ Latest user creation successful: User ${latestUser.id} (${latestUser.email})`);
    }
  } else {
    issues.push(`❌ No users found in database`);
  }
  
  console.log("\nSuccesses:");
  for (const success of successes) {
    console.log(success);
  }
  
  if (issues.length > 0) {
    console.log("\nIssues to address:");
    for (const issue of issues) {
      console.log(issue);
    }
  } else {
    console.log("\nNo critical issues detected.");
  }
}

checkCurrentDatabaseState().catch(console.error);