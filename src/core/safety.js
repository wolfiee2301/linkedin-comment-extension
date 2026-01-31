/**
 * Safety & Quality Checks
 * Validates generated comments against word limits, forbidden patterns,
 * brand safety rules, and specificity requirements.
 *
 * Returns approve/rewrite/reject status per comment.
 * Generates ultra-safe fallback if all 3 are rejected.
 */

const MAX_WORDS = 30;

// ---- Forbidden Patterns (NEVER use) ----

const FORBIDDEN_PATTERNS = [
  // Generic filler — exact phrases from spec
  { pattern: /\bgreat post\b/i, label: 'generic: "Great post"' },
  { pattern: /\bthanks for sharing\b/i, label: 'generic: "Thanks for sharing"' },
  { pattern: /\blove this\b/i, label: 'generic: "Love this"' },
  { pattern: /\bso true\b/i, label: 'generic: "So true"' },
  { pattern: /\bwell said\b/i, label: 'generic: "Well said"' },
  { pattern: /\bcouldn't agree more\b/i, label: 'generic: "Couldn\'t agree more"' },
  { pattern: /\bthis resonates\b/i, label: 'generic: "This resonates"' },
  { pattern: /\babsolutely\b/i, label: 'generic: "Absolutely"' },
  { pattern: /\bspot on\b/i, label: 'generic: "Spot on"' },
  { pattern: /\bnailed it\b/i, label: 'generic: "Nailed it"' },
  { pattern: /\bamazing post\b/i, label: 'generic: "Amazing post"' },
  { pattern: /\b100%\b/i, label: 'generic: "100%"' },

  // Generic questions
  { pattern: /\bwhat do you think\?\s*$/i, label: 'generic question: "What do you think?"' },
  { pattern: /\bthoughts\?\s*$/i, label: 'generic question: "Thoughts?"' },
  { pattern: /\bagree\?\s*$/i, label: 'generic question: "Agree?"' },

  // Template language
  { pattern: /\bas a \w+,\s*I\b/i, label: 'template: "As a [role], I..."' },

  // Hashtags (anywhere)
  { pattern: /#\w+/, label: 'contains hashtag' },

  // Multiple exclamation marks
  { pattern: /!{2,}/, label: 'multiple exclamation marks' },

  // Self-promotion
  { pattern: /\bcheck out my\b/i, label: 'self-promotion' },
  { pattern: /\bfollow me\b/i, label: 'self-promotion' },
  { pattern: /\blink in bio\b/i, label: 'self-promotion' },
  { pattern: /\bdm me\b/i, label: 'self-promotion' },
  { pattern: /\bbook a call\b/i, label: 'self-promotion' },

  // AI-sounding filler
  { pattern: /\bas an ai\b/i, label: 'AI language' },
  { pattern: /\bin today's digital landscape\b/i, label: 'AI language' },
  { pattern: /\bleverage\b/i, label: 'corporate jargon: "leverage"' },
  { pattern: /\bsynergy\b/i, label: 'corporate jargon: "synergy"' },
  { pattern: /\bgame[ -]?changer\b/i, label: 'corporate jargon: "game-changer"' },
  { pattern: /\bthought leader\b/i, label: 'corporate jargon: "thought leader"' },

  // Excessive emojis (3+ consecutive)
  { pattern: /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]{3,}/u, label: 'excessive emojis' },
];

// ---- Brand Safety / Offensive ----

const BRAND_SAFETY_PATTERNS = [
  // Offensive
  { pattern: /\bstupid\b/i, category: 'offensive' },
  { pattern: /\bidiot\b/i, category: 'offensive' },
  { pattern: /\bdumb\b/i, category: 'offensive' },

  // Profanity placeholders (extend as needed)
  { pattern: /\bwtf\b/i, category: 'profanity' },
  { pattern: /\bbs\b/i, category: 'profanity' },

  // Defamatory
  { pattern: /\bscam\b/i, category: 'defamatory' },
  { pattern: /\bfraud\b/i, category: 'defamatory' },
  { pattern: /\blying\b/i, category: 'defamatory' },

  // Political (partisan)
  { pattern: /\bleft[ -]?wing\b/i, category: 'political' },
  { pattern: /\bright[ -]?wing\b/i, category: 'political' },
  { pattern: /\bliberal\b/i, category: 'political' },
  { pattern: /\bconservative\b/i, category: 'political' },

  // Competitor attacks
  { pattern: /\bis (dead|dying|terrible|awful)\b/i, category: 'competitor_attack' },
];

// ---- Generics: could-be-pasted-on-any-post test ----

const ULTRA_GENERIC_PATTERNS = [
  /^(this|yes|no|exactly|agree|true|same)[.!]*$/i,
  /^(interesting|fascinating|insightful)[.!]*$/i,
  /^thanks?[.!]*$/i,
];

/**
 * Check if a comment is too generic (could be copy-pasted to any post).
 */
function isUltraGeneric(text) {
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length <= 3) return true;
  return ULTRA_GENERIC_PATTERNS.some(p => p.test(trimmed));
}

/**
 * Run all quality + safety checks on a single comment.
 *
 * Returns:
 * {
 *   status: 'approve' | 'rewrite' | 'reject',
 *   issues: { severity: 'minor'|'major', message: string }[],
 *   wordCount: number,
 *   riskScore: number (0-100),
 *   riskLabel: 'safe' | 'moderate' | 'risky',
 * }
 */
export function checkComment(text, classification) {
  const issues = [];

  // ---- Quality Checks ----

  const wordCount = text.trim().split(/\s+/).length;

  // Empty
  if (text.trim().length === 0) {
    issues.push({ severity: 'major', message: 'Comment is empty' });
  }

  // Word limit
  if (wordCount > MAX_WORDS) {
    issues.push({ severity: 'minor', message: `Too long: ${wordCount} words (max ${MAX_WORDS})` });
  }

  // Forbidden patterns
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({ severity: 'major', message: `Forbidden: ${label}` });
    }
  }

  // Ultra-generic test
  if (isUltraGeneric(text)) {
    issues.push({ severity: 'major', message: 'Too generic — could be pasted on any post' });
  }

  // Emoji count (max 1)
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 1) {
    issues.push({ severity: 'minor', message: `Too many emojis: ${emojiCount} (max 1)` });
  }

  // ---- Safety Checks ----

  const brandHits = [];
  for (const { pattern, category } of BRAND_SAFETY_PATTERNS) {
    if (pattern.test(text)) {
      brandHits.push(category);
    }
  }

  if (brandHits.includes('profanity')) {
    issues.push({ severity: 'major', message: 'Contains profanity' });
  }
  if (brandHits.includes('offensive')) {
    issues.push({ severity: 'major', message: 'Contains offensive language' });
  }
  if (brandHits.includes('defamatory')) {
    issues.push({ severity: 'major', message: 'Potentially defamatory language' });
  }
  if (brandHits.includes('political')) {
    issues.push({ severity: 'major', message: 'Contains partisan political language' });
  }
  if (brandHits.includes('competitor_attack')) {
    issues.push({ severity: 'minor', message: 'May read as a competitor attack' });
  }

  // Sensitivity override: sensitive posts require supportive tone only
  if (classification?.sensitivity_flag) {
    // Flag as needing approval even if otherwise clean
    issues.push({ severity: 'minor', message: 'Sensitive topic — requires approval before posting' });
  }

  // ---- Compute Status ----

  const majorCount = issues.filter(i => i.severity === 'major').length;
  const minorCount = issues.filter(i => i.severity === 'minor').length;

  let status;
  if (majorCount >= 2) {
    status = 'reject';
  } else if (majorCount === 1) {
    status = 'rewrite';
  } else if (minorCount >= 3) {
    status = 'rewrite';
  } else {
    status = 'approve';
  }

  // ---- Risk Score ----

  let riskScore = 0;
  riskScore += majorCount * 25;
  riskScore += minorCount * 10;
  if (classification?.sensitivity_flag) riskScore += 20;
  for (const hit of brandHits) {
    if (hit === 'profanity' || hit === 'offensive') riskScore += 25;
    else riskScore += 15;
  }
  riskScore = Math.min(100, riskScore);

  return {
    status,
    issues,
    wordCount,
    riskScore,
    riskLabel: riskScore <= 15 ? 'safe' : riskScore <= 40 ? 'moderate' : 'risky',
  };
}

/**
 * Run safety checks on all 3 generated comments.
 * If all 3 are rejected, returns an ultra-safe fallback instruction.
 *
 * @param {Object[]} comments - Array of { text, strategy, label, ... }
 * @param {Object} classification - From classifyPost()
 * @returns {Object} { results: [...], allRejected: boolean, fallbackNeeded: boolean }
 */
export function checkAllComments(comments, classification) {
  const results = comments.map(comment => ({
    ...comment,
    safety: checkComment(comment.text, classification),
  }));

  const allRejected = results.every(r => r.safety.status === 'reject');

  return {
    results,
    allRejected,
    fallbackNeeded: allRejected,
  };
}

/**
 * Build an ultra-safe fallback comment prompt instruction.
 * Used when all 3 generated options are rejected.
 */
export function buildFallbackInstruction(classification) {
  return `ALL previous comments were rejected by safety checks. Generate ONE ultra-safe comment:
- Use ONLY the "ask_question" strategy
- Risk level: safe
- Tone: curious or supportive ONLY
- Must be under 20 words
- Must reference a specific detail from the post
- Zero controversy, zero opinion, zero humor
- Post type: ${classification.post_type}, Sensitivity: ${classification.sensitivity_flag ? 'YES' : 'No'}`;
}

// Backward-compatible exports
export function validateComment(text) {
  const result = checkComment(text, null);
  return {
    valid: result.status === 'approve',
    issues: result.issues.map(i => i.message),
    wordCount: result.wordCount,
  };
}

export function computeRiskScore(text, classification) {
  return checkComment(text, classification).riskScore;
}

export function riskLabel(score) {
  if (score <= 15) return 'safe';
  if (score <= 40) return 'moderate';
  return 'risky';
}

export { MAX_WORDS, FORBIDDEN_PATTERNS, BRAND_SAFETY_PATTERNS };
