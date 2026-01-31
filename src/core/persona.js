/**
 * Persona System
 * Manages tone and style preferences for comment generation.
 * Global default stored in chrome.storage.local, with per-generation override.
 */

const TONES = {
  curious: {
    id: 'curious',
    label: 'Curious',
    prompt_hint: 'Ask genuine questions. Show intellectual curiosity. Use phrases like "I wonder...", "What if...", "Have you considered..."',
  },
  analytical: {
    id: 'analytical',
    label: 'Analytical',
    prompt_hint: 'Be precise and data-driven. Reference specifics from the post. Use structured thinking.',
  },
  confident: {
    id: 'confident',
    label: 'Confident',
    prompt_hint: 'State opinions clearly. Be direct without being aggressive. Use declarative statements.',
  },
  supportive: {
    id: 'supportive',
    label: 'Supportive',
    prompt_hint: 'Be encouraging and empathetic. Acknowledge effort and progress. Validate feelings when appropriate.',
  },
  witty: {
    id: 'witty',
    label: 'Witty',
    prompt_hint: 'Use clever observations and light humor. Be sharp but not sarcastic. Keep it professional.',
  },
};

const STYLES = {
  insight_first: {
    id: 'insight_first',
    label: 'Insight-First',
    prompt_hint: 'Lead with your key insight or observation, then briefly explain why.',
  },
  question_first: {
    id: 'question_first',
    label: 'Question-First',
    prompt_hint: 'Lead with a thought-provoking question, optionally followed by brief context.',
  },
  story_first: {
    id: 'story_first',
    label: 'Story-First',
    prompt_hint: 'Lead with a brief anecdote or personal example, then connect it to the post.',
  },
  contrarian: {
    id: 'contrarian',
    label: 'Contrarian',
    prompt_hint: 'Lead with a respectful counter-perspective. Start with "Interesting angle, but..." or similar.',
  },
  direct: {
    id: 'direct',
    label: 'Direct',
    prompt_hint: 'Get straight to the point. No preamble. State your view concisely.',
  },
};

const DEFAULT_PERSONA = {
  tone: 'curious',
  style: 'insight_first',
};

/**
 * Load the saved persona from chrome.storage.local.
 * Falls back to DEFAULT_PERSONA.
 */
export async function loadPersona() {
  try {
    const result = await chrome.storage.local.get('persona');
    return result.persona || { ...DEFAULT_PERSONA };
  } catch {
    return { ...DEFAULT_PERSONA };
  }
}

/**
 * Save persona to chrome.storage.local.
 */
export async function savePersona(persona) {
  await chrome.storage.local.set({ persona });
}

/**
 * Build the persona portion of the prompt.
 * @param {Object} persona - { tone: string, style: string }
 * @returns {string} Prompt instructions for tone and style
 */
export function buildPersonaPrompt(persona) {
  const tone = TONES[persona.tone] || TONES.curious;
  const style = STYLES[persona.style] || STYLES.insight_first;

  return [
    `TONE: ${tone.label} — ${tone.prompt_hint}`,
    `STYLE: ${style.label} — ${style.prompt_hint}`,
  ].join('\n');
}

export { TONES, STYLES, DEFAULT_PERSONA };
