const fs = require('fs');

// Read the file
const routesFile = fs.readFileSync('server/routes.ts', 'utf8');

// Replace the contact search endpoints
const updatedRoutesFile = routesFile.replace(
  /app\.post\("\/api\/contacts\/search", requireAuth, async \(req, res\) => \{\s+const \{ name, company \} = req\.body;\s+if \(!name \|\| !company\) \{\s+res\.status\(400\)\.json\({\s+message: "Both name and company are required"\s+}\);\s+return;\s+}\s+try \{\s+const contactDetails = await searchContactDetails\(name, company\);/g,
  `app.post("/api/contacts/search", requireAuth, async (req, res) => {
    const { name, company, options } = req.body;

    if (!name || !company) {
      res.status(400).json({
        message: "Both name and company are required"
      });
      return;
    }
    
    // Log search options if provided
    if (options) {
      console.log('Contact search options received:', options);
    }

    try {
      const contactDetails = await searchContactDetails(name, company, options);`
);

// Write the file back
fs.writeFileSync('server/routes.ts', updatedRoutesFile, 'utf8');

console.log('Successfully updated routes.ts');