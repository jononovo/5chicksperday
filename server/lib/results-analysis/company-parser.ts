import type { Company } from "@shared/schema";
import { analyzeCompanySize, analyzeDifferentiators, calculateCompanyScore } from "./company-analysis";

export function parseCompanyData(analysisResults: string[]): Partial<Company> {
  const companyData: Partial<Company> = {
    services: [],
    validationPoints: [],
    differentiation: [],
    totalScore: 0
  };

  try {
    for (const result of analysisResults) {
      // Text analysis first to ensure we don't miss anything
      const size = analyzeCompanySize(result);
      if (size !== null && !companyData.size) {
        companyData.size = size;
      }

      const differentiators = analyzeDifferentiators(result);
      if (differentiators.length > 0 && companyData.differentiation) {
        const uniqueDifferentiators = new Set([...companyData.differentiation]);
        differentiators.forEach(d => uniqueDifferentiators.add(d));
        companyData.differentiation = Array.from(uniqueDifferentiators);
      }

      // Extract services using common patterns
      const servicePatterns = [
        /(?:provides?|offers?|delivers?|specializes? in)\s+([^.!?]+(?:services|solutions|consulting|development|support))/gi,
        /(?:key|main|core)\s+services?:\s*([^.!?]+)/gi,
        /services?(?:\s+include)?:\s*([^.!?]+)/gi
      ];

      for (const pattern of servicePatterns) {
        let match;
        while ((match = pattern.exec(result)) !== null) {
          const serviceText = match[1].trim();
          const services = serviceText
            .split(/,|\band\b/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && s.length < 100); // Reasonable length check

          if (services.length > 0 && companyData.services) {
            const uniqueServices = new Set([...companyData.services]);
            services.forEach(s => uniqueServices.add(s));
            companyData.services = Array.from(uniqueServices);
          }
        }
      }

      // Then try JSON parsing as fallback
      try {
        const jsonData = JSON.parse(result);

        if (typeof jsonData.size === 'number' || typeof jsonData.employeeCount === 'number') {
          companyData.size = jsonData.size || jsonData.employeeCount;
        } else if (typeof jsonData.size === 'string' || typeof jsonData.employeeCount === 'string') {
          const size = analyzeCompanySize(jsonData.size || jsonData.employeeCount);
          if (size !== null) {
            companyData.size = size;
          }
        }

        if (Array.isArray(jsonData.services) && companyData.services) {
          const uniqueServices = new Set([...companyData.services]);
          jsonData.services
            .filter((s: unknown): s is string => typeof s === 'string')
            .forEach(s => uniqueServices.add(s));
          companyData.services = Array.from(uniqueServices);
        }

        if ((Array.isArray(jsonData.differentiators) || Array.isArray(jsonData.uniquePoints)) && companyData.differentiation) {
          const points = jsonData.differentiators || jsonData.uniquePoints;
          if (points.length > 0) {
            const uniqueDifferentiators = new Set([...companyData.differentiation]);
            points
              .filter((p: unknown): p is string => typeof p === 'string')
              .forEach(p => uniqueDifferentiators.add(p));
            companyData.differentiation = Array.from(uniqueDifferentiators);
          }
        }
      } catch (e) {
        // JSON parsing failed, continue with next result
        continue;
      }
    }

    // Calculate final score using all gathered data
    companyData.totalScore = calculateCompanyScore(companyData);

    // Ensure arrays are reasonably sized
    if (companyData.services) {
      companyData.services = companyData.services.slice(0, 5);
    }
    if (companyData.differentiation) {
      companyData.differentiation = companyData.differentiation.slice(0, 3);
    }

  } catch (error) {
    console.error('Error parsing company data:', error);
  }

  return companyData;
}