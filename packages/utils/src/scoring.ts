/**
 * Rubric scoring system for evaluating AI-generated responses.
 * Used to determine when an answer is "truthy" enough to accept in baton mode.
 */

export interface RubricScores {
  relevance: number;    // 0..1 - How well the answer addresses the question
  correctness: number;  // 0..1 - Factual accuracy and logical soundness
  completeness: number; // 0..1 - Thoroughness of the answer
  clarity: number;      // 0..1 - How clear and understandable the answer is
  brevity: number;      // 0..1 - Conciseness (higher is tighter)
}

/**
 * Calculate weighted score from rubric dimensions.
 * 
 * Weights:
 * - Relevance: 25% - Must address the actual question
 * - Correctness: 30% - Most important: must be factually accurate
 * - Completeness: 20% - Should cover necessary details
 * - Clarity: 15% - Should be understandable
 * - Brevity: 10% - Nice to have: concise answers preferred
 * 
 * @param r RubricScores object with values from 0 to 1
 * @returns Weighted score from 0 to 1
 */
export const scoreOf = (r: RubricScores): number => {
  return (
    0.25 * r.relevance +
    0.30 * r.correctness +
    0.20 * r.completeness +
    0.15 * r.clarity +
    0.10 * r.brevity
  );
};

/**
 * Default truthiness threshold.
 * Answers must score at least 0.70 to be considered acceptable.
 */
export const TRUTHINESS_THRESHOLD = 0.70;

/**
 * Minimum improvement delta required for a revision to be worthwhile.
 * If an improved answer doesn't score at least DELTA_GAIN higher,
 * the revision isn't considered beneficial.
 */
export const DELTA_GAIN = 0.07;

/**
 * Effective acceptance threshold when requiring improvement.
 * An answer must score at least this high to pass the quality bar
 * and justify stopping the baton chain.
 */
export const ACCEPTANCE_THRESHOLD = TRUTHINESS_THRESHOLD + DELTA_GAIN; // 0.77
