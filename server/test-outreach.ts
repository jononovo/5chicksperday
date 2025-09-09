// Test script for the outreach system
import { db } from './db';
import { users, contacts, companies, strategicProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { outreachService } from './features/outreach/services/outreach.service';
import { batchGeneratorService } from './features/outreach/services/batch-generator.service';
import { sendGridService } from './services/sendgrid.service';

async function testOutreachSystem() {
  console.log('Testing Outreach System...\n');

  try {
    // 1. Test user preferences
    console.log('1. Testing user preferences...');
    const userId = 1; // Demo user
    
    // Set up preferences
    const preferences = await outreachService.updateUserPreferences(userId, {
      enabled: true,
      schedule: { days: ['mon', 'tue', 'wed'], time: '09:00' },
      timezone: 'America/New_York',
      emailsPerBatch: 5,
      includeSearchPrompts: true,
      sendUrgentReminders: true
    });
    console.log('✓ User preferences saved:', preferences);
    
    // 2. Check available contacts
    console.log('\n2. Checking available contacts...');
    const availableContacts = await outreachService.getAvailableContacts(userId, 5);
    console.log(`✓ Found ${availableContacts.contacts.length} available contacts`);
    console.log(`  Total available: ${availableContacts.totalAvailable}`);
    console.log(`  Needs more contacts: ${availableContacts.needsMoreContacts}`);
    
    if (availableContacts.contacts.length > 0) {
      console.log('  Sample contacts:');
      availableContacts.contacts.slice(0, 3).forEach(c => {
        console.log(`    - ${c.name} at ${c.companyName} (${c.email})`);
      });
    }
    
    // 3. Generate emails for contacts
    if (availableContacts.contacts.length > 0) {
      console.log('\n3. Generating personalized emails...');
      const contactIds = availableContacts.contacts.map(c => c.id).slice(0, 3);
      const emails = await batchGeneratorService.generateEmails(userId, contactIds);
      console.log(`✓ Generated ${emails.length} personalized emails`);
      
      if (emails.length > 0) {
        console.log('\n  Sample email:');
        console.log(`    To: ${emails[0].recipientName} <${emails[0].recipientEmail}>`);
        console.log(`    Subject: ${emails[0].subject}`);
        console.log(`    Preview: ${emails[0].content.substring(0, 100)}...`);
      }
      
      // 4. Create outreach batch
      console.log('\n4. Creating outreach batch...');
      const token = await outreachService.createOutreachBatch({
        userId,
        contactIds,
        emails,
        scheduledFor: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      console.log(`✓ Created batch with token: ${token}`);
      
      // 5. Generate public URL
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      const publicUrl = `${baseUrl}/outreach/${token}`;
      console.log(`✓ Public URL for email editing: ${publicUrl}`);
      
      // 6. Test SendGrid integration (send test email)
      console.log('\n5. Testing SendGrid integration...');
      const testEmailSent = await sendGridService.sendTestEmail('test@example.com');
      if (testEmailSent) {
        console.log('✓ SendGrid test email sent successfully');
      } else {
        console.log('⚠ SendGrid test failed - check API key configuration');
      }
    } else {
      console.log('\n⚠ No contacts available for testing. Please add some contacts first.');
    }
    
    console.log('\n✅ Outreach system test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
  
  process.exit(0);
}

// Run the test
testOutreachSystem();