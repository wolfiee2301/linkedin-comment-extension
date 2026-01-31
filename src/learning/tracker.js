/**
 * Learning & Engagement Tracker
 *
 * Tracks engagement outcomes, computes engagement scores,
 * and generates weekly analytics with persona adjustment suggestions.
 *
 * ENGAGEMENT SCORING:
 * - likes x 1
 * - replies x 3
 * - meaningful_replies x 5 (>10 words, asks follow-up, not just "Thanks")
 * - profile_visits x 2
 * - author_reply x 10
 * - first_engagement_within_1_hour: +5 bonus
 *
 * TRACKS PER COMMENT:
 * - Which option (1/2/3) user selected
 * - Edit distance if modified
 * - User rating (thumbs up/down)
 * - Final engagement_score after 7 days
 */

import {
  saveEngagement,
  updateEngagement,
  getAllEngagement,
  getEngagementInRange,
  getRecentComments,
  saveWeeklyAnalytics,
} from '../storage/db.js';

// ---- Engagement Score Calculation ----

const SCORE_WEIGHTS = {
  likes: 1,
  replies: 3,
  meaningfulReplies: 5,
  profileVisits: 2,
  authorReply: 10,
  firstHourBonus: 5,
};

/**
 * Compute the engagement score from raw metrics.
 */
export function computeEngagementScore(metrics) {
  let score = 0;
  score += (metrics.likesReceived || 0) * SCORE_WEIGHTS.likes;
  score += (metrics.repliesReceived || 0) * SCORE_WEIGHTS.replies;
  score += (metrics.meaningfulReplies || 0) * SCORE_WEIGHTS.meaningfulReplies;
  score += (metrics.profileVisits || 0) * SCORE_WEIGHTS.profileVisits;
  if (metrics.authorReply) score += SCORE_WEIGHTS.authorReply;
  if (metrics.firstEngagementWithin1Hour) score += SCORE_WEIGHTS.firstHourBonus;
  return score;
}

/**
 * Record that a comment was used (copied to clipboard).
 */
export async function recordCommentUsed({ postId, commentText, strategy, label, optionNumber, classification }) {
  const commentId = 'used_' + Date.now().toString(36);

  await saveEngagement(commentId, strategy, {
    postId,
    commentText,
    label,
    optionNumber,
    postType: classification?.post_type || 'unknown',
    authorType: classification?.author_type || 'unknown',
    engagementHeat: classification?.engagement_heat || 'unknown',
    status: 'pending',
    likesReceived: null,
    repliesReceived: null,
    meaningfulReplies: null,
    profileVisits: null,
    authorReply: null,
    firstEngagementWithin1Hour: null,
    engagementScore: null,
  });

  return commentId;
}

/**
 * Update engagement metrics after re-scraping a post (auto-tracking).
 * Called by the service worker when checking on past comments.
 */
export async function updateCommentEngagement(commentId, rawMetrics) {
  const score = computeEngagementScore(rawMetrics);
  await updateEngagement(commentId, {
    ...rawMetrics,
    engagementScore: score,
  });
  return score;
}

// ---- Weekly Analytics / Retraining ----

/**
 * Get the ISO week key for a date (e.g., "2025-W23").
 */
function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Generate weekly analytics report.
 * Analyzes which tones, strategies, and topics drove the best engagement.
 */
export async function generateWeeklyReport() {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekKey = getWeekKey();

  const records = await getEngagementInRange(weekAgo, now);
  const checkedRecords = records.filter(r => r.status === 'checked' && r.engagementScore !== null);

  if (checkedRecords.length === 0) {
    return { weekKey, noData: true };
  }

  // Strategy performance
  const strategyStats = {};
  for (const r of checkedRecords) {
    if (!strategyStats[r.strategy]) {
      strategyStats[r.strategy] = { uses: 0, totalScore: 0, scores: [] };
    }
    strategyStats[r.strategy].uses++;
    strategyStats[r.strategy].totalScore += r.engagementScore;
    strategyStats[r.strategy].scores.push(r.engagementScore);
  }

  const strategyPerformance = {};
  for (const [strategy, stats] of Object.entries(strategyStats)) {
    strategyPerformance[strategy] = {
      uses: stats.uses,
      avgScore: (stats.totalScore / stats.uses).toFixed(1),
      bestScore: Math.max(...stats.scores),
    };
  }

  // Post type performance
  const postTypeStats = {};
  for (const r of checkedRecords) {
    const pt = r.postType || 'unknown';
    if (!postTypeStats[pt]) {
      postTypeStats[pt] = { count: 0, totalScore: 0 };
    }
    postTypeStats[pt].count++;
    postTypeStats[pt].totalScore += r.engagementScore;
  }

  const topicPerformance = {};
  for (const [pt, stats] of Object.entries(postTypeStats)) {
    topicPerformance[pt] = {
      count: stats.count,
      avgScore: (stats.totalScore / stats.count).toFixed(1),
    };
  }

  // Option selection distribution
  const optionCounts = { 1: 0, 2: 0, 3: 0 };
  for (const r of records) {
    if (r.optionNumber && optionCounts[r.optionNumber] !== undefined) {
      optionCounts[r.optionNumber]++;
    }
  }

  // Which conversations were driven (replies > 0)
  const conversationRate = checkedRecords.length > 0
    ? (checkedRecords.filter(r => (r.repliesReceived || 0) > 0).length / checkedRecords.length * 100).toFixed(0)
    : 0;

  // Best performing strategy
  let bestStrategy = null;
  let bestAvg = 0;
  for (const [strategy, perf] of Object.entries(strategyPerformance)) {
    if (parseFloat(perf.avgScore) > bestAvg) {
      bestAvg = parseFloat(perf.avgScore);
      bestStrategy = strategy;
    }
  }

  // Persona adjustment suggestions
  const suggestions = [];
  if (bestStrategy) {
    suggestions.push(`Your best strategy this week was "${bestStrategy}" (avg score: ${bestAvg}). Use it more.`);
  }
  if (parseFloat(conversationRate) < 30) {
    suggestions.push('Low conversation rate. Try using more "ask_question" strategies.');
  }
  if (optionCounts[3] > optionCounts[1]) {
    suggestions.push('You\'re choosing bold options more often. Consider if your persona risk tolerance should increase.');
  }

  const report = {
    weekKey,
    totalComments: records.length,
    checkedComments: checkedRecords.length,
    strategyPerformance,
    topicPerformance,
    optionDistribution: optionCounts,
    conversationRate: parseFloat(conversationRate),
    bestStrategy,
    suggestions,
  };

  await saveWeeklyAnalytics(weekKey, report);
  return report;
}

/**
 * Get strategy stats for display in the UI.
 */
export async function getStrategyStats() {
  const records = await getAllEngagement();
  const stats = {};

  for (const record of records) {
    if (!stats[record.strategy]) {
      stats[record.strategy] = {
        uses: 0,
        totalScore: 0,
        totalLikes: 0,
        totalReplies: 0,
        authorReplies: 0,
        checked: 0,
      };
    }

    const s = stats[record.strategy];
    s.uses++;

    if (record.status === 'checked' && record.engagementScore !== null) {
      s.totalScore += record.engagementScore;
      s.totalLikes += (record.likesReceived || 0);
      s.totalReplies += (record.repliesReceived || 0);
      if (record.authorReply) s.authorReplies++;
      s.checked++;
    }
  }

  const result = {};
  for (const [strategy, s] of Object.entries(stats)) {
    result[strategy] = {
      uses: s.uses,
      avgScore: s.checked > 0 ? (s.totalScore / s.checked).toFixed(1) : 'N/A',
      avgLikes: s.checked > 0 ? (s.totalLikes / s.checked).toFixed(1) : 'N/A',
      avgReplies: s.checked > 0 ? (s.totalReplies / s.checked).toFixed(1) : 'N/A',
      authorReplyRate: s.checked > 0 ? (s.authorReplies / s.checked * 100).toFixed(0) + '%' : 'N/A',
    };
  }

  return result;
}

export { SCORE_WEIGHTS, getWeekKey };
