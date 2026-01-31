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
  // Layoffs / job loss
  'layoff', 'laid off', 'let go', 'fired', 'lost my job', 'job loss',
  'downsizing', 'restructuring', 'reduction in force', 'rif',
  // Mental health
  'mental health', 'depression', 'anxiety', 'burnout', 'therapy',
  'panic attack', 'ptsd', 'bipolar', 'adhd struggle',
  // Death
  'passed away', 'death', 'died', 'rip', 'in memory', 'funeral',
  'grief', 'mourning', 'lost my',
  // Politics
  'politics', 'political', 'election', 'democrat', 'republican',
  'congress', 'senate', 'president', 'partisan', 'voting rights',
  // Trauma
  'trauma', 'abuse', 'harassment', 'discrimination', 'assault',
  'bullying', 'toxic workplace', 'hostile work environment',
  // Legal
  'lawsuit', 'legal action', 'sued', 'court', 'litigation',
  'settlement', 'class action', 'regulatory',
  // Other sensitive
  'suicide', 'self-harm', 'addiction', 'substance abuse',
  'miscarriage', 'divorce', 'bankruptcy',
];

const SPONSORED_SIGNALS = [
  '#ad', '#sponsored', '#partner', '#promotion', '#brandpartner',
  'paid partnership', 'sponsored post', 'in partnership with',
  'brand ambassador', 'gifted', 'complimentary',
  'sponsored by', 'brought to you by', 'powered by',
  'affiliate', 'discount code', 'use my code', 'promo code',
];

// ---- Keyword-based heuristic classifiers ----

const POST_TYPE_SIGNALS = {
  hiring: [
    'hiring', 'we\'re looking', 'open role', 'join our team', 'job opening',
    'apply now', 'open position', 'we\'re hiring', 'come work with',
    'looking for a', 'roles open', 'talent needed',
  ],
  product_launch: [
    'launching', 'just launched', 'now live', 'introducing', 'announcing',
    'new feature', 'shipped', 'went live', 'just released', 'v1', 'v2',
    'product hunt', 'beta launch', 'early access',
  ],
  thought_leadership: [
    'here\'s what i\'ve learned', 'unpopular opinion', 'hot take',
    'the truth about', 'most people don\'t realize', 'after years of',
    'the problem with', 'nobody talks about', 'here\'s the thing',
    'lessons from', 'a thread on', 'what i wish i knew',
  ],
  opinion: [
    'i think', 'i believe', 'in my opinion', 'unpopular opinion',
    'controversial take', 'hot take', 'here\'s why', 'am i wrong',
    'change my mind', 'i\'m convinced',
  ],
  event: [
    'conference', 'summit', 'webinar', 'meetup', 'event', 'speaking at',
    'attending', 'keynote', 'workshop', 'panel discussion', 'hackathon',
  ],
  rant: [
    'frustrated', 'sick of', 'tired of', 'stop doing', 'enough with',
    'rant', 'can we stop', 'i\'m done with', 'pet peeve', 'drives me crazy',
    'why do people', 'seriously though',
  ],
  meme: [
    '😂', '🤣', 'lmao', 'lol', 'tag someone', 'relatable',
    'iykyk', 'no cap', 'me when', 'pov:',
  ],
  update: [
    'update:', 'excited to share', 'quick update', 'sharing an update',
    'news:', 'announcement', 'some exciting news',
  ],
  milestone: [
    'years at', 'anniversary', 'promoted', 'milestone', 'achievement',
    'reached', 'crossed', 'hit the mark', 'new role', 'officially',
    'thrilled to announce', 'new chapter',
  ],
  personal_story: [
    'my story', 'i remember when', 'years ago', 'my journey',
    'looking back', 'personal note', 'vulnerable post', 'honest moment',
    'confession', 'true story', 'a year ago today',
  ],
  controversy: [
    'disagree', 'debate', 'controversial', 'divisive', 'wrong about',
    'problematic', 'pushback', 'double standard', 'hypocrisy',
  ],
  news_commentary: [
    'breaking', 'just reported', 'according to', 'news:', 'article:',
    'study shows', 'research says', 'new data', 'report shows',
    'source:', 'via @',
  ],
  job_search: [
    'open to work', 'looking for', 'job search', 'seeking opportunities',
    '#opentowork', 'hire me', 'available for', 'actively seeking',
    'on the market', 'my resume', 'let me know if',
  ],
  recommendation_request: [
    'any recommendations', 'can anyone suggest', 'looking for suggestions',
    'what do you recommend', 'anyone know a good', 'best tool for',
    'what do you use for', 'seeking advice on',
  ],
  poll: [
    'poll', 'vote', 'what do you think', 'a or b', 'which one',
    'let me know in the comments', 'drop your answer',
  ],
  repost_with_commentary: [
    'repost', 'resharing', 'worth sharing', 'this 👇',
    'couldn\'t agree more with', 'signal boost', 'must read',
    'read this', 'sharing because',
  ],
};

const AUTHOR_TYPE_SIGNALS = {
  founder: ['founder', 'co-founder', 'cofounder', 'built', 'started'],
  ceo: ['ceo', 'chief executive', 'chief exec'],
  cto: ['cto', 'chief technology', 'chief technical', 'vp engineering', 'vp of engineering'],
  cmo: ['cmo', 'chief marketing', 'chief growth'],
  vp_sales: ['vp sales', 'vp of sales', 'vice president sales', 'head of sales', 'chief revenue'],
  engineer: ['engineer', 'developer', 'swe', 'software', 'programmer', 'backend', 'frontend', 'full stack'],
  designer: ['designer', 'ux', 'ui', 'product design', 'creative director', 'design lead'],
  marketer: ['marketing', 'growth', 'demand gen', 'brand manager', 'content marketing'],
  sales: ['sales', 'account executive', 'ae', 'bdr', 'sdr', 'business development'],
  recruiter: ['recruiter', 'talent', 'hiring manager', 'people ops', 'talent acquisition'],
  investor: ['investor', 'vc', 'venture', 'angel', 'partner at', 'managing partner', 'general partner'],
  educator: ['professor', 'teacher', 'educator', 'lecturer', 'academic', 'phd'],
  creator: ['creator', 'influencer', 'content', 'writer', 'author', 'blogger', 'podcaster'],
  consultant: ['consultant', 'advisor', 'freelance', 'independent', 'fractional'],
  student: ['student', 'intern', 'graduating', 'university', 'college', 'class of'],
};

const EMOTIONAL_SIGNALS = {
  celebrating: [
    'excited', 'thrilled', 'proud', 'amazing', 'incredible', '🎉', '🥳',
    'congratulations', 'celebrate', 'grateful', 'blessed', 'dream come true',
    'can\'t believe', 'pinch me',
  ],
  frustrated: [
    'frustrated', 'annoyed', 'disappointed', 'sick of', 'tired of',
    'enough', 'unacceptable', 'broken', 'awful', 'ridiculous',
    'makes no sense', 'why is it so hard',
  ],
  seeking_help: [
    'help', 'advice', 'suggestions', 'recommendations', 'anyone know',
    'struggling with', 'stuck on', 'need guidance', 'how do you handle',
    'what would you do',
  ],
  informative: [
    'here\'s how', 'guide', 'tips', 'thread', 'breakdown', 'explained',
    'framework', 'step by step', 'tutorial', 'how to', 'cheat sheet',
    'playbook',
  ],
  provocative: [
    'hot take', 'unpopular opinion', 'fight me', 'change my mind',
    'controversial', 'i said what i said', 'bold claim', 'hear me out',
  ],
  reflective: [
    'looking back', 'reflecting', 'learned', 'realized', 'journey',
    'growth', 'hindsight', 'in retrospect', 'lessons from',
  ],
  humorous: [
    '😂', '🤣', 'lol', 'lmao', 'joke', 'funny', 'humor',
    'plot twist', 'narrator:', 'spoiler:', '10/10',
  ],
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
    /\b(what|how|why|when|where|who|which|can anyone|does anyone|any suggestions|any thoughts)\b/i.test(text);
}

/**
 * Check for sensitivity flags. Returns { flag: boolean, triggers: string[] }.
 */
function detectSensitivity(text) {
  const lower = text.toLowerCase();
  const matched = SENSITIVITY_TRIGGERS.filter(trigger => lower.includes(trigger));
  return {
    flag: matched.length > 0,
    triggers: matched,
  };
}

/**
 * Check for sponsored content.
 */
function detectSponsored(text) {
  const lower = text.toLowerCase();
  return SPONSORED_SIGNALS.some(signal => lower.includes(signal));
}

/**
 * Compute engagement heat level from metrics.
 * Returns 'cold' | 'warm' | 'hot' | 'viral'.
 */
export function computeEngagementHeat(postData) {
  const total = (postData.likes || 0) + (postData.comments || 0) * 3 + (postData.reposts || 0) * 2;
  if (total < 10) return 'cold';
  if (total < 100) return 'warm';
  if (total < 1000) return 'hot';
  return 'viral';
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
  const sensitivity = detectSensitivity(text);

  return {
    post_type: postType,
    author_type: authorType,
    emotional_state: emotionalState,
    sensitivity_flag: sensitivity.flag,
    sensitivity_triggers: sensitivity.triggers,
    contains_question: containsQuestion(text),
    sponsored_content: detectSponsored(text),
    engagement_heat: computeEngagementHeat(postData),
  };
}

export {
  POST_TYPES,
  AUTHOR_TYPES,
  EMOTIONAL_STATES,
  SENSITIVITY_TRIGGERS,
};
