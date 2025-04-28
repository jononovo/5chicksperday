import { createContext, useContext, useState, ReactNode } from 'react';

// Define the context type
interface SearchStrategyContextType {
  selectedStrategyId: string | null;
  setSelectedStrategyId: (id: string | null) => void;
}

// Create the context with default values
const SearchStrategyContext = createContext<SearchStrategyContextType>({
  selectedStrategyId: null,
  setSelectedStrategyId: () => {},
});

// Create a provider component
export function SearchStrategyProvider({ children }: { children: ReactNode }) {
  // Initialize with null, let the component decide what to select
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  return (
    <SearchStrategyContext.Provider value={{ selectedStrategyId, setSelectedStrategyId }}>
      {children}
    </SearchStrategyContext.Provider>
  );
}

// Create a hook to use the context
export function useSearchStrategy() {
  return useContext(SearchStrategyContext);
}