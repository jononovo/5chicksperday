export function extractAttributes(message: string): string[] {
  // function written by chatgpt, there were no definition


  const parts = message.split(/[.,;!?]/).filter(part => part.trim().length > 0);
  
  // Extract potential attributes from each part
  const attributes: string[] = [];
  
  for (const part of parts) {
    // Look for phrases that might describe attributes
    const cleaned = part.trim();
    if (cleaned.length > 3) {
      // For longer phrases, clean them up and add to attributes
      attributes.push(cleaned);
    }
  }
  
  // If no attributes were found, return the original message as a single attribute
  if (attributes.length === 0) {
    return [message.trim()];
  }
  
  return attributes;
}

export function extractMarketNiche(message: string): string {
  if (!message || typeof message !== 'string') {
    return '';
  }
  
  // Extract key industry and segment information from the message
  const keywords = [
    'industry', 'sector', 'market', 'segment', 'niche', 'focus', 
    'specializes', 'specializing', 'targeting', 'specialized'
  ];
  
  // Look for sentences containing market niche indicators
  const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // First try to find sentences with keywords
  for (const keyword of keywords) {
    const relevantSentence = sentences.find(s => 
      s.toLowerCase().includes(keyword)
    );
    
    if (relevantSentence) {
      // Clean up and return a concise version (max 100 chars)
      return relevantSentence.trim().substring(0, 100);
    }
  }
  
  // If no keywords found, return the first substantive sentence
  const firstSubstantiveSentence = sentences.find(s => s.trim().length > 15);
  return firstSubstantiveSentence ? 
    firstSubstantiveSentence.trim().substring(0, 100) : 
    message.substring(0, 100).trim();
}

export function generateSearchPrompts(profileData: any, businessType: string): string[] {
  // Extract relevant information from profile data
  const {
    productService,
    targetCustomers,
    uniqueAttributes,
    businessDescription,
    marketNiche
  } = profileData;

  // Default prompts if we don't have enough information
  if (!targetCustomers || !productService) {
    return [
      `${businessType} companies in the United States`,
      `Growing ${businessType} businesses with digital presence`,
      `${businessType} companies looking for growth opportunities`
    ];
  }

  // Create targeted search prompts based on profile data
  const prompts = [];
  
  // Create a basic product-focused prompt
  prompts.push(`${targetCustomers} who need ${productService}`);
  
  // Add geographic targeting if available
  if (marketNiche && marketNiche.includes(" in ")) {
    prompts.push(`${marketNiche} looking for ${productService}`);
  } else if (targetCustomers.includes(" in ")) {
    prompts.push(`${targetCustomers} seeking ${businessType} solutions`);
  }
  
  // Add industry-specific prompt
  if (uniqueAttributes && uniqueAttributes.length > 0) {
    prompts.push(`${targetCustomers} who value ${uniqueAttributes[0]}`);
  }
  
  // Add a problem-solution prompt
  if (businessDescription) {
    const problemStatement = `${targetCustomers} struggling with ${businessType} challenges`;
    prompts.push(problemStatement);
  }

  // Add a size-based prompt if we can detect company size references
  if (targetCustomers.match(/small|medium|large|enterprise|startup/i)) {
    prompts.push(`${targetCustomers.match(/small|medium|large|enterprise|startup/i)[0]} ${businessType} companies needing ${productService}`);
  }

  return prompts;
}
