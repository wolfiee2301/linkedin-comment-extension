/**
 * Service Worker (Background Script)
 * Handles message routing, rate limiting, and orchestrates the analysis pipeline.
 */

import { classifyPost } from '../core/classifier.js';
import { selectStrategies } from '../core/strategies.js';
import { loadPersona } from '../core/persona.js';
import { validateComment, computeRiskScore, riskLabel } from '../core/safety.js';
import { generateComments } from '../api/claude.js';

// ---- Rate Limiter ----

const RATE_LIMIT = {
  maxPerHour: 7,
  minGapMs: 2 * 60 * 1000, // 2 minutes
};

let commentTimestamps = [];

function checkRateLimit() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // Clean old timestamps
  commentTimestamps = commentTimestamps.filter(ts => ts > oneHourAgo);

  // Check hourly limit
  if (commentTimestamps.length >= RATE_LIMIT.maxPerHour) {
    const oldestInWindow = commentTimestamps[0];
    const waitMinutes = Math.ceil((oldestInWindow + 60 * 60 * 1000 - now) / 60000);
    return { allowed: false, reason: `Hourly limit reached (${RATE_LIMIT.maxPerHour}/hr). Try again in ~${waitMinutes} min.` };
  }

  // Check minimum gap
  if (commentTimestamps.length > 0) {
    const lastTs = commentTimestamps[commentTimestamps.length - 1];
    const gap = now - lastTs;
    if (gap < RATE_LIMIT.minGapMs) {
      const waitSec = Math.ceil((RATE_LIMIT.minGapMs - gap) / 1000);
      return { allowed: false, reason: `Too soon. Wait ${waitSec}s between comments.` };
    }
  }

  return { allowed: true };
}

function recordCommentTimestamp() {
  commentTimestamps.push(Date.now());
}

// ---- Side Panel Opener ----

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ---- Message Router ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_POST') {
    handleAnalyzePost(message.postData, sender.tab?.id)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === 'CHECK_RATE_LIMIT') {
    sendResponse(checkRateLimit());
    return false;
  }

  if (message.type === 'RECORD_COMMENT_USED') {
    recordCommentTimestamp();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_CURRENT_POST') {
    // Forward latest analyzed post to the side panel
    sendResponse({ postData: lastAnalyzedPost, result: lastAnalysisResult });
    return false;
  }
});

// ---- Analysis Pipeline ----

let lastAnalyzedPost = null;
let lastAnalysisResult = null;

async function handleAnalyzePost(postData, tabId) {
  // 1. Classify the post
  const classification = classifyPost(postData);

  // 2. Select strategies
  const strategies = selectStrategies(classification);

  // 3. Load persona
  const persona = await loadPersona();

  // 4. Generate comments via Claude API
  let generated;
  try {
    generated = await generateComments(postData, classification, strategies, persona);
  } catch (err) {
    // Store partial result so side panel can show classification
    lastAnalyzedPost = postData;
    lastAnalysisResult = {
      classification,
      strategies,
      error: err.message,
    };

    // Notify side panel of update
    notifySidePanel(tabId);

    throw err;
  }

  // 5. Validate each comment through safety checks
  const validatedComments = generated.comments.map(comment => {
    const validation = validateComment(comment.text);
    const risk = computeRiskScore(comment.text, classification);
    return {
      ...comment,
      validation,
      riskScore: risk,
      riskLabel: riskLabel(risk),
    };
  });

  // 6. Store result
  lastAnalyzedPost = postData;
  lastAnalysisResult = {
    classification,
    strategies,
    comments: validatedComments,
    generatedAt: Date.now(),
  };

  // 7. Notify side panel
  notifySidePanel(tabId);

  return { success: true };
}

/**
 * Send a message to the side panel to refresh.
 */
function notifySidePanel(tabId) {
  chrome.runtime.sendMessage({
    type: 'ANALYSIS_UPDATED',
    postData: lastAnalyzedPost,
    result: lastAnalysisResult,
  }).catch(() => {
    // Side panel may not be open — ignore
  });
}
