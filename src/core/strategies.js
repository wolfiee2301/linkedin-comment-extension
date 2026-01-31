/**
 * Comment Strategy System
 * Defines available actions and selects the best ones based on post classification.
 * Returns strategy JSON with recommended_action, alternatives, tone_range, and rationale.
 */

const STRATEGIES = {
  add_value: {
    id: 'add_value',
    label: 'Add Value / Insight',
    description: 'Share a complementary insight, data point, or new angle on the topic',
    risk_levels: ['safe', 'moderate'],
    works_well_with: {
      post_types: ['thought_leadership', 'news_commentary', 'product_launch', 'update', 'informative'],
      emotional_states: ['informative', 'reflective'],
      engagement_heat: ['warm', 'hot'],
    },
    avoid_with: {
      post_types: ['meme', 'rant', 'personal_story'],
      emotional_states: ['frustrated', 'humorous'],
    },
    allow_links: false,
  },
  ask_question: {
    id: 'ask_question',
    label: 'Ask a Specific Question',
    description: 'Ask a specific, open-ended question that deepens the conversation',
    risk_levels: ['safe', 'moderate'],
    works_well_with: {
      post_types: ['thought_leadership', 'opinion', 'news_commentary', 'rant', 'controversy'],
      emotional_states: ['informative', 'provocative', 'frustrated'],
      engagement_heat: ['cold', 'warm'],
    },
    avoid_with: {
      post_types: ['hiring', 'job_search', 'meme'],
      emotional_states: ['celebrating'],
    },
    allow_links: false,
  },
  praise: {
    id: 'praise',
    label: 'Acknowledge Achievement',
    description: 'Celebrate their accomplishment with specific, non-generic acknowledgment',
    risk_levels: ['safe'],
    works_well_with: {
      post_types: ['milestone', 'product_launch', 'update'],
      emotional_states: ['celebrating'],
      engagement_heat: ['warm', 'hot', 'viral'],
    },
    avoid_with: {
      post_types: ['rant', 'controversy', 'job_search'],
      emotional_states: ['frustrated', 'provocative'],
    },
    allow_links: false,
  },
  share_experience: {
    id: 'share_experience',
    label: 'Share Related Experience',
    description: 'Briefly share a relevant personal story that adds to the conversation',
    risk_levels: ['safe', 'moderate'],
    works_well_with: {
      post_types: ['personal_story', 'milestone', 'opinion', 'recommendation_request'],
      emotional_states: ['reflective', 'seeking_help', 'celebrating'],
      engagement_heat: ['warm', 'hot'],
    },
    avoid_with: {
      post_types: ['hiring', 'poll', 'meme'],
      emotional_states: [],
    },
    allow_links: false,
  },
  challenge_respectfully: {
    id: 'challenge_respectfully',
    label: 'Respectful Challenge',
    description: 'Offer a polite contrarian view with reasoning — pushes the conversation forward',
    risk_levels: ['moderate', 'bold'],
    works_well_with: {
      post_types: ['opinion', 'thought_leadership', 'controversy', 'news_commentary'],
      emotional_states: ['provocative', 'informative'],
      engagement_heat: ['hot', 'viral'],
    },
    avoid_with: {
      post_types: ['milestone', 'personal_story', 'hiring', 'job_search'],
      emotional_states: ['celebrating', 'seeking_help', 'frustrated'],
    },
    allow_links: false,
  },
  amplify_and_extend: {
    id: 'amplify_and_extend',
    label: 'Amplify & Extend',
    description: 'Quote or reference a key point from the post and add your own perspective',
    risk_levels: ['safe', 'moderate'],
    works_well_with: {
      post_types: ['thought_leadership', 'news_commentary', 'update', 'product_launch', 'repost_with_commentary'],
      emotional_states: ['informative', 'reflective'],
      engagement_heat: ['warm', 'hot', 'viral'],
    },
    avoid_with: {
      post_types: ['meme', 'rant', 'poll'],
      emotional_states: ['humorous'],
    },
    allow_links: false,
  },
};

// ---- Decision Logic: Specific Scenario Rules ----

const SCENARIO_OVERRIDES = [
  {
    // hiring post + low engagement → ask about process
    match: (c) => c.post_type === 'hiring' && c.engagement_heat === 'cold',
    force: { primary: 'ask_question', rationale: 'Low-engagement hiring post benefits from a genuine question about the role or process' },
  },
  {
    // thought_leadership + high engagement → add value
    match: (c) => c.post_type === 'thought_leadership' && (c.engagement_heat === 'hot' || c.engagement_heat === 'viral'),
    force: { primary: 'add_value', rationale: 'High-engagement thought leadership needs a unique insight to stand out' },
  },
  {
    // milestone → praise or share experience
    match: (c) => c.post_type === 'milestone',
    force: { primary: 'praise', alternatives: ['share_experience'], rationale: 'Milestones call for specific acknowledgment or a shared parallel experience' },
  },
  {
    // rant + frustrated → clarifying question (not defensive)
    match: (c) => c.post_type === 'rant' && c.emotional_state === 'frustrated',
    force: { primary: 'ask_question', rationale: 'Frustrated rant needs a clarifying, empathetic question — not pushback' },
  },
  {
    // controversy + sensitive → ultra-safe only
    match: (c) => c.post_type === 'controversy' && c.sensitivity_flag,
    force: { primary: 'ask_question', skip_bold: true, rationale: 'Sensitive controversy — only safe engagement via neutral question' },
  },
  {
    // recommendation request → share experience / add value
    match: (c) => c.post_type === 'recommendation_request',
    force: { primary: 'add_value', alternatives: ['share_experience'], rationale: 'Recommendation requests benefit from direct value or personal experience' },
  },
  {
    // job_search → supportive only
    match: (c) => c.post_type === 'job_search',
    force: { primary: 'share_experience', alternatives: ['add_value'], skip_bold: true, rationale: 'Job search posts need supportive, helpful engagement only' },
  },
];

/**
 * Score a strategy against a post classification.
 * Higher score = better fit.
 */
function scoreStrategy(strategy, classification) {
  let score = 0;
  const { post_type, emotional_state, sensitivity_flag, engagement_heat, contains_question } = classification;

  // Positive: works well with post type
  if (strategy.works_well_with.post_types.includes(post_type)) score += 4;
  // Positive: works well with emotional state
  if (strategy.works_well_with.emotional_states.includes(emotional_state)) score += 3;
  // Positive: works well with engagement heat
  if (strategy.works_well_with.engagement_heat.includes(engagement_heat)) score += 2;

  // Negative: should avoid this post type
  if (strategy.avoid_with.post_types.includes(post_type)) score -= 6;
  // Negative: should avoid this emotional state
  if (strategy.avoid_with.emotional_states.includes(emotional_state)) score -= 4;

  // Sensitivity penalty
  if (sensitivity_flag) {
    if (strategy.risk_levels.includes('bold')) score -= 8;
    if (strategy.id === 'challenge_respectfully') score -= 10;
  }

  // If post contains a question, answering strategies get a boost
  if (contains_question) {
    if (strategy.id === 'add_value') score += 3;
    if (strategy.id === 'share_experience') score += 2;
  }

  return score;
}

/**
 * Determine the risk escalation for option 3 (bold).
 * safe → moderate, moderate → bold
 */
function escalateRisk(baseRisk) {
  if (baseRisk === 'safe') return 'moderate';
  return 'bold';
}

/**
 * Compute the allowed tone range based on classification.
 */
function computeToneRange(classification) {
  const { sensitivity_flag, emotional_state, engagement_heat } = classification;

  if (sensitivity_flag) return ['supportive', 'thoughtful'];
  if (emotional_state === 'frustrated') return ['curious', 'supportive', 'thoughtful'];
  if (emotional_state === 'celebrating') return ['supportive', 'confident', 'witty'];
  if (emotional_state === 'humorous') return ['witty', 'playful', 'confident'];
  if (emotional_state === 'provocative') return ['analytical', 'confident', 'direct'];
  if (engagement_heat === 'viral') return ['analytical', 'confident', 'witty', 'opinionated'];

  return ['curious', 'analytical', 'witty', 'confident', 'thoughtful', 'direct'];
}

/**
 * Select strategies for the 3 comment options.
 *
 * Returns:
 * {
 *   primary: Strategy,       // Option 1: primary strategy, safe/moderate risk
 *   alternative: Strategy,   // Option 2: different strategy, same risk
 *   bold: Strategy,          // Option 3: primary strategy, elevated risk
 *   primary_risk: string,
 *   bold_risk: string,
 *   tone_range: string[],
 *   allow_links: boolean,
 *   rationale: string,
 *   skip_bold: boolean,
 * }
 */
export function selectStrategies(classification) {
  // Check scenario overrides first
  for (const scenario of SCENARIO_OVERRIDES) {
    if (scenario.match(classification)) {
      const primary = STRATEGIES[scenario.force.primary];
      const altIds = scenario.force.alternatives || Object.keys(STRATEGIES).filter(
        id => id !== scenario.force.primary && !STRATEGIES[id].avoid_with.post_types.includes(classification.post_type)
      );
      const alternative = STRATEGIES[altIds[0]] || STRATEGIES.ask_question;
      const skipBold = scenario.force.skip_bold || false;

      const baseRisk = primary.risk_levels[0];
      return {
        primary,
        alternative,
        bold: skipBold ? null : primary,
        primary_risk: baseRisk,
        bold_risk: skipBold ? null : escalateRisk(baseRisk),
        tone_range: computeToneRange(classification),
        allow_links: primary.allow_links,
        rationale: scenario.force.rationale,
        skip_bold: skipBold,
      };
    }
  }

  // General scoring
  const scored = Object.values(STRATEGIES)
    .map(strategy => ({ strategy, score: scoreStrategy(strategy, classification) }))
    .filter(({ score }) => score > -3)
    .sort((a, b) => b.score - a.score);

  const primary = scored[0]?.strategy || STRATEGIES.add_value;

  // Alternative: different strategy, viable risk
  const alternative = scored.find(
    s => s.strategy.id !== primary.id
  )?.strategy || STRATEGIES.ask_question;

  // Bold uses primary strategy but at elevated risk
  const baseRisk = primary.risk_levels[0];
  const skipBold = classification.sensitivity_flag && classification.post_type === 'controversy';

  return {
    primary,
    alternative,
    bold: skipBold ? null : primary,
    primary_risk: baseRisk,
    bold_risk: skipBold ? null : escalateRisk(baseRisk),
    tone_range: computeToneRange(classification),
    allow_links: primary.allow_links,
    rationale: `Best fit for ${classification.post_type} post with ${classification.engagement_heat} engagement`,
    skip_bold: skipBold,
  };
}

export { STRATEGIES, SCENARIO_OVERRIDES };
