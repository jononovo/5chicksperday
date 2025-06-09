# Backend Search Session Management Architecture

## Executive Summary

Comprehensive design for transferring search process management to the backend using persistent search sessions, ensuring seamless operation across page navigation and providing bulletproof continuity.

## 1. Current Architecture Analysis

### 1.1 Current Search Flow Problems

**Frontend-Dependent State:**
- Search progress tracking in React components
- Multi-phase operations lost on navigation
- No recovery mechanism for interrupted processes
- Background API calls complete but UI loses context

**Current Search Phases:**
1. **Company Discovery** (15-30s) - `/api/companies/quick-search`
2. **Contact Discovery** (30-60s) - `/api/companies/search` 
3. **Email Enrichment** (60-180s) - Multiple service calls

**State Management Issues:**
```typescript
// Lost on navigation
const [isAnalyzing, setIsAnalyzing] = useState(false);
const [isConsolidatedSearching, setIsConsolidatedSearching] = useState(false);
const [searchProgress, setSearchProgress] = useState({});
```

## 2. Backend Session Management Design

### 2.1 Database Schema Extensions

**New Search Sessions Table:**
```sql
CREATE TABLE search_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  query TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  current_phase VARCHAR(50),
  progress_completed INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  phase_data JSONB DEFAULT '{}',
  results JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')
);

CREATE INDEX idx_search_sessions_user_id ON search_sessions(user_id);
CREATE INDEX idx_search_sessions_status ON search_sessions(status);
CREATE INDEX idx_search_sessions_session_id ON search_sessions(session_id);
```

**Search Session Phases Table:**
```sql
CREATE TABLE search_session_phases (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL REFERENCES search_sessions(session_id),
  phase_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  phase_data JSONB DEFAULT '{}',
  error_message TEXT
);
```

### 2.2 Backend Search Session Service

**Core Service Architecture:**
```typescript
// server/lib/search-session/service.ts
interface SearchSession {
  sessionId: string;
  userId: number;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentPhase: string;
  progressCompleted: number;
  progressTotal: number;
  phaseData: Record<string, any>;
  results: any;
  startedAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

class SearchSessionManager {
  // Create new search session
  async createSession(userId: number, query: string): Promise<string> {
    const sessionId = crypto.randomUUID();
    await storage.createSearchSession({
      sessionId,
      userId,
      query,
      status: 'pending',
      currentPhase: 'initializing',
      progressTotal: 3, // Company discovery, Contact discovery, Email search
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    });
    return sessionId;
  }

  // Execute search phases asynchronously
  async executeSearch(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, { 
        status: 'running',
        currentPhase: 'company_discovery',
        progressCompleted: 0
      });

      // Phase 1: Company Discovery
      const companies = await this.executeCompanyDiscovery(sessionId);
      
      await this.updateSession(sessionId, {
        currentPhase: 'contact_discovery',
        progressCompleted: 1,
        phaseData: { companies }
      });

      // Phase 2: Contact Discovery  
      const companiesWithContacts = await this.executeContactDiscovery(sessionId, companies);
      
      await this.updateSession(sessionId, {
        currentPhase: 'email_search',
        progressCompleted: 2,
        phaseData: { companiesWithContacts }
      });

      // Phase 3: Email Search (optional, triggered separately)
      await this.updateSession(sessionId, {
        status: 'completed',
        currentPhase: 'completed',
        progressCompleted: 3,
        results: companiesWithContacts,
        completedAt: new Date()
      });

    } catch (error) {
      await this.updateSession(sessionId, {
        status: 'failed',
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Get session status for frontend polling
  async getSession(sessionId: string): Promise<SearchSession | null> {
    return await storage.getSearchSession(sessionId);
  }

  // Update session progress
  async updateSession(sessionId: string, updates: Partial<SearchSession>): Promise<void> {
    await storage.updateSearchSession(sessionId, {
      ...updates,
      updatedAt: new Date()
    });
  }

  // Execute email search as separate phase
  async executeEmailSearch(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    await this.updateSession(sessionId, {
      currentPhase: 'email_search_perplexity',
      progressCompleted: 0,
      progressTotal: 3 // Perplexity, Apollo, Hunter
    });

    // Execute email search phases...
  }
}
```

### 2.3 New API Endpoints

**Session Management Endpoints:**
```typescript
// POST /api/search-sessions
app.post("/api/search-sessions", requireAuth, async (req, res) => {
  const { query, contactSearchConfig } = req.body;
  const userId = getUserId(req);
  
  const sessionId = await searchSessionManager.createSession(userId, query);
  
  // Start async search execution (don't await)
  searchSessionManager.executeSearch(sessionId).catch(error => {
    console.error(`Search session ${sessionId} failed:`, error);
  });

  res.json({ sessionId, status: 'started' });
});

// GET /api/search-sessions/:sessionId
app.get("/api/search-sessions/:sessionId", requireAuth, async (req, res) => {
  const session = await searchSessionManager.getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// POST /api/search-sessions/:sessionId/email-search
app.post("/api/search-sessions/:sessionId/email-search", requireAuth, async (req, res) => {
  const sessionId = req.params.sessionId;
  
  // Start async email search (don't await)
  searchSessionManager.executeEmailSearch(sessionId).catch(error => {
    console.error(`Email search for session ${sessionId} failed:`, error);
  });

  res.json({ status: 'email_search_started' });
});

// DELETE /api/search-sessions/:sessionId (cancel search)
app.delete("/api/search-sessions/:sessionId", requireAuth, async (req, res) => {
  await searchSessionManager.cancelSession(req.params.sessionId);
  res.json({ status: 'cancelled' });
});
```

## 3. Frontend Integration Strategy

### 3.1 Search Session Hook

**React Hook for Session Management:**
```typescript
// client/src/hooks/use-search-session.ts
interface UseSearchSessionResult {
  session: SearchSession | null;
  startSearch: (query: string) => Promise<string>;
  startEmailSearch: () => Promise<void>;
  cancelSearch: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useSearchSession(): UseSearchSessionResult {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SearchSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling for session updates
  useEffect(() => {
    if (!sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiRequest("GET", `/api/search-sessions/${sessionId}`);
        const sessionData = await response.json();
        setSession(sessionData);

        // Stop polling if completed/failed
        if (['completed', 'failed', 'cancelled'].includes(sessionData.status)) {
          clearInterval(pollInterval);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Session polling error:', err);
        setError(err.message);
        clearInterval(pollInterval);
        setIsLoading(false);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [sessionId]);

  const startSearch = async (query: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/search-sessions", { query });
      const { sessionId: newSessionId } = await response.json();
      
      setSessionId(newSessionId);
      
      // Save session ID to localStorage for recovery
      localStorage.setItem('currentSearchSession', newSessionId);
      
      return newSessionId;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  };

  const startEmailSearch = async (): Promise<void> => {
    if (!sessionId) throw new Error('No active session');
    
    setIsLoading(true);
    try {
      await apiRequest("POST", `/api/search-sessions/${sessionId}/email-search`);
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  };

  return {
    session,
    startSearch,
    startEmailSearch,
    cancelSearch: async () => {
      if (sessionId) {
        await apiRequest("DELETE", `/api/search-sessions/${sessionId}`);
        setSessionId(null);
        setSession(null);
        localStorage.removeItem('currentSearchSession');
      }
    },
    isLoading,
    error
  };
}
```

### 3.2 Session Recovery on Component Mount

**Recovery Logic:**
```typescript
// client/src/pages/home.tsx
useEffect(() => {
  // Check for existing session on mount
  const savedSessionId = localStorage.getItem('currentSearchSession');
  if (savedSessionId) {
    // Restore session and continue polling
    setSessionId(savedSessionId);
  }
}, []);
```

### 3.3 Updated Search Components

**PromptEditor Integration:**
```typescript
// client/src/components/prompt-editor.tsx
export default function PromptEditor({ onSearchResults }) {
  const { session, startSearch, isLoading } = useSearchSession();

  // Watch for completed sessions
  useEffect(() => {
    if (session?.status === 'completed' && session.results) {
      onSearchResults(session.query, session.results);
    }
  }, [session, onSearchResults]);

  const handleSearch = async () => {
    try {
      await startSearch(query);
    } catch (error) {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Render progress based on session state
  const renderProgress = () => {
    if (!session || session.status === 'pending') return null;

    return (
      <SearchProgress
        phase={session.currentPhase}
        completed={session.progressCompleted}
        total={session.progressTotal}
      />
    );
  };

  return (
    <div>
      {/* Search input */}
      <Button onClick={handleSearch} disabled={isLoading}>
        {isLoading ? "Searching..." : "Search"}
      </Button>
      
      {/* Progress display */}
      {renderProgress()}
    </div>
  );
}
```

## 4. Migration Strategy

### 4.1 Backward Compatibility

**Hybrid Approach During Transition:**
1. Keep existing endpoints functional
2. Add new session-based endpoints
3. Frontend can use either approach
4. Gradual migration of components

**Feature Flags:**
```typescript
const USE_SESSION_BASED_SEARCH = process.env.VITE_USE_SESSION_SEARCH === 'true';
```

### 4.2 Database Migration

**Migration Script:**
```sql
-- Add search session tables
-- (SQL from section 2.1)

-- No data migration needed - new feature
-- Existing search results remain in companies/contacts tables
```

### 4.3 Storage Interface Extensions

**IStorage Interface Updates:**
```typescript
// server/storage/index.ts
interface IStorage {
  // Existing methods...
  
  // New search session methods
  createSearchSession(session: CreateSearchSessionData): Promise<SearchSession>;
  getSearchSession(sessionId: string): Promise<SearchSession | null>;
  updateSearchSession(sessionId: string, updates: Partial<SearchSession>): Promise<void>;
  deleteSearchSession(sessionId: string): Promise<void>;
  listUserSearchSessions(userId: number): Promise<SearchSession[]>;
  cleanupExpiredSessions(): Promise<number>;
}
```

## 5. Technical Benefits

### 5.1 Navigation Resilience

**Before:**
- User navigates → Search stops
- No recovery mechanism
- Lost progress tracking

**After:**
- User navigates → Search continues
- Automatic session recovery
- Real-time progress updates

### 5.2 Background Processing

**True Background Execution:**
- Server-side async processing
- No dependency on frontend state
- Continues regardless of user actions

### 5.3 Scalability Benefits

**Resource Management:**
- Server controls API rate limiting
- Centralized error handling
- Session cleanup automation

### 5.4 User Experience Improvements

**Seamless Operations:**
- Search survives page refreshes
- Multiple tab support
- Clear progress indication
- Reliable state recovery

## 6. Implementation Phases

### 6.1 Phase 1: Core Infrastructure (Week 1)

**Backend Components:**
1. Database schema creation
2. Search session service implementation
3. Basic API endpoints
4. Storage interface extensions

**Deliverables:**
- Working session creation/retrieval
- Basic progress tracking
- Session cleanup mechanisms

### 6.2 Phase 2: Frontend Integration (Week 2)

**Frontend Components:**
1. Search session hook
2. Updated PromptEditor component
3. Progress display components
4. Session recovery logic

**Deliverables:**
- Working end-to-end search sessions
- Navigation resilience
- Progress visualization

### 6.3 Phase 3: Email Search Integration (Week 3)

**Email Processing:**
1. Async email search phases
2. Service integration (Hunter, Apollo, Perplexity)
3. Progress tracking for email phases
4. Result consolidation

**Deliverables:**
- Complete email search workflow
- Multi-service coordination
- Robust error handling

### 6.4 Phase 4: Polish & Optimization (Week 4)

**Refinements:**
1. Performance optimization
2. Enhanced error handling
3. Session management UI
4. Analytics integration

**Deliverables:**
- Production-ready system
- Comprehensive testing
- Documentation completion

## 7. Risk Mitigation

### 7.1 Backward Compatibility

**Risk:** Breaking existing functionality
**Mitigation:** Parallel endpoint development, feature flags, gradual rollout

### 7.2 Database Performance

**Risk:** Session table growth
**Mitigation:** Automatic cleanup, indexing strategy, monitoring

### 7.3 Memory Usage

**Risk:** Long-running search processes
**Mitigation:** Session timeouts, resource monitoring, cleanup jobs

### 7.4 Error Recovery

**Risk:** Failed searches leave orphaned sessions
**Mitigation:** Comprehensive error handling, automatic retry, cleanup mechanisms

## 8. Success Metrics

### 8.1 Technical Metrics

- Session recovery rate: >95%
- Search completion rate: >90%
- Navigation interruption recovery: 100%
- Average search duration consistency

### 8.2 User Experience Metrics

- Reduced user confusion about search status
- Decreased search restart frequency
- Improved perceived reliability
- Better engagement with long-running processes

## 9. Conclusion

The backend search session architecture provides a robust foundation for interruption-proof search operations. By moving process management to the server and implementing persistent session tracking, users can navigate freely while searches continue seamlessly in the background.

**Key Advantages:**
- **Bulletproof Continuity:** Searches survive any frontend disruption
- **True Background Processing:** Server-side execution independent of UI
- **Real-time Progress:** Continuous updates via polling
- **Automatic Recovery:** Session restoration on page load
- **Scalable Architecture:** Centralized resource management

The implementation maintains backward compatibility while providing a path toward a more reliable and user-friendly search experience.