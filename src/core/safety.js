/**
 * Safety Checks
 * Validates generated comments against word limits, forbidden patterns,
 * and brand safety rules before showing to the user.
 */

const MAX_WORDS = 30;

const FORBIDDEN_PATTERNS = [
  // Generic filler
  /\bgreat post\b/i,
  /\blove this\b/i,
  /\bso true\b/i,
  /\bthis[.!]*$/i,
  /\b100%\b/i,
  /\bcouldn't agree more\b/i,
  /\btotally agree\b/i,
  /\bwell said\b/i,
  /\bspot on\b/i,
  /\bnailed it\b/i,
  /\bbrilliant\b/i,
  /\bamazing post\b/i,
  /\bawesome\b/i,

  // Hashtags
  /#\w+/,

  // Excessive emojis (3+ consecutive)
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]{3,}/u,

  // Self-promotion patterns
  /\bcheck out my\b/i,
  /\bfollow me\b/i,
  /\blink in bio\b/i,
  /\bdm me\b/i,
  /\bbook a call\b/i,

  // AI-sounding filler
  /\bas an ai\b/i,
  /\bin today's digital landscape\b/i,
  /\bleverage\b/i,
  /\bsynergy\b/i,
  /\bgame[ -]?changer\b/i,
  /\bthought leader\b/i,
];

const BRAND_SAFETY_PATTERNS = [
  // Offensive/inflammatory
  /\bstupid\b/i,
  /\bidiot\b/i,
  /\bdumb\b/i,
  /\bterrible\b/i,
  /\bworst\b/i,

  // Potentially defamatory
  /\bscam\b/i,
  /\bfraud\b/i,
  /\blie\b/i,
  /\blying\b/i,

  // Political
  /\bleft[ -]?wing\b/i,
  /\bright[ -]?wing\b/i,
  /\bliberal\b/i,
  /\bconservative\b/i,
];

/**
 * Validate a generated comment.
 * Returns { valid: boolean, issues: string[] }
 */
export function validateComment(text) {
  const issues = [];

  // Word count check
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > MAX_WORDS) {
    issues.push(`Too long: ${wordCount} words (max ${MAX_WORDS})`);
  }

  // Empty check
  if (text.trim().length === 0) {
    issues.push('Comment is empty');
  }

  // Forbidden pattern check
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`Contains forbidden pattern: ${pattern.source}`);
    }
  }

  // Brand safety check
  const brandIssues = [];
  for (const pattern of BRAND_SAFETY_PATTERNS) {
    if (pattern.test(text)) {
      brandIssues.push(pattern.source);
    }
  }
  if (brandIssues.length > 0) {
    issues.push(`Brand safety concern: ${brandIssues.join(', ')}`);
  }

  // Single emoji is OK, but flag multiple
  const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 1) {
    issues.push(`Too many emojis: ${emojiCount} (max 1)`);
  }

  return {
    valid: issues.length === 0,
    issues,
    wordCount,
  };
}

/**
 * Compute a risk score for a comment (0-100).
 * 0 = completely safe, 100 = very risky.
 */
export function computeRiskScore(text, classification) {
  let risk = 0;

  const { valid, issues } = validateComment(text);
  if (!valid) risk += issues.length * 15;

  // Higher risk if post is sensitive
  if (classification?.sensitivity_flag) risk += 25;

  // Higher risk for brand safety matches
  for (const pattern of BRAND_SAFETY_PATTERNS) {
    if (pattern.test(text)) risk += 20;
  }

  return Math.min(100, risk);
}

/**
 * Get a human-readable risk label.
 */
export function riskLabel(score) {
  if (score <= 15) return 'safe';
  if (score <= 40) return 'moderate';
  return 'risky';
}

export { MAX_WORDS, FORBIDDEN_PATTERNS, BRAND_SAFETY_PATTERNS };
