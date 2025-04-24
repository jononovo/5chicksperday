const fs = require('fs');

// Fix the routes file
let content = fs.readFileSync('./server/routes.ts', 'utf8');

// Remove the old /api/companies/recent route implementation
const startPattern = "// Add a new endpoint to get recent companies from external providers";
const endPattern = "app.get(\"/api/companies/:id\"";

const startIdx = content.indexOf(startPattern);
if (startIdx !== -1) {
    const endIdx = content.indexOf(endPattern, startIdx);
    if (endIdx !== -1) {
        // Extract the part between the start and end patterns
        const beforePart = content.substring(0, startIdx);
        const afterPart = content.substring(endIdx);
        
        // Create the new content with the fixed routes in the correct order
        const fixedRoutePart = `
// Companies endpoints

// Add endpoint to get recent companies from external providers
// Note: Place specific routes BEFORE parameterized routes
app.get("/api/companies/recent", async (_req, res) => {
  try {
    // Fetch all companies
    const companies = await storage.listCompanies();
    console.log(\`Found \${companies.length} companies, returning the most recent 10\`);
    
    // Return an empty array if no companies found
    if (!companies || companies.length === 0) {
      return res.json([]);
    }
    
    // Sort by most recently created and limit to 10
    const recentCompanies = companies
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 10);
    
    // Return the companies without attempting to fetch contacts
    res.json(recentCompanies);
  } catch (error) {
    console.error("Error fetching recent companies:", error);
    res.status(500).json({ message: "Failed to fetch recent companies" });
  }
});

// Get all companies
app.get("/api/companies", async (_req, res) => {
  const companies = await storage.listCompanies();
  res.json(companies);
});

`;
        
        // Combine the parts
        content = beforePart + fixedRoutePart + afterPart;
        
        // Write the updated content back to the file
        fs.writeFileSync('./server/routes.ts', content, 'utf8');
        console.log('Successfully fixed the routes file');
    } else {
        console.error('Could not find the end pattern in the file');
    }
} else {
    console.error('Could not find the start pattern in the file');
}
