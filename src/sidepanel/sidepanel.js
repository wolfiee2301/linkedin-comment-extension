/**
 * Side Panel UI Logic
 * Renders comment options, classification data, settings, and history.
 */

// ---- DOM References ----

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  tabs: $$('.tab'),
  tabContents: $$('.tab-content'),
  noPost: $('#no-post'),
  postSummary: $('#post-summary'),
  postAuthor: $('#post-author'),
  postText: $('#post-text'),
  postMeta: $('#post-meta'),
  commentsList: $('#comments-list'),
  rateLimitWarning: $('#rate-limit-warning'),
  errorDisplay: $('#error-display'),
  noAnalysis: $('#no-analysis'),
  analysisData: $('#analysis-data'),
  classificationGrid: $('#classification-grid'),
  strategiesList: $('#strategies-list'),
  historyEmpty: $('#history-empty'),
  historyList: $('#history-list'),
  apiKeyInput: $('#api-key-input'),
  btnSaveKey: $('#btn-save-key'),
  keyStatus: $('#key-status'),
  toneSelect: $('#tone-select'),
  styleSelect: $('#style-select'),
  btnSavePersona: $('#btn-save-persona'),
  personaStatus: $('#persona-status'),
  rateLimitStatus: $('#rate-limit-status'),
  btnSettings: $('#btn-settings'),
};

// ---- Tab Switching ----

els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    els.tabs.forEach(t => t.classList.remove('tab--active'));
    els.tabContents.forEach(tc => tc.classList.remove('tab-content--active'));
    tab.classList.add('tab--active');
    const target = tab.getAttribute('data-tab');
    $(`#tab-${target}`).classList.add('tab-content--active');

    if (target === 'history') loadHistory();
  });
});

els.btnSettings.addEventListener('click', () => {
  els.tabs.forEach(t => t.classList.remove('tab--active'));
  els.tabContents.forEach(tc => tc.classList.remove('tab-content--active'));
  $('[data-tab="settings"]').classList.add('tab--active');
  $('#tab-settings').classList.add('tab-content--active');
});

// ---- Toast Notification ----

function showToast(message) {
  let toast = $('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 2000);
}

// ---- Render Post Summary ----

function renderPostSummary(postData) {
  if (!postData?.text) {
    els.noPost.hidden = false;
    els.postSummary.hidden = true;
    els.commentsList.hidden = true;
    return;
  }

  els.noPost.hidden = true;
  els.postSummary.hidden = false;

  els.postAuthor.textContent = postData.authorName || 'Unknown Author';
  els.postText.textContent = postData.text.length > 200
    ? postData.text.slice(0, 200) + '...'
    : postData.text;
  els.postMeta.textContent = `${postData.likes || 0} likes · ${postData.comments || 0} comments · ${postData.reposts || 0} reposts`;
}

// ---- Render Comments ----

function renderComments(comments) {
  if (!comments || comments.length === 0) {
    els.commentsList.hidden = true;
    return;
  }

  els.commentsList.hidden = false;
  els.commentsList.innerHTML = '';

  comments.forEach(comment => {
    const card = document.createElement('div');
    card.className = 'comment-card';

    const labelClass = `comment-card__label--${comment.label}`;
    const riskClass = `risk--${comment.riskLabel || 'safe'}`;

    let validationHtml = '';
    if (comment.validation && !comment.validation.valid) {
      validationHtml = `<div class="comment-card__validation">
        ⚠ ${comment.validation.issues.join('; ')}
      </div>`;
    }

    card.innerHTML = `
      <div class="comment-card__header">
        <span class="comment-card__label ${labelClass}">${comment.label}</span>
        <span class="comment-card__risk ${riskClass}">${comment.riskLabel || 'safe'}</span>
      </div>
      <div class="comment-card__strategy">Strategy: ${comment.strategy}</div>
      <div class="comment-card__text">${escapeHtml(comment.text)}</div>
      <div class="comment-card__reasoning">${escapeHtml(comment.reasoning || '')}</div>
      ${validationHtml}
      <div class="comment-card__actions">
        <button class="btn btn--primary btn--small btn-copy" data-text="${escapeAttr(comment.text)}">Copy</button>
      </div>
    `;

    // Copy button handler
    card.querySelector('.btn-copy').addEventListener('click', async (e) => {
      const text = e.target.getAttribute('data-text');
      await copyToClipboard(text, comment.label);
    });

    els.commentsList.appendChild(card);
  });
}

/**
 * Copy text to clipboard and record usage.
 */
async function copyToClipboard(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');

    // Record the comment was used (for rate limiting)
    chrome.runtime.sendMessage({ type: 'RECORD_COMMENT_USED' });
  } catch (err) {
    // Fallback for clipboard API failure
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied!');
  }
}

// ---- Render Classification ----

function renderClassification(classification) {
  if (!classification) {
    els.noAnalysis.hidden = false;
    els.analysisData.hidden = true;
    return;
  }

  els.noAnalysis.hidden = true;
  els.analysisData.hidden = false;

  const items = [
    { label: 'Post Type', value: classification.post_type },
    { label: 'Author Type', value: classification.author_type },
    { label: 'Emotional State', value: classification.emotional_state },
    { label: 'Sensitivity', value: classification.sensitivity_flag ? 'YES' : 'No', flag: classification.sensitivity_flag },
    { label: 'Has Question', value: classification.contains_question ? 'Yes' : 'No' },
    { label: 'Sponsored', value: classification.sponsored_content ? 'Yes' : 'No' },
  ];

  els.classificationGrid.innerHTML = items.map(item => `
    <div class="classification-item">
      <div class="classification-item__label">${item.label}</div>
      <div class="classification-item__value ${item.flag ? 'classification-item__value--flag' : ''}">${item.value}</div>
    </div>
  `).join('');
}

// ---- Render Strategies ----

function renderStrategies(strategies) {
  if (!strategies) return;

  const items = [
    { label: 'Safe', strategy: strategies.safe },
    { label: 'Alternative', strategy: strategies.alternative },
    { label: 'Bold', strategy: strategies.bold },
  ];

  els.strategiesList.innerHTML = items.map(item => `
    <div class="strategy-item">
      <div class="strategy-item__label">${item.label}: ${item.strategy.label || item.strategy.id}</div>
      <div class="strategy-item__desc">${item.strategy.description || ''}</div>
    </div>
  `).join('');
}

// ---- Render Error ----

function renderError(errorMsg) {
  if (!errorMsg) {
    els.errorDisplay.hidden = true;
    return;
  }
  els.errorDisplay.hidden = false;
  els.errorDisplay.textContent = errorMsg;
}

// ---- History ----

async function loadHistory() {
  // History is stored in IndexedDB via service worker — for now, use chrome.storage
  try {
    const result = await chrome.storage.local.get('commentHistory');
    const history = result.commentHistory || [];

    if (history.length === 0) {
      els.historyEmpty.hidden = false;
      els.historyList.innerHTML = '';
      return;
    }

    els.historyEmpty.hidden = true;
    els.historyList.innerHTML = history.slice(0, 20).map(item => `
      <div class="history-item">
        <div class="history-item__date">${new Date(item.timestamp).toLocaleString()}</div>
        <div class="history-item__text">${escapeHtml(item.text)}</div>
      </div>
    `).join('');
  } catch {
    els.historyEmpty.hidden = false;
  }
}

/**
 * Save a comment to history.
 */
async function addToHistory(text) {
  try {
    const result = await chrome.storage.local.get('commentHistory');
    const history = result.commentHistory || [];
    history.unshift({ text, timestamp: Date.now() });
    // Keep last 100 entries
    await chrome.storage.local.set({ commentHistory: history.slice(0, 100) });
  } catch {
    // Silently fail
  }
}

// ---- Settings: API Key ----

els.btnSaveKey.addEventListener('click', async () => {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    els.keyStatus.textContent = 'Please enter a key.';
    els.keyStatus.className = 'setting-hint';
    return;
  }
  await chrome.storage.local.set({ apiKey: key });
  els.keyStatus.textContent = 'Key saved.';
  els.keyStatus.className = 'setting-hint setting-hint--success';
  els.apiKeyInput.value = '';
});

// Load existing key status
chrome.storage.local.get('apiKey').then(result => {
  if (result.apiKey) {
    els.keyStatus.textContent = 'Key is configured.';
    els.keyStatus.className = 'setting-hint setting-hint--success';
  } else {
    els.keyStatus.textContent = 'No key set. Enter your Claude API key above.';
  }
});

// ---- Settings: Persona ----

// Load current persona
chrome.storage.local.get('persona').then(result => {
  const persona = result.persona || { tone: 'curious', style: 'insight_first' };
  els.toneSelect.value = persona.tone;
  els.styleSelect.value = persona.style;
});

els.btnSavePersona.addEventListener('click', async () => {
  const persona = {
    tone: els.toneSelect.value,
    style: els.styleSelect.value,
  };
  await chrome.storage.local.set({ persona });
  els.personaStatus.textContent = 'Persona saved.';
  els.personaStatus.className = 'setting-hint setting-hint--success';
  setTimeout(() => { els.personaStatus.textContent = ''; }, 2000);
});

// ---- Listen for Analysis Updates ----

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ANALYSIS_UPDATED') {
    renderPostSummary(message.postData);

    if (message.result?.error) {
      renderError(message.result.error);
      renderComments([]);
    } else {
      renderError(null);
      renderComments(message.result?.comments || []);
    }

    renderClassification(message.result?.classification);
    renderStrategies(message.result?.strategies);
  }
});

// ---- On Panel Open: Fetch Last Analysis ----

chrome.runtime.sendMessage({ type: 'GET_CURRENT_POST' }).then(response => {
  if (response?.postData) {
    renderPostSummary(response.postData);
    if (response.result?.comments) {
      renderComments(response.result.comments);
    }
    renderClassification(response.result?.classification);
    renderStrategies(response.result?.strategies);
    if (response.result?.error) {
      renderError(response.result.error);
    }
  }
}).catch(() => {
  // No previous analysis
});

// ---- Helpers ----

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
