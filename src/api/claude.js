/**
 * Claude API Client
 * Builds structured prompts from post data + classification, calls Claude Sonnet,
 * and parses the response into 3 comment options.
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
 * Build the system prompt that instructs Claude on comment generation rules.
 */
function buildSystemPrompt() {
  return `You are an expert LinkedIn engagement strategist. You generate short, authentic comments that sound human-written.

ABSOLUTE RULES:
- Maximum 30 words per comment. No exceptions.
- Never use generic phrases like "Great post!", "Love this!", "So true!", "Well said!", "Couldn't agree more", "Spot on", "Nailed it"
- Never use hashtags
- Maximum 1 emoji per comment (prefer zero)
- Never self-promote or include calls to action
- Never sound like AI — avoid corporate jargon like "leverage", "synergy", "game-changer", "thought leader", "in today's digital landscape"
- Be specific to the post content. Reference actual details from the post.
- Sound like a real human professional, not a bot.

RESPONSE FORMAT:
Return ONLY valid JSON with this structure:
{
  "comments": [
    {
      "label": "safe",
      "strategy": "<strategy_id>",
      "text": "<the comment>",
      "reasoning": "<1 sentence explaining why this works>"
    },
    {
      "label": "alternative",
      "strategy": "<strategy_id>",
      "text": "<the comment>",
      "reasoning": "<1 sentence explaining why this works>"
    },
    {
      "label": "bold",
      "strategy": "<strategy_id>",
      "text": "<the comment>",
      "reasoning": "<1 sentence explaining why this works>"
    }
  ]
}`;
}

/**
 * Build the user prompt with post data, classification, and strategy assignments.
 */
function buildUserPrompt(postData, classification, strategies, persona) {
  const personaBlock = buildPersonaPrompt(persona);

  const existingComments = postData.existingComments?.length > 0
    ? `\nEXISTING COMMENTS (avoid repeating these angles):\n${postData.existingComments.slice(0, 5).map(c => `- "${c}"`).join('\n')}`
    : '';

  return `ANALYZE THIS LINKEDIN POST AND GENERATE 3 COMMENTS:

POST AUTHOR: ${postData.authorName || 'Unknown'}
AUTHOR HEADLINE: ${postData.authorHeadline || 'Unknown'}
POST TEXT:
"""
${postData.text}
"""

ENGAGEMENT: ${postData.likes || 0} likes, ${postData.comments || 0} comments, ${postData.reposts || 0} reposts
${existingComments}

CLASSIFICATION:
- Post Type: ${classification.post_type}
- Author Type: ${classification.author_type}
- Emotional State: ${classification.emotional_state}
- Sensitivity: ${classification.sensitivity_flag ? 'YES — be extra careful and empathetic' : 'No'}
- Contains Question: ${classification.contains_question}
- Sponsored: ${classification.sponsored_content}

ASSIGNED STRATEGIES:
1. SAFE comment → Use strategy: "${strategies.safe.id}" (${strategies.safe.description})
2. ALTERNATIVE comment → Use strategy: "${strategies.alternative.id}" (${strategies.alternative.description})
3. BOLD comment → Use strategy: "${strategies.bold.id}" (${strategies.bold.description})

${personaBlock}

Remember: Max 30 words each. Be specific. Sound human. No generic filler.`;
}

/**
 * Call the Claude API and return parsed comment options.
 *
 * @param {Object} postData - Scraped post data
 * @param {Object} classification - From classifyPost()
 * @param {Object} strategies - From selectStrategies()
 * @param {Object} persona - { tone, style }
 * @returns {Object} { comments: [...], raw: string }
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

  // Parse JSON from response (handle markdown code blocks)
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
