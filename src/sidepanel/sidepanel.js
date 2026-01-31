/**
 * Side Panel UI Logic
 * Renders comment options with safety status, quality scores,
 * classification data, learning insights, settings, and history.
 */

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
  fallbackWarning: $('#fallback-warning'),
  commentsList: $('#comments-list'),
  rateLimitWarning: $('#rate-limit-warning'),
  errorDisplay: $('#error-display'),
  noAnalysis: $('#no-analysis'),
  analysisData: $('#analysis-data'),
  classificationGrid: $('#classification-grid'),
  strategiesList: $('#strategies-list'),
  strategyRationale: $('#strategy-rationale'),
  insightsEmpty: $('#insights-empty'),
  insightsData: $('#insights-data'),
  strategyStats: $('#strategy-stats'),
  weeklySuggestions: $('#weekly-suggestions'),
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
    if (target === 'insights') loadInsights();
  });
});

els.btnSettings.addEventListener('click', () => {
  els.tabs.forEach(t => t.classList.remove('tab--active'));
  els.tabContents.forEach(tc => tc.classList.remove('tab-content--active'));
  $('[data-tab="settings"]').classList.add('tab--active');
  $('#tab-settings').classList.add('tab-content--active');
});

// ---- Toast ----

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

function renderComments(comments, fallbackUsed) {
  els.fallbackWarning.hidden = !fallbackUsed;

  if (!comments || comments.length === 0) {
    els.commentsList.hidden = true;
    return;
  }

  els.commentsList.hidden = false;
  els.commentsList.innerHTML = '';

  comments.forEach((comment, idx) => {
    const card = document.createElement('div');
    card.className = 'comment-card';

    const label = comment.label || `option-${idx + 1}`;
    const labelClass = `comment-card__label--${label}`;
    const riskClass = `risk--${comment.riskLabel || 'safe'}`;
    const strategy = comment.strategy_used || comment.strategy || 'unknown';
    const riskLevel = comment.risk_level || comment.riskLabel || 'safe';
    const qualityScore = comment.quality_score != null ? comment.quality_score : '-';

    // Safety status badge
    const safetyStatus = comment.safety?.status || 'approve';
    const statusClass = `status--${safetyStatus}`;

    let safetyIssuesHtml = '';
    if (comment.safety?.issues?.length > 0) {
      const issueLines = comment.safety.issues
        .map(i => `<span class="issue-${i.severity}">${escapeHtml(i.message)}</span>`)
        .join('<br>');
      safetyIssuesHtml = `<div class="comment-card__issues">${issueLines}</div>`;
    }

    card.innerHTML = `
      <div class="comment-card__header">
        <span class="comment-card__label ${labelClass}">${label}</span>
        <span class="comment-card__quality">Q: ${qualityScore}/10</span>
        <span class="comment-card__status ${statusClass}">${safetyStatus}</span>
        <span class="comment-card__risk ${riskClass}">${riskLevel}</span>
      </div>
      <div class="comment-card__strategy">Strategy: ${strategy}</div>
      <div class="comment-card__text">${escapeHtml(comment.text)}</div>
      <div class="comment-card__reasoning">${escapeHtml(comment.rationale || comment.reasoning || '')}</div>
      ${safetyIssuesHtml}
      <div class="comment-card__actions">
        <button class="btn btn--primary btn--small btn-copy" data-text="${escapeAttr(comment.text)}">Copy</button>
        <span class="comment-card__words">${comment.safety?.wordCount || comment.text.trim().split(/\s+/).length}w</span>
      </div>
    `;

    card.querySelector('.btn-copy').addEventListener('click', async (e) => {
      const text = e.target.getAttribute('data-text');
      await copyToClipboard(text);
    });

    els.commentsList.appendChild(card);
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
    chrome.runtime.sendMessage({ type: 'RECORD_COMMENT_USED' });
    addToHistory(text);
  } catch {
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
    { label: 'Engagement', value: classification.engagement_heat || '-' },
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
    { label: 'Primary', strategy: strategies.primary, risk: strategies.primary_risk },
    { label: 'Alternative', strategy: strategies.alternative, risk: strategies.primary_risk },
    { label: 'Bold', strategy: strategies.bold || strategies.primary, risk: strategies.bold_risk || strategies.primary_risk },
  ];

  if (strategies.skip_bold) {
    items[2].label = 'Bold (skipped)';
    items[2].risk = 'n/a';
  }

  els.strategiesList.innerHTML = items.map(item => `
    <div class="strategy-item">
      <div class="strategy-item__label">${item.label}: ${item.strategy.label || item.strategy.id} <span class="strategy-risk">[${item.risk}]</span></div>
      <div class="strategy-item__desc">${item.strategy.description || ''}</div>
    </div>
  `).join('');

  els.strategyRationale.textContent = strategies.rationale || '';
}

// ---- Render Error ----

function renderError(errorMsg) {
  if (!errorMsg) { els.errorDisplay.hidden = true; return; }
  els.errorDisplay.hidden = false;
  els.errorDisplay.textContent = errorMsg;
}

// ---- Insights ----

async function loadInsights() {
  try {
    const result = await chrome.storage.local.get('latestInsights');
    const insights = result.latestInsights;
    if (!insights || insights.noData) {
      els.insightsEmpty.hidden = false;
      els.insightsData.hidden = true;
      return;
    }
    els.insightsEmpty.hidden = true;
    els.insightsData.hidden = false;

    // Strategy stats
    if (insights.strategyPerformance) {
      els.strategyStats.innerHTML = Object.entries(insights.strategyPerformance).map(([s, p]) => `
        <div class="stat-card">
          <div class="stat-card__label">${s}</div>
          <div class="stat-card__value">Avg: ${p.avgScore} | Uses: ${p.uses}</div>
        </div>
      `).join('');
    }

    // Suggestions
    if (insights.suggestions?.length > 0) {
      els.weeklySuggestions.innerHTML = insights.suggestions.map(s =>
        `<div class="suggestion-item">${escapeHtml(s)}</div>`
      ).join('');
    } else {
      els.weeklySuggestions.innerHTML = '<p class="setting-hint">No suggestions yet.</p>';
    }
  } catch {
    els.insightsEmpty.hidden = false;
    els.insightsData.hidden = true;
  }
}

// ---- History ----

async function loadHistory() {
  try {
    const result = await chrome.storage.local.get('commentHistory');
    const history = result.commentHistory || [];
    if (history.length === 0) {
      els.historyEmpty.hidden = false;
      els.historyList.innerHTML = '';
      return;
    }
    els.historyEmpty.hidden = true;
    els.historyList.innerHTML = history.slice(0, 30).map(item => `
      <div class="history-item">
        <div class="history-item__date">${new Date(item.timestamp).toLocaleString()}</div>
        <div class="history-item__text">${escapeHtml(item.text)}</div>
      </div>
    `).join('');
  } catch {
    els.historyEmpty.hidden = false;
  }
}

async function addToHistory(text) {
  try {
    const result = await chrome.storage.local.get('commentHistory');
    const history = result.commentHistory || [];
    history.unshift({ text, timestamp: Date.now() });
    await chrome.storage.local.set({ commentHistory: history.slice(0, 100) });
  } catch { /* silent */ }
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

chrome.storage.local.get('apiKey').then(result => {
  els.keyStatus.textContent = result.apiKey ? 'Key is configured.' : 'No key set.';
  els.keyStatus.className = result.apiKey ? 'setting-hint setting-hint--success' : 'setting-hint';
});

// ---- Settings: Persona ----

chrome.storage.local.get('persona').then(result => {
  const p = result.persona || { tone: 'curious', style: 'insight_first' };
  els.toneSelect.value = p.tone;
  els.styleSelect.value = p.style;
});

els.btnSavePersona.addEventListener('click', async () => {
  const persona = { tone: els.toneSelect.value, style: els.styleSelect.value };
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
      renderComments([], false);
    } else {
      renderError(null);
      renderComments(message.result?.comments || [], message.result?.fallbackUsed || false);
    }
    renderClassification(message.result?.classification);
    renderStrategies(message.result?.strategies);
  }
});

// ---- On Panel Open ----

chrome.runtime.sendMessage({ type: 'GET_CURRENT_POST' }).then(response => {
  if (response?.postData) {
    renderPostSummary(response.postData);
    if (response.result?.comments) {
      renderComments(response.result.comments, response.result?.fallbackUsed || false);
    }
    renderClassification(response.result?.classification);
    renderStrategies(response.result?.strategies);
    if (response.result?.error) renderError(response.result.error);
  }
}).catch(() => {});

// ---- Helpers ----

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
