# Strategic Onboarding Flow Deep Analysis
**Complete Flow Mapping from Landing Page to Final Report**
**Date:** 2025-06-05

## Overview
The strategic onboarding flow is a multi-phase AI-powered system that guides users through creating personalized 90-day email sales strategies. This analysis traces every file, function, and API call in the complete user journey.

## Phase 1: Landing Page Entry Points

### File: `static/landing.html`
**Location:** Lines 184-201
**Trigger Buttons:**
```html
<!-- Product Business Button -->
<button onclick="openChat('product')" class="h-24 bg-gradient-to-r from-blue-600...">
  <div class="text-2xl">📦</div>
  <span class="font-semibold">Product</span>
</button>

<!-- Service Business Button -->  
<button onclick="openChat('service')" class="h-24 bg-gradient-to-r from-purple-600...">
  <div class="text-2xl">🛠️</div>
  <span class="font-semibold">Service</span>
</button>
```

### JavaScript Initialization
**File:** `static/js/chat-overlay.js` (Lines 1-14)
```javascript
class ChatOverlay {
  constructor() {
    this.state = 'hidden';
    this.businessType = null;
    this.messages = [];
    this.isLoading = false;
    this.currentStep = 'business_description';
    this.profileData = {};
    this.isMobile = window.innerWidth < 768;
  }
}
```

**Global Function Trigger:**
```javascript
// Called when user clicks Product/Service buttons
window.openChat = function(type) {
  if (window.chatOverlay) {
    window.chatOverlay.open(type);
  }
}
```

## Phase 2: Chat Overlay Initialization

### File: `static/js/chat-overlay.js`
**Function:** `open(type)` (Lines ~1400+)
```javascript
open(type) {
  this.businessType = type;
  this.setState('form');
  this.currentStep = 1;
  this.render();
}
```

**Function:** `setState(newState)` 
```javascript
setState(newState) {
  this.state = newState;
  this.container.className = `chat-overlay-${newState}`;
  this.render();
}
```

## Phase 3: Three-Step Form Collection

### Step 1: Product/Service Description
**Template Rendered:** Form modal with product description input
```javascript
// Form step rendering logic in render() method
const formContent = this.renderFormStep();
```

**Data Collected:**
- `productService`: User's product/service description
- `businessType`: 'product' or 'service'

### Step 2: Customer Feedback/Advantage
**Data Collected:**
- `customerFeedback`: What customers like about the product

### Step 3: Website/Online Presence
**Data Collected:**
- `website`: Company website or online presence

**Form Completion Trigger:**
```javascript
// When user clicks "Start Chat" on step 3
nextStep() {
  if (this.currentStep === 3) {
    this.startChat();
  }
}
```

## Phase 4: Chat Interface Transition

### Function: `startChat()`
**File:** `static/js/chat-overlay.js`
```javascript
startChat() {
  this.setState('fullscreen');
  this.formData = {
    productService: this.profileData.productService,
    customerFeedback: this.profileData.customerFeedback,
    website: this.profileData.website
  };
  
  // Initialize conversation
  this.initializeConversation();
}
```

### Function: `initializeConversation()`
```javascript
initializeConversation() {
  const welcomeMessage = `Perfect!

**Your product is:** ${this.formData.productService}
**Customers like:** ${this.formData.customerFeedback}  
**And I can learn more at:** ${this.formData.website}

Give me 5 seconds. I'm building a product summary so I can understand what you're selling.`;

  this.addMessage(welcomeMessage, 'ai');
  
  // Trigger background research
  this.performBackgroundResearch();
}
```

## Phase 5: Background Research (Product Summary)

### API Call 1: Background Research
**Endpoint:** `POST /api/onboarding/background-research`
**File:** `server/routes.ts` (Lines ~3430+)

```javascript
// Frontend call in performBackgroundResearch()
const response = await fetch('/api/onboarding/background-research', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productService: this.formData.productService,
    website: this.formData.website
  })
});
```

**Backend Logic:**
```javascript
app.post("/api/onboarding/background-research", async (req, res) => {
  const { productService, website } = req.body;
  
  // Use Perplexity for market research
  const research = await queryPerplexity([
    { role: "user", content: `Research ${productService} at ${website}...` }
  ]);
  
  res.json({ research });
});
```

**Dependencies:**
- `server/lib/api/perplexity-client.ts` → `queryPerplexity()`
- **Environment:** `PERPLEXITY_API_KEY`

## Phase 6: Strategy Chat Conversation

### AI-Powered Conversation Flow
**Function:** `handleStrategyChatMessage(userInput)`
**API Call:** `POST /api/onboarding/strategy-chat`

```javascript
// Frontend strategy chat handler
async handleStrategyChatMessage(userInput) {
  const response = await fetch('/api/onboarding/strategy-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userInput: userInput,
      productContext: {
        productService: this.formData.productService,
        customerFeedback: this.formData.customerFeedback,
        website: this.formData.website
      },
      conversationHistory: this.messages
    })
  });
}
```

### Backend Strategy Chat Logic
**File:** `server/routes.ts` (Lines 3550-3610)

```javascript
app.post("/api/onboarding/strategy-chat", async (req, res) => {
  const { userInput, productContext, conversationHistory } = req.body;
  
  // Phase detection logic
  const messages = conversationHistory.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  
  // Add current user input
  messages.push({ role: 'user', content: userInput });
  
  // OpenAI function calling for strategy generation
  const result = await queryOpenAI(messages, productContext);
  
  res.json(result);
});
```

### OpenAI Function Calling System
**File:** `server/lib/api/openai-client.ts` (Lines 290-360)

```javascript
export async function queryOpenAI(messages, productContext) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages
    ],
    functions: [
      {
        name: "generateProductSummary",
        description: "Generate a comprehensive product summary"
      },
      {
        name: "generateEmailStrategy", 
        description: "Generate email strategy when ready"
      }
    ],
    function_call: "auto"
  });
  
  // Handle function calls
  if (completion.choices[0].message.function_call) {
    const functionName = completion.choices[0].message.function_call.name;
    const functionArgs = JSON.parse(completion.choices[0].message.function_call.arguments);
    
    return await handleFunctionCall(functionName, functionArgs, productContext);
  }
}
```

## Phase 7: Progressive Strategy Generation

### Trigger: Email Strategy Function Call
**When:** User provides refined target example
**Function:** `generateEmailStrategy()`

```javascript
async function generateEmailStrategy(params, productContext) {
  return {
    type: 'progressive_strategy',
    message: "Perfect! Now I'll create your strategic sales plan step by step.",
    initialTarget: params.initialTarget,
    refinedTarget: params.refinedTarget,
    needsProgressiveGeneration: true
  };
}
```

### Progressive Strategy Flow
**Function:** `generateProgressiveStrategy(initialTarget, refinedTarget)`
**File:** `static/js/chat-overlay.js` (Lines 1000+)

```javascript
async generateProgressiveStrategy(initialTarget, refinedTarget) {
  const productContext = {
    productService: this.formData?.productService,
    customerFeedback: this.formData?.customerFeedback,
    website: this.formData?.website
  };

  let strategyData = {};

  // Step 1: Generate Boundary Options (ENHANCED)
  // Step 2: Generate Sprint Prompt  
  // Step 3: Generate Daily Queries
}
```

## Phase 8: Interactive Boundary Generation (ENHANCED)

### API Call 2: Boundary Options Generation
**Endpoint:** `POST /api/strategy/boundary`
**File:** `server/routes.ts` (Lines 3661-3687)

```javascript
app.post("/api/strategy/boundary", async (req, res) => {
  const { initialTarget, refinedTarget, productContext } = req.body;
  
  const boundaryOptions = await generateBoundaryOptions(
    { initialTarget, refinedTarget }, 
    productContext
  );
  
  res.json({
    type: 'boundary_options',
    title: 'Strategic Boundary Options',
    message: 'Here are 3 strategic approaches. Each will target ~700 companies across 6 sprints:',
    options: boundaryOptions,
    step: 1,
    totalSteps: 4
  });
});
```

### Boundary Options Generation Logic
**File:** `server/lib/api/openai-client.ts` (Lines 52-88)

```javascript
export async function generateBoundaryOptions(params, productContext) {
  const { initialTarget, refinedTarget } = params;
  
  const perplexityPrompt = `
Create 3 different 90-day target boundaries for ${productContext.productService}:
Example Daily Search Query: ${initialTarget}
Example of Refined Daily Search Query: ${refinedTarget}

Generate exactly 3 strategic approaches that will each target ~700 companies across 6 sprints (max 10 words each):
1. Geographic focus - broader reach, location-based targeting
2. Niche focus - specific industry/product category specialization  
3. Hybrid approach - combines niche expertise with geographic concentration

Format exactly as:
1. [boundary statement]
2. [boundary statement]
3. [boundary statement]

Return only the 3 numbered options, no additional text.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a market strategy expert..." },
    { role: "user", content: perplexityPrompt }
  ]);

  // Parse options
  const options = result.split('\n')
    .filter(line => line.trim().match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
  
  return options.length === 3 ? options : [result.trim()];
}
```

### Interactive Boundary Selection Interface
**Function:** `displayBoundaryOptions(boundaryData)`
**File:** `static/js/chat-overlay.js` (Lines 1218-1289)

```javascript
displayBoundaryOptions(boundaryData) {
  return new Promise((resolve) => {
    const optionsHtml = `
      <div class="boundary-options-container...">
        <p class="font-semibold...">${boundaryData.message}</p>
        <div class="boundary-options-list...">
          ${boundaryData.options.map((option, index) => `
            <div class="boundary-option..." data-option="${option}" data-number="${index + 1}">
              <strong>${index + 1}.</strong> ${option}
            </div>
          `).join('')}
        </div>
        <div class="custom-boundary-section">
          <p>Please type in the number of the one you prefer, or just write your own below and we can use that:</p>
          <input type="text" id="boundaryUserInput" placeholder="Type 1, 2, 3, or write your custom boundary..." />
          <button id="submitBoundaryChoice">Submit Choice</button>
        </div>
      </div>`;
    
    // Add event listeners for interaction
    setTimeout(() => {
      // Click listeners for numbered options
      document.querySelectorAll('.boundary-option').forEach(option => {
        option.addEventListener('click', () => {
          const optionNumber = parseInt(option.dataset.number);
          document.getElementById('boundaryUserInput').value = optionNumber.toString();
        });
      });
      
      // Submit button and enter key handlers
      document.getElementById('submitBoundaryChoice').addEventListener('click', () => {
        const userValue = document.getElementById('boundaryUserInput').value.trim();
        if (userValue) {
          this.processBoundarySelection(userValue, boundaryData.options, resolve);
        }
      });
    }, 100);
  });
}
```

### Boundary Selection Processing
**Function:** `processBoundarySelection(userValue, options, resolve)`

```javascript
processBoundarySelection(userValue, options, resolve) {
  // Check if it's a number selection (1, 2, or 3)
  const numberMatch = userValue.match(/^[123]$/);
  
  if (numberMatch) {
    const selectedNumber = parseInt(userValue);
    resolve({ 
      selection: selectedNumber,
      customBoundary: null 
    });
  } else {
    // Custom boundary input
    resolve({ 
      selection: 'custom',
      customBoundary: userValue 
    });
  }
}
```

### API Call 3: Boundary Selection Validation
**Endpoint:** `POST /api/strategy/boundary/select`
**File:** `server/routes.ts` (Lines 3689-3746)

```javascript
app.post("/api/strategy/boundary/select", async (req, res) => {
  const { selection, customBoundary, productContext } = req.body;

  let finalBoundary;
  
  if (selection === 'custom' && customBoundary) {
    // Validate custom boundary
    const validation = await validateCustomBoundary(customBoundary, productContext);
    
    if (!validation.isValid && validation.suggestion) {
      return res.json({
        type: 'boundary_validation',
        title: 'Boundary Refinement Needed',
        message: `Your boundary might target ${validation.estimatedCompanies || 'too many/few'} companies. ${validation.suggestion}`,
        originalBoundary: customBoundary,
        suggestion: validation.suggestion
      });
    }
    
    finalBoundary = customBoundary;
  } else if (typeof selection === 'number' && selection >= 1 && selection <= 3) {
    // User selected option by number
    const options = req.body.options || [];
    finalBoundary = options[selection - 1] || selection.toString();
  }

  // Save to database if user authenticated
  if (req.user) {
    const userId = getUserId(req);
    await storage.updateStrategicProfile?.(userId, { 
      strategyHighLevelBoundary: finalBoundary
    });
  }

  res.json({
    type: 'boundary_confirmed',
    title: 'Strategic Boundary Confirmed',
    content: finalBoundary,
    message: `Perfect! Your 90-day boundary: "${finalBoundary}" will guide your campaign strategy.`,
    step: 2,
    totalSteps: 4
  });
});
```

### Custom Boundary Validation
**Function:** `validateCustomBoundary(customBoundary, productContext)`
**File:** `server/lib/api/openai-client.ts` (Lines 90-116)

```javascript
export async function validateCustomBoundary(customBoundary, productContext) {
  const perplexityPrompt = `
Validate this sales boundary for ${productContext.productService}:
Boundary: "${customBoundary}"

Assess if this boundary would yield approximately 700 companies for a 90-day campaign (6 sprints of ~115 companies each).
If too broad (>2000 companies) or too narrow (<200 companies), suggest a refinement.

Return JSON format:
{
  "isValid": boolean,
  "estimatedCompanies": number,
  "suggestion": "refinement text if needed"
}`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a market validation expert..." },
    { role: "user", content: perplexityPrompt }
  ]);

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { isValid: true };
  } catch {
    return { isValid: true };
  }
}
```

## Phase 9: Sprint Strategy Generation

### API Call 4: Sprint Prompt Generation
**Endpoint:** `POST /api/strategy/sprint`
**File:** `server/routes.ts` (Lines 3748-3778)

```javascript
app.post("/api/strategy/sprint", async (req, res) => {
  const { boundary, refinedTarget, productContext } = req.body;

  const sprintPrompt = await generateSprintPrompt(boundary, { refinedTarget }, productContext);
  
  // Save to database if user authenticated
  if (req.user) {
    const userId = getUserId(req);
    await storage.updateStrategicProfile?.(userId, { 
      exampleSprintPlanningPrompt: sprintPrompt
    });
  }

  res.json({
    type: 'sprint',
    title: 'Sprint Strategy',
    content: sprintPrompt,
    step: 3,
    totalSteps: 4
  });
});
```

### Sprint Prompt Generation Logic
**File:** `server/lib/api/openai-client.ts` (Lines 124-170)

```javascript
export async function generateSprintPrompt(boundary, params, productContext) {
  const { refinedTarget } = params;
  
  const perplexityPrompt = `
Create a comprehensive 90-day sprint planning prompt for ${productContext.productService}:
Target Boundary: ${boundary}
Example Target: ${refinedTarget}

Generate a detailed prompt that will help create 6 focused 14-day sprints, each targeting approximately 115 companies within the boundary "${boundary}".

The prompt should include:
1. Strategic approach for the boundary
2. Sprint breakdown methodology  
3. Weekly planning structure
4. Success metrics and tracking
5. Execution guidelines

Return a comprehensive planning prompt that can be used to generate specific sprint plans.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a sales strategy expert..." },
    { role: "user", content: perplexityPrompt }
  ]);

  return result.trim();
}
```

## Phase 10: Daily Queries Generation

### API Call 5: Daily Queries Generation
**Endpoint:** `POST /api/strategy/queries`
**File:** `server/routes.ts` (Lines 3780-3829)

```javascript
app.post("/api/strategy/queries", async (req, res) => {
  const { boundary, sprintPrompt, productContext } = req.body;

  const dailyQueries = await generateDailyQueries(boundary, sprintPrompt, productContext);
  
  // Save to database if user authenticated
  if (req.user) {
    const userId = getUserId(req);
    await storage.updateStrategicProfile?.(userId, { 
      exampleDailyQueriesArray: JSON.stringify(dailyQueries)
    });
  }

  res.json({
    type: 'queries',
    title: 'Daily Search Queries',
    content: dailyQueries,
    step: 4,
    totalSteps: 4,
    isComplete: true
  });
});
```

### Daily Queries Generation Logic
**File:** `server/lib/api/openai-client.ts` (Lines 172-215)

```javascript
export async function generateDailyQueries(boundary, sprintPrompt, productContext) {
  const perplexityPrompt = `
Generate 8 specific daily search queries for ${productContext.productService}:
Target Boundary: ${boundary}
Sprint Strategy: ${sprintPrompt}

Create 8 diverse, actionable search queries that sales teams can use daily to find companies within the boundary "${boundary}".

Each query should:
1. Be specific and actionable
2. Target different aspects of the boundary
3. Yield 10-15 company results per query
4. Be practical for daily prospecting

Format as a simple numbered list:
1. [specific search query]
2. [specific search query]
...
8. [specific search query]

Return only the numbered list, no additional text.`;

  const result = await queryPerplexity([
    { role: "system", content: "You are a lead generation expert..." },
    { role: "user", content: perplexityPrompt }
  ]);

  // Parse queries from result
  const queries = result.split('\n')
    .filter(line => line.trim().match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim());

  return queries.length >= 6 ? queries : result.split('\n').filter(line => line.trim());
}
```

## Phase 11: Strategy Completion and Final Report

### Final Message Display
**Function:** `displayStrategyComplete(strategyData)`
**File:** `static/js/chat-overlay.js` (Lines 1395+)

```javascript
displayStrategyComplete(strategyData) {
  const completeHtml = `
    <div class="strategy-complete mt-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 class="text-xl font-bold text-blue-800 mb-4">🎉 Your 90-Day Sales Strategy is Complete!</h3>
      <p class="text-blue-700 mb-4">
        You now have a comprehensive strategy with:
      </p>
      <ul class="list-disc list-inside text-blue-700 mb-4 space-y-1">
        <li>Strategic boundary targeting ~700 companies</li>
        <li>Detailed sprint planning methodology</li>  
        <li>8 daily search queries for prospecting</li>
        <li>Complete implementation roadmap</li>
      </ul>
      <div class="mt-4">
        <a href="/app" target="_blank" 
           class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Start Using Your Strategy →
        </a>
      </div>
    </div>`;

  this.messages.push({
    id: Date.now().toString(),
    content: completeHtml,
    sender: 'ai',
    timestamp: new Date(),
    isHTML: true
  });
  
  this.render();
}
```

## Complete API Call Flow Summary

1. **Background Research**: `POST /api/onboarding/background-research`
   - **Dependencies**: Perplexity API
   - **Output**: Market research data

2. **Strategy Chat**: `POST /api/onboarding/strategy-chat` 
   - **Dependencies**: OpenAI GPT-4o
   - **Output**: Function calling responses (product summary, email strategy trigger)

3. **Boundary Options**: `POST /api/strategy/boundary`
   - **Dependencies**: Perplexity API  
   - **Output**: 3 strategic boundary options

4. **Boundary Selection**: `POST /api/strategy/boundary/select`
   - **Dependencies**: Perplexity API (for validation)
   - **Output**: Confirmed boundary, validation feedback

5. **Sprint Strategy**: `POST /api/strategy/sprint`
   - **Dependencies**: Perplexity API
   - **Output**: Sprint planning methodology

6. **Daily Queries**: `POST /api/strategy/queries`
   - **Dependencies**: Perplexity API
   - **Output**: 8 daily search queries

## Database Storage Integration

### Strategic Profile Schema
**File:** `shared/schema.ts`
```typescript
strategicProfiles: {
  userId: number,
  strategyHighLevelBoundary: string,
  exampleSprintPlanningPrompt: string, 
  exampleDailyQueriesArray: string, // JSON stringified array
  productAnalysisSummary: string
}
```

### Storage Operations
**File:** `server/storage.ts`
```javascript
async updateStrategicProfile(userId, updates) {
  // Save strategy data to database
  await db.update(strategicProfiles)
    .set(updates)
    .where(eq(strategicProfiles.userId, userId));
}
```

## Environment Dependencies

### Required API Keys
1. **PERPLEXITY_API_KEY**: Real-time market research and validation
2. **OPENAI_API_KEY**: GPT-4o function calling and conversation management

### Database
- **PostgreSQL**: User data and strategy storage via Drizzle ORM

## Error Handling and Fallbacks

### API Error Recovery
```javascript
// Perplexity API fallback
try {
  const result = await queryPerplexity(messages);
  return result;
} catch (error) {
  console.error('Perplexity API error:', error);
  return { type: 'conversation', response: "Let me help you with a different approach..." };
}
```

### Frontend Error States
```javascript
// Chat interface error handling
if (!response.ok) {
  throw new Error('Failed to generate strategy');
}
```

This completes the comprehensive analysis of the strategic onboarding flow from landing page entry to final strategy report delivery.