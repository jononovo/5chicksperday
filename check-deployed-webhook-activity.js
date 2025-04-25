/**
 * Script to check the deployed application for webhook activity and new companies
 * This will help monitor if Rabbit's webhooks are reaching your system after deployment
 */
import fetch from 'node-fetch';

const DEPLOYED_URL = 'https://bear-app.replit.app';
const CHECK_INTERVAL = 10000; // Check every 10 seconds
const MAX_CHECKS = 20; // Check for up to ~3 minutes

async function checkDeployedWebhookActivity() {
  console.log('=== MONITORING DEPLOYED APP FOR WEBHOOK ACTIVITY ===');
  console.log(`Checking ${DEPLOYED_URL} for webhook activity and new companies`);
  console.log(`Will check every ${CHECK_INTERVAL/1000} seconds, up to ${MAX_CHECKS} times`);
  console.log('Press Ctrl+C to stop monitoring');
  console.log('');
  
  let initialCompanies = [];
  let initialWebhookCount = 0;
  
  try {
    // Get initial state
    console.log('Getting initial state...');
    const companiesResponse = await fetch(`${DEPLOYED_URL}/api/companies/recent`);
    initialCompanies = await companiesResponse.json();
    console.log(`Initial company count: ${initialCompanies.length}`);
    
    // Get initial webhook count
    const webhookStatsResponse = await fetch(`${DEPLOYED_URL}/api/monitor/webhook-stats`);
    const webhookStats = await webhookStatsResponse.json();
    initialWebhookCount = webhookStats.totalLogs || 0;
    console.log(`Initial webhook count: ${initialWebhookCount}`);
    
    // Show baseline info
    console.log('\nBaseline information:');
    console.log('Most recent companies:');
    initialCompanies.slice(0, 3).forEach(company => {
      console.log(`- ${company.name} (ID: ${company.id})`);
    });
    
    console.log('\nStarting monitoring loop...');
  } catch (error) {
    console.error('Error getting initial state:', error.message);
    console.log('Make sure the deployed app is accessible');
    return;
  }

  let checkCount = 0;
  
  const checkInterval = setInterval(async () => {
    checkCount++;
    console.log(`\n--- Check #${checkCount} at ${new Date().toISOString()} ---`);
    
    try {
      // Check for new companies
      const companiesResponse = await fetch(`${DEPLOYED_URL}/api/companies/recent`);
      const companies = await companiesResponse.json();
      
      // Check for new webhooks
      const webhookStatsResponse = await fetch(`${DEPLOYED_URL}/api/monitor/webhook-stats`);
      const webhookStats = await webhookStatsResponse.json();
      const currentWebhookCount = webhookStats.totalLogs || 0;
      
      // Calculate changes
      const newWebhookCount = currentWebhookCount - initialWebhookCount;
      
      // Check for new companies by ID
      const newCompanies = companies.filter(company => 
        !initialCompanies.some(initialCompany => initialCompany.id === company.id)
      );
      
      // Report findings
      if (newWebhookCount > 0) {
        console.log('✅ NEW WEBHOOK ACTIVITY DETECTED!');
        console.log(`   ${newWebhookCount} new webhook(s) received`);
        
        // Get webhook logs
        const logsResponse = await fetch(`${DEPLOYED_URL}/api/monitor/webhook-logs?limit=5`);
        const logsData = await logsResponse.json();
        
        if (logsData.logs && logsData.logs.length > 0) {
          console.log('\nRecent webhook logs:');
          logsData.logs.forEach(log => {
            console.log(`- ${log.timestamp} - ${log.requestId}`);
          });
          
          // Get details of the most recent log
          if (logsData.logs[0] && logsData.logs[0].requestId) {
            const logDetailResponse = await fetch(`${DEPLOYED_URL}/api/monitor/webhook-logs/${logsData.logs[0].requestId}`);
            const logDetail = await logDetailResponse.json();
            
            if (logDetail.log) {
              console.log('\nMost recent webhook details:');
              console.log(`SearchID: ${logDetail.log.searchId || 'unknown'}`);
              console.log(`Method: ${logDetail.log.method} to ${logDetail.log.url}`);
              console.log(`IP: ${logDetail.log.ip}`);
              console.log(`Timestamp: ${logDetail.log.timestamp}`);
            }
          }
        }
      } else {
        console.log('No new webhook activity detected');
      }
      
      if (newCompanies.length > 0) {
        console.log('\n✅ NEW COMPANIES DETECTED!');
        console.log(`   ${newCompanies.length} new companies found:`);
        newCompanies.forEach(company => {
          console.log(`- ${company.name} (ID: ${company.id})`);
          console.log(`  Industry: ${company.industry || 'N/A'}`);
          console.log(`  Location: ${company.location || 'N/A'}`);
        });
      } else {
        console.log('No new companies detected');
      }
      
      // Check dashboard overview
      try {
        const dashboardResponse = await fetch(`${DEPLOYED_URL}/api/monitor/dashboard`);
        const dashboardData = await dashboardResponse.json();
        
        console.log('\nDashboard Overview:');
        console.log(`Total logs: ${dashboardData.totalLogs}`);
        console.log(`Unique URLs: ${dashboardData.uniqueUrls?.length || 0}`);
        console.log(`Recent activity: ${dashboardData.recentLogs?.length || 0} recent requests`);
      } catch (dashError) {
        console.log('Could not fetch dashboard data');
      }
      
      // If we've found activity, mention the webhook status endpoint
      if (newWebhookCount > 0 || newCompanies.length > 0) {
        console.log('\nFor more details, check:');
        console.log(`${DEPLOYED_URL}/api/debug/webhook-status`);
      }
      
    } catch (error) {
      console.error('Error checking for updates:', error.message);
    }
    
    // Stop after MAX_CHECKS
    if (checkCount >= MAX_CHECKS) {
      clearInterval(checkInterval);
      console.log('\n=== MONITORING COMPLETE ===');
      console.log('Reached maximum number of checks');
      console.log('To continue monitoring, run the script again');
    }
  }, CHECK_INTERVAL);
}

// Start the monitoring
checkDeployedWebhookActivity();