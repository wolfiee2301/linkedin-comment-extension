/**
 * Service Worker (Background Script)
 * Handles message routing, rate limiting, and orchestrates the analysis pipeline.
 */

import { classifyPost } from '../core/classifier.js';
import { selectStrategies } from '../core/strategies.js';
import { loadPersona } from '../core/persona.js';
import { checkAllComments, buildFallbackInstruction, checkComment, riskLabel } from '../core/safety.js';
import { generateComments, generateFallback } from '../api/claude.js';

// ---- Rate Limiter ----

const RATE_LIMIT = {
  maxPerHour: 7,
  minGapMs: 2 * 60 * 1000, // 2 minutes
};

let commentTimestamps = [];

function checkRateLimit() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  commentTimestamps = commentTimestamps.filter(ts => ts > oneHourAgo);

  if (commentTimestamps.length >= RATE_LIMIT.maxPerHour) {
    const oldestInWindow = commentTimestamps[0];
    const waitMinutes = Math.ceil((oldestInWindow + 60 * 60 * 1000 - now) / 60000);
    return { allowed: false, reason: `Hourly limit reached (${RATE_LIMIT.maxPerHour}/hr). Try again in ~${waitMinutes} min.` };
  }

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

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ---- Message Router ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_POST') {
    handleAnalyzePost(message.postData, sender.tab?.id)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
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
    lastAnalyzedPost = postData;
    lastAnalysisResult = {
      classification,
      strategies,
      error: err.message,
    };
    notifySidePanel(tabId);
    throw err;
  }

  // 5. Run safety + quality checks on all 3 comments
  const safetyResults = checkAllComments(generated.comments, classification);

  let finalComments;

  if (safetyResults.fallbackNeeded) {
    // All 3 rejected — generate ultra-safe fallback
    try {
      const fallbackInstruction = buildFallbackInstruction(classification);
      const fallback = await generateFallback(postData, classification, fallbackInstruction);
      const fallbackSafety = checkComment(fallback.text, classification);
      finalComments = [{
        label: 'fallback',
        strategy_used: fallback.strategy_used || 'ask_question',
        risk_level: 'safe',
        text: fallback.text,
        rationale: 'Ultra-safe fallback — all original options were rejected by safety checks.',
        quality_score: fallback.quality_score || 5,
        safety: fallbackSafety,
        riskScore: fallbackSafety.riskScore,
        riskLabel: fallbackSafety.riskLabel,
      }];
    } catch {
      // Even fallback failed — show originals with warnings
      finalComments = safetyResults.results.map(r => ({
        ...r,
        riskScore: r.safety.riskScore,
        riskLabel: r.safety.riskLabel,
      }));
    }
  } else {
    finalComments = safetyResults.results.map(r => ({
      ...r,
      riskScore: r.safety.riskScore,
      riskLabel: r.safety.riskLabel,
    }));
  }

  // 6. Store result
  lastAnalyzedPost = postData;
  lastAnalysisResult = {
    classification,
    strategies,
    comments: finalComments,
    fallbackUsed: safetyResults.fallbackNeeded,
    generatedAt: Date.now(),
  };

  // 7. Notify side panel
  notifySidePanel(tabId);

  return { success: true };
}

function notifySidePanel(tabId) {
  chrome.runtime.sendMessage({
    type: 'ANALYSIS_UPDATED',
    postData: lastAnalyzedPost,
    result: lastAnalysisResult,
  }).catch(() => {});
}
