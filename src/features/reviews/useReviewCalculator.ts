
import { GENRE_WEIGHTS, SCORE_SUGGESTIONS, CASUAL_CRITERIA } from './constants';

interface ReviewCalculatorResult {
  average: number;
  label: string;
  suggestedRange: string;
}

export const useReviewCalculator = () => {
  
  const getSuggestion = (avg: number) => {
    if (typeof avg !== 'number' || isNaN(avg)) return SCORE_SUGGESTIONS[SCORE_SUGGESTIONS.length - 1];
    return SCORE_SUGGESTIONS.find(s => avg >= s.min) || SCORE_SUGGESTIONS[SCORE_SUGGESTIONS.length - 1];
  };

  const getCombinedWeights = (genreIds: string[]): Record<string, number> => {
    // Safety check
    if (!Array.isArray(genreIds)) return GENRE_WEIGHTS['Standard'];

    // 1. Filter: Only keep IDs that actually exist in our constants map
    const activeIds = genreIds.filter(id => GENRE_WEIGHTS[id]);
    
    // 2. Fallback: If no known IDs, use 'Standard'
    if (activeIds.length === 0) activeIds.push('Standard');
    
    // 3. Average the weights
    const averagedWeights: Record<string, number> = {};
    // Safely get keys from Standard template
    const criteriaKeys = Object.keys(GENRE_WEIGHTS['Standard'] || {});

    criteriaKeys.forEach(key => {
        let sum = 0;
        let count = 0;

        activeIds.forEach(id => {
            const w = GENRE_WEIGHTS[id] || GENRE_WEIGHTS['Standard'];
            // Ensure w exists and has the key
            if (w && typeof w[key] === 'number') {
                sum += w[key];
                count++;
            }
        });

        averagedWeights[key] = count > 0 ? sum / count : 0;
    });

    return averagedWeights;
  };

  const calculateCriticalScore = (
    genreIds: string[], 
    scores: Record<string, number>
  ): ReviewCalculatorResult => {
    
    const weights = getCombinedWeights(genreIds);

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(scores).forEach(([id, score]) => {
      const weight = weights[id] || 0; 
      if (weight > 0) {
        totalScore += score * weight;
        totalWeight += weight;
      }
    });

    const average = totalWeight > 0 ? totalScore / totalWeight : 0;
    const roundedAvg = Math.round(average * 100) / 100;
    const suggestion = getSuggestion(average);

    return {
      average: roundedAvg,
      label: suggestion.label,
      suggestedRange: suggestion.range
    };
  };

  const calculateCasualScore = (scores: Record<string, number>): ReviewCalculatorResult => {
    const relevantScores = CASUAL_CRITERIA.map(c => scores[c.id]).filter(v => typeof v === 'number');
    
    if (relevantScores.length === 0) return { average: 0, label: 'N/A', suggestedRange: '0.0' };

    const sum = relevantScores.reduce((a, b) => a + b, 0);
    const average = sum / relevantScores.length;
    const suggestion = getSuggestion(average);

    return {
      average: Math.round(average * 100) / 100,
      label: suggestion.label,
      suggestedRange: suggestion.range
    };
  };

  return { calculateCriticalScore, calculateCasualScore, getCombinedWeights };
};
