# Strategic Onboarding Flow Documentation
**Version:** 2.0  
**Date:** 2025-06-05  
**File:** 250604_strat_on-boarding_v1.md

## Overview
The strategic onboarding flow guides users through a conversational AI-powered process that generates personalized 90-day email sales strategies. The system uses OpenAI function calling combined with progressive boundary selection to create interactive, user-driven strategy development.

## Current Implementation Status
- ✅ **OpenAI Function Calling**: GPT-4o automatically detects conversation phases and triggers appropriate strategy generation
- ✅ **Interactive Boundary Selection**: Users choose from 3 AI-generated boundary options or create custom boundaries
- ✅ **Progressive Strategy APIs**: Sequential generation of boundary → sprint → daily queries
- ⚠️ **Phase Detection Legacy**: Existing phase-based logic creates redundancy with OpenAI function calling

## Architecture Components

### Frontend Components
- **Landing Page** (`static/landing.html`) - Entry point with chat overlay trigger
- **Chat Overlay** (`static/js/chat-overlay.js`) - Main interaction interface
- **Form Modal** - 3-step product information collection

### Backend Components
- **Strategy Chat API** (`/api/onboarding/strategy-chat`) - Orchestrates conversation flow
- **Progressive Strategy APIs** - Three sequential generation endpoints
- **OpenAI Client** (`server/lib/api/openai-client.ts`) - GPT-4o integration
- **Perplexity Client** (`server/lib/api/perplexity-client.ts`) - Real-time market research

## Flow Sequence

### Phase 1: Product Context Collection
**Trigger:** User clicks "Start Chat" on landing page  
**Location:** `chat-overlay.js` lines 438-448

1. **Form Modal Display** - 3-step questionnaire:
   - Product/service description
   - Customer feedback/advantage
   - Website/online presence
2. **Data Validation** - Real-time form validation
3. **Context Storage** - Form data stored in `this.formData`

### Phase 2: Product Analysis Generation
**Trigger:** Form completion  
**API Call:** `POST /api/onboarding/strategy-chat`

```javascript
// Input payload
{
  input: "Generate product summary",
  phase: "PRODUCT_ANALYSIS", 
  productContext: formData
}
```

**Processing Logic:**
1. Perplexity API call for market research
2. Structured product summary generation
3. 4-bullet format output:
   - What it is
   - Problem it solves
   - Competitive advantage
   - Customer benefit

**Response Storage:** Database table `strategicProfiles.productAnalysisSummary`

### Phase 3: Target Market Collection
**Trigger:** Product summary completion  
**Display:** Automated follow-up message

**Prompt Template:**
```
"Perfect! Now please give me an example of a type of business you service or sell you.
Like this "[type of business] in [city/niche]"

Examples:
Popular cafes in Lower East Side, NYC
Real-estate insurance brokers in Salt Lake City"
```

**Validation:** User provides initial target market example

### Phase 4: Target Refinement
**Trigger:** Initial target submission  
**API Call:** `POST /api/onboarding/strategy-chat`

**Processing Logic:**
1. OpenAI GPT-4o analysis of initial target
2. Market refinement suggestions
3. Geographic/demographic optimization
4. Niche specification enhancement

**Output:** Refined target market definition

### Phase 5: Progressive Strategy Generation
**Current Implementation:** OpenAI Function Tool Override → Progressive Boundary Selection  
**Trigger:** GPT-4o detects both `initialTarget` and `refinedTarget` parameters

**Flow Control:**
```javascript
// OpenAI function call redirects to progressive boundary selection
else if (functionName === 'generateEmailStrategy') {
  return {
    type: 'progressive_strategy',  // Redirected from 'email_strategy'
    message: "Perfect! Now I'll create your **strategic sales plan** step by step.",
    initialTarget: functionArgs.initialTarget,
    refinedTarget: functionArgs.refinedTarget,
    needsProgressiveGeneration: true
  };
}
```

#### Step 1: Interactive Boundary Generation
**Endpoint:** `POST /api/strategy/boundary`
```javascript
// Payload
{
  initialTarget: string,
  refinedTarget: string,
  productContext: object
}
```
**Function:** `generateBoundaryOptions()` in `openai-client.ts`  
**Output:** Array of 3 boundary options plus custom input field
- Geographic-focused approach
- Niche specialization approach  
- Balanced hybrid approach
**Example Options:**
- "Quadruped robotics companies in industrial inspection globally"
- "Dog walking robots targeting urban pet owners in US and UK cities" 
- "Pet tech companies in major US cities"

#### Step 2: Sprint Strategy
**Endpoint:** `POST /api/strategy/sprint`
```javascript
// Payload
{
  boundary: string,
  refinedTarget: string,
  productContext: object
}
```
**Function:** `generateSprintPrompt()` in `openai-client.ts`  
**Output:** Sprint planning prompt with specific targeting criteria  
**Storage:** `strategicProfiles.exampleSprintPlanningPrompt`

#### Step 3: Daily Queries
**Endpoint:** `POST /api/strategy/queries`
```javascript
// Payload
{
  boundary: string,
  sprintPrompt: string,
  productContext: object
}
```
**Function:** `generateDailyQueries()` in `openai-client.ts`  
**Output:** Array of 8 hyper-specific search queries  
**Storage:** `strategicProfiles.exampleDailySearchQueries`

## Error Handling & Validation

### Frontend Validation
```javascript
// Parameter validation in generateProgressiveStrategy()
if (!initialTarget || !refinedTarget || !productContext.productService) {
  console.error('Missing required parameters');
  return error_message;
}
```

### Backend Validation
```javascript
// API endpoint validation
if (!initialTarget || !refinedTarget || !productContext) {
  res.status(400).json({ message: "Missing required parameters" });
  return;
}
```

### Error Recovery
- Comprehensive logging at each step
- Graceful degradation with user feedback
- Retry mechanisms for API failures

## UI/UX Flow

### Progressive Display
1. **Loading States** - Real-time progress indicators
2. **Step-by-Step Reveal** - Individual strategy components displayed sequentially
3. **Complete Summary** - Final consolidated view titled "90-Day Target Search Strategy"
4. **Completion Message** - Clickable link to main application

### Message Types
- **Loading Messages** - `isLoading: true, isHTML: true`
- **Strategy Steps** - Individual component displays
- **HTML Messages** - `isHTML: true` for formatted content
- **Completion Link** - `target="_blank"` with styling

## Database Schema

### Strategic Profiles Table
```sql
strategicProfiles {
  userId: number,
  productAnalysisSummary: text,
  exampleSprintPlanningPrompt: text,
  exampleDailySearchQueries: text[]
}
```

## API Integration

### OpenAI GPT-4o
- **Model:** `gpt-4o` (latest available)
- **Purpose:** Strategy generation, market analysis
- **Response Format:** JSON structured outputs

### Perplexity API
- **Model:** `sonar`
- **Purpose:** Real-time market research, competitive analysis
- **Features:** Live web search integration

## Technical Implementation Details

### Context Preservation
```javascript
// Proper parameter passing to avoid corruption
const productContext = {
  productService: this.formData?.productService,
  customerFeedback: this.formData?.customerFeedback,
  website: this.formData?.website
};
```

### Sequential Processing
```javascript
// Ensures proper data flow between steps
strategyData.boundary = boundaryData.content;
// Use boundary in next step
{ boundary: strategyData.boundary, refinedTarget, productContext }
```

### Completion Flow
```javascript
// Final message with clickable link
setTimeout(() => {
  const currentDomain = window.location.origin;
  content: `Awesome! We're done here.<br><br>Now go to <a href="${currentDomain}/app" target="_blank">app</a>`
}, 1000);
```

## Performance Considerations
- **API Response Times:** 2-5 seconds per strategy step
- **Total Flow Duration:** 15-30 seconds for complete generation
- **Error Recovery:** Automatic retry with user notification
- **Memory Management:** Efficient message array handling

## Security & Authentication
- **API Key Management:** Environment variable storage
- **User Context:** Firebase authentication integration
- **Data Persistence:** Authenticated user strategy storage
- **Cross-Origin:** Proper CORS configuration

## Architecture Improvement Recommendations

### Current Technical Debt: Dual Flow Systems

**Problem:** The system maintains two parallel conversation management approaches:
1. **Phase Detection Logic** (Legacy) - Lines 3509-3514 in `server/routes.ts`
2. **OpenAI Function Calling** (Modern) - Lines 341-349 in `openai-client.ts`

This creates redundancy, potential conflicts, and maintenance overhead.

### Proposed Refactoring: Pure OpenAI Function Tool Architecture

#### Benefits of Eliminating Phase Detection

**Simplified Codebase:**
- Remove ~100 lines of phase detection logic
- Eliminate conversation history parsing
- Reduce conditional complexity in route handlers

**Improved Reliability:**
- Single source of truth for conversation state
- GPT-4o handles context awareness natively
- Eliminate race conditions between phase detection and function calling

**Enhanced Maintainability:**
- Centralized conversation flow in OpenAI tools
- Clear separation of concerns
- Easier debugging and testing

#### Implementation Strategy

**Step 1: Expand OpenAI Function Tools**
```javascript
// Add conversation management function
{
  type: "function",
  function: {
    name: "requestTargetRefinement",
    description: "Ask user to refine their initial target market example",
    parameters: {
      type: "object",
      properties: {
        initialTarget: { type: "string" },
        suggestionTemplate: { type: "string" }
      }
    }
  }
}
```

**Step 2: Function Tool Flow Control**
```javascript
// Replace phase detection with function orchestration
if (functionName === 'requestTargetRefinement') {
  return {
    type: 'conversation',
    message: generateRefinementRequest(functionArgs.initialTarget),
    awaitingRefinement: true
  };
} else if (functionName === 'generateEmailStrategy') {
  return {
    type: 'progressive_strategy',
    initialTarget: functionArgs.initialTarget,
    refinedTarget: functionArgs.refinedTarget,
    needsProgressiveGeneration: true
  };
}
```

**Step 3: Remove Legacy Components**
- Delete phase detection variables (`hasProductSummary`, `hasInitialTarget`, etc.)
- Remove conversation history parsing logic
- Simplify route handler to single OpenAI function call
- Eliminate conditional phase-based branching

#### Proposed Function Tool Set

**Core Conversation Functions:**
1. `generateProductSummary` ✅ (Existing)
2. `requestInitialTarget` (New) - Ask for first target example
3. `requestTargetRefinement` (New) - Ask for target refinement
4. `generateEmailStrategy` ✅ (Modified to trigger progressive flow)
5. `generateSalesApproach` ✅ (Existing)

**Progressive Strategy Functions:**
- Maintain existing `/api/strategy/*` endpoints
- Keep boundary selection UI
- Preserve user interaction patterns

#### Migration Path

**Phase 1: Add New Function Tools**
- Implement `requestInitialTarget` and `requestTargetRefinement` functions
- Test function calling logic with existing phase detection as fallback

**Phase 2: Transition Period**
- Route new conversations through function tools only
- Maintain phase detection for existing conversations
- Monitor for edge cases and conversation gaps

**Phase 3: Legacy Removal**
- Remove all phase detection logic
- Simplify route handlers
- Clean up unused conversation parsing code

#### Expected Outcomes

**Performance Improvements:**
- Faster response times (eliminate phase calculation)
- Reduced memory usage (no conversation history parsing)
- Lower CPU overhead (simplified route logic)

**Code Quality:**
- 30% reduction in conversation management code
- Elimination of complex conditional branching
- Single responsibility principle adherence

**User Experience:**
- More natural conversation flow
- Improved context awareness from GPT-4o
- Consistent behavior across conversation states

### Technical Specifications for Refactoring

**Function Tool Schema Updates:**
```typescript
interface FunctionCallResult {
  type: 'conversation' | 'product_summary' | 'progressive_strategy' | 'sales_approach';
  message: string;
  data?: any;
  awaitingInput?: boolean;
  nextFunction?: string;
}
```

**Simplified Route Handler:**
```javascript
app.post("/api/onboarding/strategy-chat", async (req, res) => {
  const { userInput, productContext, conversationHistory } = req.body;
  
  // Single OpenAI function call - no phase detection
  const result = await queryOpenAI(buildMessages(userInput, conversationHistory), productContext);
  
  // Optional: Save to database if authenticated
  if (req.user && result.type !== 'conversation') {
    await saveStrategyData(req.user.id, result);
  }
  
  res.json(result);
});
```

**Benefits Summary:**
- **Reduced Complexity:** Eliminate dual conversation management systems
- **Improved Reliability:** Single source of truth via OpenAI function calling
- **Enhanced Maintainability:** Centralized conversation logic
- **Better Performance:** Faster processing without phase detection overhead
- **Future-Proof:** Leverages OpenAI's native conversation management capabilities

---
**End of Documentation**