/**
 * IndexedDB Storage Layer
 * Stores posts, generated comments, and engagement data locally.
 */

const DB_NAME = 'LinkedInCommentAI';
const DB_VERSION = 1;

const STORES = {
  posts: 'posts',           // scraped post data + classification
  comments: 'comments',     // generated comments + which was selected
  engagement: 'engagement', // tracked engagement outcomes
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

      // Posts store — keyed by a hash of post text + author
      if (!db.objectStoreNames.contains(STORES.posts)) {
        const postStore = db.createObjectStore(STORES.posts, { keyPath: 'id' });
        postStore.createIndex('timestamp', 'timestamp', { unique: false });
        postStore.createIndex('author', 'authorName', { unique: false });
      }

      // Comments store — keyed by generated ID
      if (!db.objectStoreNames.contains(STORES.comments)) {
        const commentStore = db.createObjectStore(STORES.comments, { keyPath: 'id' });
        commentStore.createIndex('postId', 'postId', { unique: false });
        commentStore.createIndex('timestamp', 'timestamp', { unique: false });
        commentStore.createIndex('strategy', 'selectedStrategy', { unique: false });
      }

      // Engagement store — keyed by comment ID
      if (!db.objectStoreNames.contains(STORES.engagement)) {
        const engStore = db.createObjectStore(STORES.engagement, { keyPath: 'commentId' });
        engStore.createIndex('strategy', 'strategy', { unique: false });
        engStore.createIndex('timestamp', 'timestamp', { unique: false });
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
 */
export async function saveGeneratedComments(postId, comments, selectedLabel) {
  const id = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  return put(STORES.comments, {
    id,
    postId,
    comments,
    selectedLabel,
    selectedStrategy: comments.find(c => c.label === selectedLabel)?.strategy || null,
    timestamp: Date.now(),
  });
}

/**
 * Record engagement outcome for a comment.
 */
export async function saveEngagement(commentId, strategy, outcome) {
  return put(STORES.engagement, {
    commentId,
    strategy,
    ...outcome,
    timestamp: Date.now(),
  });
}

/**
 * Get all engagement records for learning analysis.
 */
export async function getAllEngagement() {
  return getAll(STORES.engagement);
}

/**
 * Get recent generated comments (last N).
 */
export async function getRecentComments(limit = 50) {
  const all = await getAll(STORES.comments);
  return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export { openDB, hashId, STORES };
