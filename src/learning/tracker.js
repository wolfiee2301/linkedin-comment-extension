/**
 * Learning / Engagement Tracker (Stub)
 *
 * MVP stub: provides the interface for tracking engagement outcomes.
 * Full implementation will auto-rescrape posts to check if the user's
 * comment received likes/replies, then score strategies accordingly.
 */

import { saveEngagement, getAllEngagement } from '../storage/db.js';

/**
 * Record that a comment was used (copied to clipboard).
 * Called when the user clicks "Copy" in the side panel.
 *
 * @param {Object} params
 * @param {string} params.postId - The post's hash ID
 * @param {string} params.commentText - The comment text that was copied
 * @param {string} params.strategy - Strategy ID used
 * @param {string} params.label - 'safe' | 'alternative' | 'bold'
 * @param {Object} params.classification - The post classification at time of generation
 */
export async function recordCommentUsed({ postId, commentText, strategy, label, classification }) {
  const commentId = 'used_' + Date.now().toString(36);

  await saveEngagement(commentId, strategy, {
    postId,
    commentText,
    label,
    postType: classification?.post_type || 'unknown',
    authorType: classification?.author_type || 'unknown',
    status: 'pending', // will be updated when engagement is checked
    likesReceived: null,
    repliesReceived: null,
  });

  return commentId;
}

/**
 * Get strategy performance summary.
 * Returns a map of strategy_id -> { uses, avgLikes, avgReplies, successRate }.
 *
 * Stub: returns empty stats until engagement data is collected.
 */
export async function getStrategyStats() {
  const records = await getAllEngagement();
  const stats = {};

  for (const record of records) {
    if (!stats[record.strategy]) {
      stats[record.strategy] = {
        uses: 0,
        totalLikes: 0,
        totalReplies: 0,
        checked: 0,
      };
    }

    const s = stats[record.strategy];
    s.uses++;

    if (record.likesReceived !== null) {
      s.totalLikes += record.likesReceived;
      s.totalReplies += (record.repliesReceived || 0);
      s.checked++;
    }
  }

  // Compute averages
  const result = {};
  for (const [strategy, s] of Object.entries(stats)) {
    result[strategy] = {
      uses: s.uses,
      avgLikes: s.checked > 0 ? (s.totalLikes / s.checked).toFixed(1) : 'N/A',
      avgReplies: s.checked > 0 ? (s.totalReplies / s.checked).toFixed(1) : 'N/A',
    };
  }

  return result;
}
