/**
 * IndexedDB Storage Layer
 * Stores posts, generated comments, engagement data, personas, and weekly analytics.
 */

const DB_NAME = 'LinkedInCommentAI';
const DB_VERSION = 2;

const STORES = {
  posts: 'posts',
  comments: 'comments',
  engagement: 'engagement',
  personas: 'personas',
  weekly_analytics: 'weekly_analytics',
};

let dbInstance = null;

/**
 * Open (or create) the IndexedDB database.
 */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Posts store
      if (!db.objectStoreNames.contains(STORES.posts)) {
        const postStore = db.createObjectStore(STORES.posts, { keyPath: 'id' });
        postStore.createIndex('timestamp', 'timestamp', { unique: false });
        postStore.createIndex('author', 'authorName', { unique: false });
        postStore.createIndex('postType', 'classification.post_type', { unique: false });
      }

      // Comments store
      if (!db.objectStoreNames.contains(STORES.comments)) {
        const commentStore = db.createObjectStore(STORES.comments, { keyPath: 'id' });
        commentStore.createIndex('postId', 'postId', { unique: false });
        commentStore.createIndex('timestamp', 'timestamp', { unique: false });
        commentStore.createIndex('strategy', 'selectedStrategy', { unique: false });
        commentStore.createIndex('optionChosen', 'optionChosen', { unique: false });
      }

      // Engagement store — full scoring fields
      if (!db.objectStoreNames.contains(STORES.engagement)) {
        const engStore = db.createObjectStore(STORES.engagement, { keyPath: 'commentId' });
        engStore.createIndex('strategy', 'strategy', { unique: false });
        engStore.createIndex('timestamp', 'timestamp', { unique: false });
        engStore.createIndex('postType', 'postType', { unique: false });
        engStore.createIndex('status', 'status', { unique: false });
      }

      // Personas store — tracks persona configs over time
      if (!db.objectStoreNames.contains(STORES.personas)) {
        const personaStore = db.createObjectStore(STORES.personas, { keyPath: 'id' });
        personaStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Weekly analytics store
      if (!db.objectStoreNames.contains(STORES.weekly_analytics)) {
        const weeklyStore = db.createObjectStore(STORES.weekly_analytics, { keyPath: 'weekKey' });
        weeklyStore.createIndex('generatedAt', 'generatedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error('IndexedDB error: ' + event.target.error));
    };
  });
}

/**
 * Generate a simple hash ID from a string.
 */
function hashId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'p_' + Math.abs(hash).toString(36);
}

/**
 * Generic put into a store.
 */
async function put(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic get by key.
 */
async function get(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all records from a store.
 */
async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Public API ----

/**
 * Save a scraped post with its classification.
 */
export async function savePost(postData, classification) {
  const id = hashId(postData.text + postData.authorName);
  return put(STORES.posts, {
    id,
    ...postData,
    classification,
    timestamp: Date.now(),
  });
}

/**
 * Save generated comments for a post.
 * Includes which option (1/2/3) was chosen, edit distance if modified, and user rating.
 */
export async function saveGeneratedComments(postId, comments, optionChosen, extras = {}) {
  const id = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const selected = comments[optionChosen - 1] || comments.find(c => c.label === extras.selectedLabel);
  return put(STORES.comments, {
    id,
    postId,
    comments,
    optionChosen,
    selectedStrategy: selected?.strategy_used || selected?.strategy || null,
    selectedLabel: selected?.label || null,
    editDistance: extras.editDistance || 0,
    userRating: extras.userRating || null, // 'up' | 'down' | null
    timestamp: Date.now(),
  });
}

/**
 * Update user rating for a comment record.
 */
export async function updateCommentRating(commentRecordId, rating) {
  const record = await get(STORES.comments, commentRecordId);
  if (record) {
    record.userRating = rating;
    return put(STORES.comments, record);
  }
}

/**
 * Record engagement outcome for a comment.
 * Full scoring fields per spec.
 */
export async function saveEngagement(commentId, strategy, outcome) {
  return put(STORES.engagement, {
    commentId,
    strategy,
    ...outcome,
    // Expected fields in outcome:
    // postId, commentText, label, postType, authorType,
    // status: 'pending' | 'checked',
    // likesReceived, repliesReceived, meaningfulReplies, profileVisits,
    // authorReply (boolean), firstEngagementWithin1Hour (boolean),
    // engagementScore (computed), checkedAt
    timestamp: Date.now(),
  });
}

/**
 * Update engagement record after re-scraping.
 */
export async function updateEngagement(commentId, metrics) {
  const record = await get(STORES.engagement, commentId);
  if (record) {
    Object.assign(record, metrics, { status: 'checked', checkedAt: Date.now() });
    return put(STORES.engagement, record);
  }
}

/**
 * Get all engagement records for learning analysis.
 */
export async function getAllEngagement() {
  return getAll(STORES.engagement);
}

/**
 * Get engagement records within a date range.
 */
export async function getEngagementInRange(startTs, endTs) {
  const all = await getAll(STORES.engagement);
  return all.filter(r => r.timestamp >= startTs && r.timestamp <= endTs);
}

/**
 * Get recent generated comments (last N).
 */
export async function getRecentComments(limit = 50) {
  const all = await getAll(STORES.comments);
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

/**
 * Save a persona snapshot.
 */
export async function savePersonaSnapshot(persona) {
  const id = 'persona_' + Date.now().toString(36);
  return put(STORES.personas, { id, ...persona, timestamp: Date.now() });
}

/**
 * Save weekly analytics report.
 */
export async function saveWeeklyAnalytics(weekKey, report) {
  return put(STORES.weekly_analytics, {
    weekKey,
    ...report,
    generatedAt: Date.now(),
  });
}

/**
 * Get weekly analytics report.
 */
export async function getWeeklyAnalytics(weekKey) {
  return get(STORES.weekly_analytics, weekKey);
}

/**
 * Get all weekly analytics.
 */
export async function getAllWeeklyAnalytics() {
  return getAll(STORES.weekly_analytics);
}

export { openDB, hashId, STORES };
