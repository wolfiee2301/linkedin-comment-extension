/**
 * Post Classification Engine
 * Classifies LinkedIn posts by type, author, sentiment, sensitivity, and more.
 * Returns structured JSON for prompt construction.
 */

const POST_TYPES = [
  'hiring', 'product_launch', 'thought_leadership', 'opinion', 'event',
  'rant', 'meme', 'update', 'milestone', 'personal_story', 'controversy',
  'news_commentary', 'job_search', 'recommendation_request', 'poll',
  'repost_with_commentary', 'miscellaneous',
];

const AUTHOR_TYPES = [
  'founder', 'ceo', 'cto', 'cmo', 'vp_sales', 'engineer', 'designer',
  'marketer', 'sales', 'recruiter', 'investor', 'educator', 'creator',
  'consultant', 'student', 'normal_person',
];

const EMOTIONAL_STATES = [
  'celebrating', 'frustrated', 'seeking_help', 'informative',
  'provocative', 'reflective', 'humorous',
];

const SENSITIVITY_TRIGGERS = [
  'layoff', 'laid off', 'let go', 'fired', 'lost my job', 'job loss',
  'mental health', 'depression', 'anxiety', 'burnout',
  'passed away', 'death', 'died', 'rip', 'in memory',
  'politics', 'political', 'election', 'democrat', 'republican',
  'trauma', 'abuse', 'harassment', 'discrimination',
  'lawsuit', 'legal action', 'sued', 'court',
  'suicide', 'self-harm',
];

const SPONSORED_SIGNALS = [
  '#ad', '#sponsored', '#partner', '#promotion',
  'paid partnership', 'sponsored post', 'in partnership with',
  'brand ambassador', 'gifted', 'complimentary',
];

// ---- Keyword-based heuristic classifiers ----

const POST_TYPE_SIGNALS = {
  hiring: ['hiring', 'we\'re looking', 'open role', 'join our team', 'job opening', 'apply now', 'open position'],
  product_launch: ['launching', 'just launched', 'now live', 'introducing', 'announcing', 'new feature', 'shipped'],
  thought_leadership: ['here\'s what i\'ve learned', 'unpopular opinion', 'hot take', 'the truth about', 'most people don\'t realize'],
  opinion: ['i think', 'i believe', 'in my opinion', 'unpopular opinion', 'controversial take', 'hot take'],
  event: ['conference', 'summit', 'webinar', 'meetup', 'event', 'speaking at', 'attending'],
  rant: ['frustrated', 'sick of', 'tired of', 'stop doing', 'enough with', 'rant', 'can we stop'],
  meme: ['😂', '🤣', 'lmao', 'lol', 'tag someone', 'relatable'],
  update: ['update:', 'excited to share', 'quick update', 'sharing an update'],
  milestone: ['years at', 'anniversary', 'promoted', 'milestone', 'achievement', 'reached', 'crossed'],
  personal_story: ['my story', 'i remember when', 'years ago', 'my journey', 'looking back', 'personal note'],
  controversy: ['disagree', 'debate', 'controversial', 'divisive', 'wrong about', 'problematic'],
  news_commentary: ['breaking', 'just reported', 'according to', 'news:', 'article:', 'study shows'],
  job_search: ['open to work', 'looking for', 'job search', 'seeking opportunities', '#opentowork', 'hire me'],
  recommendation_request: ['any recommendations', 'can anyone suggest', 'looking for suggestions', 'what do you recommend', 'anyone know a good'],
  poll: ['poll', 'vote', 'what do you think', 'a or b', 'which one'],
  repost_with_commentary: ['repost', 'resharing', 'worth sharing', 'this 👇', 'couldn\'t agree more with'],
};

const AUTHOR_TYPE_SIGNALS = {
  founder: ['founder', 'co-founder', 'cofounder'],
  ceo: ['ceo', 'chief executive'],
  cto: ['cto', 'chief technology', 'chief technical'],
  cmo: ['cmo', 'chief marketing'],
  vp_sales: ['vp sales', 'vp of sales', 'vice president sales', 'head of sales'],
  engineer: ['engineer', 'developer', 'swe', 'software'],
  designer: ['designer', 'ux', 'ui', 'product design'],
  marketer: ['marketing', 'growth', 'demand gen'],
  sales: ['sales', 'account executive', 'ae', 'bdr', 'sdr'],
  recruiter: ['recruiter', 'talent', 'hiring manager', 'people ops'],
  investor: ['investor', 'vc', 'venture', 'angel', 'partner at'],
  educator: ['professor', 'teacher', 'educator', 'lecturer', 'academic'],
  creator: ['creator', 'influencer', 'content', 'writer', 'author'],
  consultant: ['consultant', 'advisor', 'freelance', 'independent'],
  student: ['student', 'intern', 'graduating', 'university', 'college'],
};

const EMOTIONAL_SIGNALS = {
  celebrating: ['excited', 'thrilled', 'proud', 'amazing', 'incredible', '🎉', '🥳', 'congratulations', 'celebrate'],
  frustrated: ['frustrated', 'annoyed', 'disappointed', 'sick of', 'tired of', 'enough', 'unacceptable'],
  seeking_help: ['help', 'advice', 'suggestions', 'recommendations', 'anyone know', 'struggling with'],
  informative: ['here\'s how', 'guide', 'tips', 'thread', 'breakdown', 'explained', 'framework'],
  provocative: ['hot take', 'unpopular opinion', 'fight me', 'change my mind', 'controversial'],
  reflective: ['looking back', 'reflecting', 'learned', 'realized', 'journey', 'growth'],
  humorous: ['😂', '🤣', 'lol', 'lmao', 'joke', 'funny', 'humor'],
};

/**
 * Score text against a set of keyword signals.
 * Returns the key with the highest match count.
 */
function matchSignals(text, signalMap) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const [key, signals] of Object.entries(signalMap)) {
    let score = 0;
    for (const signal of signals) {
      if (lower.includes(signal)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }

  return best;
}

/**
 * Check if text contains a question (simple heuristic).
 */
function containsQuestion(text) {
  return text.includes('?') ||
    /\b(what|how|why|when|where|who|which|can anyone|does anyone|any suggestions)\b/i.test(text);
}

/**
 * Check for sensitivity flags.
 */
function detectSensitivity(text) {
  const lower = text.toLowerCase();
  return SENSITIVITY_TRIGGERS.some(trigger => lower.includes(trigger));
}

/**
 * Check for sponsored content.
 */
function detectSponsored(text) {
  const lower = text.toLowerCase();
  return SPONSORED_SIGNALS.some(signal => lower.includes(signal));
}

/**
 * Classify a LinkedIn post from scraped data.
 *
 * @param {Object} postData - Scraped post data
 * @param {string} postData.text - The post body text
 * @param {string} postData.authorName - Author display name
 * @param {string} postData.authorHeadline - Author headline/title
 * @param {number} postData.likes - Like count
 * @param {number} postData.comments - Comment count
 * @param {number} postData.reposts - Repost count
 * @returns {Object} Classification result
 */
export function classifyPost(postData) {
  const { text, authorHeadline } = postData;

  const postType = matchSignals(text, POST_TYPE_SIGNALS) || 'miscellaneous';
  const authorType = matchSignals(authorHeadline || '', AUTHOR_TYPE_SIGNALS) || 'normal_person';
  const emotionalState = matchSignals(text, EMOTIONAL_SIGNALS) || 'informative';

  return {
    post_type: postType,
    author_type: authorType,
    emotional_state: emotionalState,
    sensitivity_flag: detectSensitivity(text),
    contains_question: containsQuestion(text),
    sponsored_content: detectSponsored(text),
  };
}

export {
  POST_TYPES,
  AUTHOR_TYPES,
  EMOTIONAL_STATES,
  SENSITIVITY_TRIGGERS,
};
