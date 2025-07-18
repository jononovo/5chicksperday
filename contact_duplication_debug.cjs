const Database = require("@replit/database");
const db = new Database();

async function investigateContactDuplication() {
  console.log("🔍 CONTACT DUPLICATION INVESTIGATION");
  console.log("=" .repeat(50));
  
  try {
    // Get all keys
    const allKeysResponse = await db.list();
    console.log(`📊 Raw keys response:`, allKeysResponse);
    
    // Handle different response formats
    let allKeys = [];
    if (Array.isArray(allKeysResponse)) {
      allKeys = allKeysResponse;
    } else if (allKeysResponse && typeof allKeysResponse === 'object') {
      // Handle wrapped response format
      if (allKeysResponse.ok && Array.isArray(allKeysResponse.value)) {
        allKeys = allKeysResponse.value;
      } else {
        allKeys = Object.keys(allKeysResponse);
      }
    }
    
    console.log(`📊 Total keys in database: ${allKeys.length}`);
    
    // Filter company and contact keys
    const companyKeys = allKeys.filter(key => key.startsWith('company:'));
    const contactKeys = allKeys.filter(key => key.startsWith('contact:'));
    
    console.log(`📦 Companies: ${companyKeys.length}`);
    console.log(`👥 Contacts: ${contactKeys.length}`);
    
    // Analyze companies
    console.log("\n🔬 COMPANY ANALYSIS:");
    for (const key of companyKeys.slice(0, 10)) {
      const company = await db.get(key);
      if (company) {
        console.log(`  ${key}: "${company.name}" (ID: ${company.id})`);
      }
    }
    
    // Analyze contacts
    console.log("\n🔬 CONTACT ANALYSIS:");
    const contactIds = new Set();
    const contactData = [];
    
    for (const key of contactKeys) {
      const rawContact = await db.get(key);
      console.log(`\n📋 Raw contact data for ${key}:`, rawContact);
      
      // Handle wrapped response format
      let contact = rawContact;
      if (rawContact && typeof rawContact === 'object' && rawContact.ok && rawContact.value) {
        contact = rawContact.value;
        // If value is a string, try to parse it
        if (typeof contact === 'string') {
          try {
            contact = JSON.parse(contact);
          } catch (e) {
            console.log(`❌ Failed to parse JSON for ${key}:`, e.message);
          }
        }
      }
      
      if (contact) {
        contactIds.add(contact.id);
        contactData.push({
          key,
          id: contact.id,
          name: contact.name,
          companyId: contact.companyId,
          email: contact.email
        });
      }
    }
    
    console.log(`\n📊 CONTACT STATISTICS:`);
    console.log(`Total contacts: ${contactData.length}`);
    console.log(`Unique contact IDs: ${contactIds.size}`);
    console.log(`Contact IDs: [${Array.from(contactIds).join(', ')}]`);
    
    if (contactIds.size === 1) {
      console.log("❌ PROBLEM IDENTIFIED: All contacts have the same ID!");
      console.log("This causes all companies to display the same contacts.");
    }
    
    // Show first 10 contacts
    console.log("\n📋 FIRST 10 CONTACTS:");
    contactData.slice(0, 10).forEach(contact => {
      console.log(`  ${contact.key}: "${contact.name}" (ID: ${contact.id}, Company: ${contact.companyId})`);
    });
    
    // Check if all contacts belong to the same company
    const companyIds = new Set(contactData.map(c => c.companyId));
    console.log(`\n📊 Company IDs referenced by contacts: [${Array.from(companyIds).join(', ')}]`);
    
    if (companyIds.size === 1) {
      console.log("❌ ADDITIONAL PROBLEM: All contacts reference the same company ID!");
    }
    
    // Show contact names to check for duplicates
    const contactNames = contactData.map(c => c.name);
    const uniqueNames = new Set(contactNames);
    console.log(`\n📊 CONTACT NAMES:`);
    console.log(`Total contact names: ${contactNames.length}`);
    console.log(`Unique contact names: ${uniqueNames.size}`);
    
    if (uniqueNames.size < contactNames.length) {
      console.log("❌ DUPLICATE NAMES FOUND!");
      console.log("Unique names:", Array.from(uniqueNames));
    }
    
  } catch (error) {
    console.error("❌ Error investigating contacts:", error);
  }
}

investigateContactDuplication();