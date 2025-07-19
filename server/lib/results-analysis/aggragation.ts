
// Helper function to normalize scores between 30-100
export function normalizeScore(score: number): number {
  return Math.min(Math.max(Math.round(score), 30), 100);
}

// Helper function to calculate average of numbers
export function calculateAverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Helper function to calculate improvement compared to previous tests
export function calculateImprovement(results: any[]): number | null {
  if (results.length < 2) return null;
  
  // Sort by date (newest first)
  const sortedResults = [...results].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // Latest score vs average of previous scores
  const latestScore = sortedResults[0].overallScore;
  const previousScores = sortedResults.slice(1).map(r => r.overallScore);
  const averagePrevious = calculateAverage(previousScores);
  
  return latestScore - averagePrevious;
}
 