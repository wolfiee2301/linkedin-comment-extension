/**
 * Claude API Client
 * Builds structured prompts from post data + classification, calls Claude Sonnet,
 * and parses the response into 3 comment options with quality scores.
 */

import { buildPersonaPrompt } from '../core/persona.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

/**
 * Load API key from chrome.storage.local.
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

/**
 * Save API key to chrome.storage.local.
 */
export async function saveApiKey(key) {
  await chrome.storage.local.set({ apiKey: key });
}

/**
 * Build the system prompt with all generation rules.
 */
function buildSystemPrompt() {
  return `You are an expert LinkedIn engagement strategist. You generate short, authentic comments that sound human-written.

ABSOLUTE RULES:
- Maximum 30 words per comment. No exceptions.
- Each comment MUST reference something specific from the post (a name, number, claim, or detail).
- If a comment could be copy-pasted onto any random LinkedIn post, it FAILS. Be specific.

FORBIDDEN PATTERNS (NEVER use these):
- "Great post!", "Thanks for sharing", "Love this", "So true", "Well said"
- "Couldn't agree more", "This resonates", "Absolutely", "Spot on", "Nailed it"
- Generic questions: "What do you think?", "Thoughts?", "Agree?"
- Template language: "As a [role], I..."
- Hashtags (anywhere in the comment)
- Multiple exclamation marks
- Corporate jargon: "leverage", "synergy", "game-changer", "thought leader"
- AI-sounding language: "in today's digital landscape", "paradigm shift"

GENERATION RULES:
- Generate exactly 3 options
- Option 1 (primary): Uses the primary strategy at the assigned risk level (safe or moderate)
- Option 2 (alternative): Uses the alternative strategy at the SAME risk level as Option 1
- Option 3 (bold): Uses the primary strategy at ONE LEVEL HIGHER risk (safe→moderate, moderate→bold)
- If skip_bold=true, Option 3 should still be generated but at the same risk as Option 1
- Each comment must invite further conversation
- Avoid patterns already used in existing comments on the post

QUALITY SCORING (1-10):
- 10: Specific, conversation-starting, perfectly matched to strategy and tone
- 7-9: Good specificity, appropriate strategy execution
- 4-6: Somewhat generic or doesn't fully match the strategy
- 1-3: Generic, could apply to any post, mismatched strategy

RESPONSE FORMAT:
Return ONLY valid JSON with this structure:
{
  "comments": [
    {
      "label": "primary",
      "strategy_used": "<strategy_id>",
      "risk_level": "safe|moderate|bold",
      "text": "<the comment>",
      "rationale": "<1 sentence explaining why this works>",
      "quality_score": <1-10>
    },
    {
      "label": "alternative",
      "strategy_used": "<strategy_id>",
      "risk_level": "safe|moderate|bold",
      "text": "<the comment>",
      "rationale": "<1 sentence explaining why this works>",
      "quality_score": <1-10>
    },
    {
      "label": "bold",
      "strategy_used": "<strategy_id>",
      "risk_level": "safe|moderate|bold",
      "text": "<the comment>",
      "rationale": "<1 sentence explaining why this works>",
      "quality_score": <1-10>
    }
  ]
}`;
}

/**
 * Build the user prompt with full context.
 */
function buildUserPrompt(postData, classification, strategies, persona) {
  const personaBlock = buildPersonaPrompt(persona, strategies.tone_range);

  const existingComments = postData.existingComments?.length > 0
    ? `\nEXISTING COMMENTS (avoid repeating these angles):\n${postData.existingComments.slice(0, 5).map(c => `- "${c}"`).join('\n')}`
    : '';

  const sensitivityNote = classification.sensitivity_flag
    ? `\n⚠ SENSITIVITY ALERT: This post involves sensitive topics (${classification.sensitivity_triggers?.join(', ') || 'flagged'}). Use supportive tone ONLY. No humor, no controversy, no strong opinions.`
    : '';

  const boldNote = strategies.skip_bold
    ? '\n⚠ SKIP BOLD: Do NOT generate a bold/risky option. Option 3 should use the same safe risk level as Option 1.'
    : '';

  return `ANALYZE THIS LINKEDIN POST AND GENERATE 3 COMMENTS:

POST AUTHOR: ${postData.authorName || 'Unknown'}
AUTHOR HEADLINE: ${postData.authorHeadline || 'Unknown'}
POST TEXT:
"""
${postData.text}
"""

ENGAGEMENT: ${postData.likes || 0} likes, ${postData.comments || 0} comments, ${postData.reposts || 0} reposts
ENGAGEMENT HEAT: ${classification.engagement_heat}
${existingComments}

CLASSIFICATION:
- Post Type: ${classification.post_type}
- Author Type: ${classification.author_type}
- Emotional State: ${classification.emotional_state}
- Sensitivity: ${classification.sensitivity_flag ? 'YES' : 'No'}
- Contains Question: ${classification.contains_question}
- Sponsored: ${classification.sponsored_content}
${sensitivityNote}

STRATEGY ASSIGNMENTS:
1. PRIMARY (Option 1) → Strategy: "${strategies.primary.id}" (${strategies.primary.description}) | Risk: ${strategies.primary_risk}
2. ALTERNATIVE (Option 2) → Strategy: "${strategies.alternative.id}" (${strategies.alternative.description}) | Risk: ${strategies.primary_risk}
3. BOLD (Option 3) → Strategy: "${strategies.bold?.id || strategies.primary.id}" (${strategies.bold?.description || strategies.primary.description}) | Risk: ${strategies.bold_risk || strategies.primary_risk}
${boldNote}

STRATEGY RATIONALE: ${strategies.rationale}
ALLOWED TONES: ${strategies.tone_range.join(', ')}

${personaBlock}

Remember: Max 30 words each. Reference specific details from the post. No generic filler. Each must invite conversation.`;
}

/**
 * Call the Claude API and return parsed comment options.
 */
export async function generateComments(postData, classification, strategies, persona) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('API key not configured. Go to Settings to add your Claude API key.');
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(postData, classification, strategies, persona);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid API key. Check your key in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Claude API rate limit hit. Wait a moment and try again.');
    }
    throw new Error(`Claude API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text || '';

  let parsed;
  try {
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse Claude response as JSON. Raw: ' + raw.slice(0, 200));
  }

  if (!parsed.comments || !Array.isArray(parsed.comments) || parsed.comments.length < 3) {
    throw new Error('Claude returned invalid comment structure.');
  }

  return {
    comments: parsed.comments,
    raw,
  };
}

/**
 * Generate an ultra-safe fallback comment (when all 3 are rejected by safety).
 */
export async function generateFallback(postData, classification, fallbackInstruction) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API key not configured.');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      system: 'You generate ultra-safe LinkedIn comments. Return ONLY valid JSON: { "text": "<comment>", "strategy_used": "ask_question", "quality_score": <1-10> }',
      messages: [
        { role: 'user', content: `${fallbackInstruction}\n\nPOST TEXT:\n"""${postData.text}"""\nAUTHOR: ${postData.authorName}` },
      ],
    }),
  });

  if (!response.ok) throw new Error('Fallback generation failed.');

  const data = await response.json();
  const raw = data.content?.[0]?.text || '';
  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}
