/**
 * LinkedIn Content Script
 * Injects "Analyze" buttons on LinkedIn feed posts and scrapes post data on demand.
 * Communicates with service worker via chrome.runtime messages.
 */

const BUTTON_CLASS = 'lc-analyze-btn';
const PROCESSED_ATTR = 'data-lc-processed';

// ---- DOM Selectors (LinkedIn's structure, may change) ----

const SELECTORS = {
  // Feed post containers
  feedPost: '.feed-shared-update-v2',
  // Post text content
  postText: '.feed-shared-update-v2__description, .feed-shared-text, .break-words',
  // Author name
  authorName: '.update-components-actor__name .visually-hidden, .update-components-actor__title .visually-hidden',
  // Author headline
  authorHeadline: '.update-components-actor__description .visually-hidden, .update-components-actor__subtitle .visually-hidden',
  // Engagement counts
  likeCount: '.social-details-social-counts__reactions-count',
  commentCount: '.social-details-social-counts__comments',
  repostCount: '.social-details-social-counts__reposts',
  // Existing comments
  existingComment: '.comments-comment-item__main-content',
  // Post action bar (where we inject the button)
  actionBar: '.feed-shared-social-action-bar, .social-details-social-activity',
};

/**
 * Extract numeric count from a text string like "1,234 comments".
 */
function parseCount(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

/**
 * Scrape data from a single LinkedIn post element.
 */
function scrapePost(postElement) {
  const getText = (selector) => {
    const el = postElement.querySelector(selector);
    return el?.innerText?.trim() || '';
  };

  // Get post text — try multiple selectors
  let text = '';
  for (const sel of SELECTORS.postText.split(', ')) {
    const el = postElement.querySelector(sel);
    if (el?.innerText?.trim()) {
      text = el.innerText.trim();
      break;
    }
  }

  // Get author info
  let authorName = '';
  for (const sel of SELECTORS.authorName.split(', ')) {
    const el = postElement.querySelector(sel);
    if (el?.innerText?.trim()) {
      authorName = el.innerText.trim();
      break;
    }
  }

  let authorHeadline = '';
  for (const sel of SELECTORS.authorHeadline.split(', ')) {
    const el = postElement.querySelector(sel);
    if (el?.innerText?.trim()) {
      authorHeadline = el.innerText.trim();
      break;
    }
  }

  // Get engagement metrics
  const likes = parseCount(getText(SELECTORS.likeCount));
  const comments = parseCount(getText(SELECTORS.commentCount));
  const reposts = parseCount(getText(SELECTORS.repostCount));

  // Get existing comments (first 5)
  const existingComments = [];
  const commentEls = postElement.querySelectorAll(SELECTORS.existingComment);
  commentEls.forEach((el, i) => {
    if (i < 5 && el.innerText?.trim()) {
      existingComments.push(el.innerText.trim());
    }
  });

  return {
    text,
    authorName,
    authorHeadline,
    likes,
    comments,
    reposts,
    existingComments,
    scrapedAt: Date.now(),
    url: window.location.href,
  };
}

/**
 * Create and inject the "Analyze" button into a post's action bar.
 */
function injectAnalyzeButton(postElement) {
  if (postElement.getAttribute(PROCESSED_ATTR)) return;
  postElement.setAttribute(PROCESSED_ATTR, 'true');

  // Find the action bar
  let actionBar = null;
  for (const sel of SELECTORS.actionBar.split(', ')) {
    actionBar = postElement.querySelector(sel);
    if (actionBar) break;
  }
  if (!actionBar) return;

  const btn = document.createElement('button');
  btn.className = BUTTON_CLASS;
  btn.textContent = '✦ Analyze';
  btn.title = 'Generate AI comment suggestions';
  Object.assign(btn.style, {
    background: 'linear-gradient(135deg, #0077B5, #00A0DC)',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    marginLeft: '8px',
    transition: 'opacity 0.2s',
  });

  btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.textContent = '⏳ Analyzing...';
    btn.disabled = true;

    try {
      const postData = scrapePost(postElement);

      if (!postData.text) {
        btn.textContent = '⚠ No text found';
        setTimeout(() => {
          btn.textContent = '✦ Analyze';
          btn.disabled = false;
        }, 2000);
        return;
      }

      // Send to service worker for processing
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_POST',
        postData,
      });

      if (response?.error) {
        btn.textContent = '⚠ Error';
        console.error('[LC]', response.error);
      } else {
        btn.textContent = '✓ Done';
      }
    } catch (err) {
      btn.textContent = '⚠ Error';
      console.error('[LC] Scraper error:', err);
    }

    setTimeout(() => {
      btn.textContent = '✦ Analyze';
      btn.disabled = false;
    }, 3000);
  });

  actionBar.appendChild(btn);
}

/**
 * Scan the page for new posts and inject buttons.
 */
function scanAndInject() {
  const posts = document.querySelectorAll(SELECTORS.feedPost);
  posts.forEach(injectAnalyzeButton);
}

// ---- Initialization ----

// Initial scan
scanAndInject();

// Watch for new posts loaded via infinite scroll
const observer = new MutationObserver((mutations) => {
  let shouldScan = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldScan = true;
      break;
    }
  }
  if (shouldScan) scanAndInject();
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Listen for messages from the side panel (e.g., re-scrape for engagement tracking)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RESCRAPE_POST') {
    const posts = document.querySelectorAll(SELECTORS.feedPost);
    for (const post of posts) {
      const data = scrapePost(post);
      if (data.text && data.url === message.url) {
        sendResponse({ postData: data });
        return;
      }
    }
    sendResponse({ error: 'Post not found on page' });
  }
});
