/**
 * Comment Strategy System
 * Defines available strategies and selects the best ones based on post classification.
 */

const STRATEGIES = {
  ask_question: {
    id: 'ask_question',
    label: 'Ask a Thoughtful Question',
    description: 'Ask a genuine question that shows engagement and invites deeper discussion',
    risk: 'low',
    works_well_with: ['thought_leadership', 'opinion', 'news_commentary', 'informative', 'provocative'],
    avoid_with: ['hiring', 'job_search', 'meme'],
  },
  add_value: {
    id: 'add_value',
    label: 'Add Value / Insight',
    description: 'Contribute a new angle, data point, or complementary insight',
    risk: 'low',
    works_well_with: ['thought_leadership', 'product_launch', 'news_commentary', 'informative', 'update'],
    avoid_with: ['meme', 'rant', 'personal_story'],
  },
  share_experience: {
    id: 'share_experience',
    label: 'Share Related Experience',
    description: 'Briefly share a relevant personal experience that adds to the conversation',
    risk: 'low',
    works_well_with: ['personal_story', 'milestone', 'opinion', 'reflective', 'seeking_help'],
    avoid_with: ['hiring', 'poll', 'sponsored_content'],
  },
  respectful_disagree: {
    id: 'respectful_disagree',
    label: 'Respectful Disagreement',
    description: 'Offer a polite counter-perspective with reasoning',
    risk: 'medium',
    works_well_with: ['opinion', 'controversy', 'thought_leadership', 'provocative'],
    avoid_with: ['milestone', 'personal_story', 'hiring', 'job_search', 'celebrating'],
  },
  amplify: {
    id: 'amplify',
    label: 'Amplify Key Point',
    description: 'Highlight and expand on the most important takeaway',
    risk: 'low',
    works_well_with: ['thought_leadership', 'news_commentary', 'update', 'product_launch', 'informative'],
    avoid_with: ['meme', 'rant'],
  },
  offer_help: {
    id: 'offer_help',
    label: 'Offer Help / Resource',
    description: 'Suggest a helpful resource, tool, or offer direct assistance',
    risk: 'low',
    works_well_with: ['seeking_help', 'recommendation_request', 'job_search', 'frustrated'],
    avoid_with: ['meme', 'celebrating', 'milestone'],
  },
  congratulate: {
    id: 'congratulate',
    label: 'Genuine Congratulations',
    description: 'Celebrate their achievement with specific, non-generic acknowledgment',
    risk: 'low',
    works_well_with: ['milestone', 'product_launch', 'celebrating'],
    avoid_with: ['rant', 'controversy', 'frustrated', 'job_search'],
  },
  challenge: {
    id: 'challenge',
    label: 'Constructive Challenge',
    description: 'Push back on an assumption or ask a hard question',
    risk: 'high',
    works_well_with: ['thought_leadership', 'opinion', 'controversy', 'provocative'],
    avoid_with: ['milestone', 'personal_story', 'hiring', 'job_search', 'celebrating', 'seeking_help'],
  },
  bridge: {
    id: 'bridge',
    label: 'Bridge to Related Topic',
    description: 'Connect the post to a related trend, concept, or domain',
    risk: 'low',
    works_well_with: ['thought_leadership', 'news_commentary', 'opinion', 'informative'],
    avoid_with: ['personal_story', 'meme', 'rant'],
  },
};

/**
 * Score a strategy against a post classification.
 * Higher score = better fit.
 */
function scoreStrategy(strategy, classification) {
  let score = 0;
  const { post_type, emotional_state, sensitivity_flag } = classification;

  // Positive match: strategy works well with this post type or emotional state
  if (strategy.works_well_with.includes(post_type)) score += 3;
  if (strategy.works_well_with.includes(emotional_state)) score += 2;

  // Negative match: strategy should be avoided
  if (strategy.avoid_with.includes(post_type)) score -= 5;
  if (strategy.avoid_with.includes(emotional_state)) score -= 3;

  // Sensitivity penalty for risky strategies
  if (sensitivity_flag) {
    if (strategy.risk === 'high') score -= 10;
    if (strategy.risk === 'medium') score -= 4;
  }

  // Bonus: if post contains a question, "add_value" and "share_experience" are good fits
  if (classification.contains_question) {
    if (strategy.id === 'add_value') score += 2;
    if (strategy.id === 'share_experience') score += 2;
    if (strategy.id === 'offer_help') score += 2;
  }

  return score;
}

/**
 * Select the 3 best strategies for a given post classification.
 * Returns: [safe, alternative, bold] — ordered by ascending risk.
 *
 * @param {Object} classification - Output from classifyPost()
 * @returns {Object} { safe: Strategy, alternative: Strategy, bold: Strategy }
 */
export function selectStrategies(classification) {
  const scored = Object.values(STRATEGIES)
    .map(strategy => ({ strategy, score: scoreStrategy(strategy, classification) }))
    .filter(({ score }) => score > -3) // filter out terrible fits
    .sort((a, b) => b.score - a.score);

  // Pick best low-risk as "safe"
  const safe = scored.find(s => s.strategy.risk === 'low')?.strategy || scored[0]?.strategy;

  // Pick best medium or different low-risk as "alternative"
  const alternative = scored.find(
    s => s.strategy.id !== safe.id && (s.strategy.risk === 'low' || s.strategy.risk === 'medium')
  )?.strategy || scored[1]?.strategy;

  // Pick highest-risk viable option as "bold"
  const bold = scored.find(
    s => s.strategy.id !== safe.id && s.strategy.id !== alternative.id
  )?.strategy || scored[2]?.strategy;

  return {
    safe: safe || STRATEGIES.add_value,
    alternative: alternative || STRATEGIES.ask_question,
    bold: bold || STRATEGIES.challenge,
  };
}

export { STRATEGIES };
