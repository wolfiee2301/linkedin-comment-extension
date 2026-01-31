/**
 * Persona System
 * Manages tone and style preferences for comment generation.
 * Global default stored in chrome.storage.local, with per-generation override.
 *
 * Tones: curious, analytical, witty, confident, thoughtful, direct, playful, opinionated
 * Styles: insight-first, question-first, punchy, framework, story, data-point
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
  witty: {
    id: 'witty',
    label: 'Witty',
    prompt_hint: 'Use clever observations and light humor. Be sharp but not sarcastic. Keep it professional.',
  },
  confident: {
    id: 'confident',
    label: 'Confident',
    prompt_hint: 'State opinions clearly. Be direct without being aggressive. Use declarative statements.',
  },
  thoughtful: {
    id: 'thoughtful',
    label: 'Thoughtful',
    prompt_hint: 'Show depth of consideration. Acknowledge nuance. Reference multiple angles before landing on a view.',
  },
  direct: {
    id: 'direct',
    label: 'Direct',
    prompt_hint: 'Get straight to the point. No preamble, no hedging. State your view concisely and move on.',
  },
  playful: {
    id: 'playful',
    label: 'Playful',
    prompt_hint: 'Use lighthearted language and gentle humor. Keep energy up. Avoid being too serious.',
  },
  opinionated: {
    id: 'opinionated',
    label: 'Opinionated',
    prompt_hint: 'Take a clear stance. Don\'t sit on the fence. Back your opinion with a specific reason.',
  },
  supportive: {
    id: 'supportive',
    label: 'Supportive',
    prompt_hint: 'Be encouraging and empathetic. Acknowledge effort and progress. Validate feelings when appropriate.',
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
  punchy: {
    id: 'punchy',
    label: 'Punchy',
    prompt_hint: 'Short, impactful sentences. One clear idea. No filler. Reads like a headline.',
  },
  framework: {
    id: 'framework',
    label: 'Framework',
    prompt_hint: 'Reference or introduce a mental model. "This is a classic X pattern" or "The Y framework applies here."',
  },
  story: {
    id: 'story',
    label: 'Story',
    prompt_hint: 'Lead with a brief anecdote or personal example, then connect it to the post.',
  },
  data_point: {
    id: 'data_point',
    label: 'Data-Point',
    prompt_hint: 'Lead with a specific number, stat, or concrete fact. Then tie it to the post\'s argument.',
  },
  contrarian: {
    id: 'contrarian',
    label: 'Contrarian',
    prompt_hint: 'Lead with a respectful counter-perspective. Start with "Interesting angle, but..." or similar.',
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
 * Optionally constrained by a tone_range from strategy selection.
 *
 * @param {Object} persona - { tone: string, style: string }
 * @param {string[]} [toneRange] - Allowed tones from strategy selection
 * @returns {string} Prompt instructions for tone and style
 */
export function buildPersonaPrompt(persona, toneRange) {
  let tone = TONES[persona.tone] || TONES.curious;

  // If persona tone is outside the allowed range, pick the first allowed tone
  if (toneRange && toneRange.length > 0 && !toneRange.includes(persona.tone)) {
    tone = TONES[toneRange[0]] || tone;
  }

  const style = STYLES[persona.style] || STYLES.insight_first;

  return [
    `TONE: ${tone.label} — ${tone.prompt_hint}`,
    `STYLE: ${style.label} — ${style.prompt_hint}`,
    toneRange ? `ALLOWED TONES: ${toneRange.join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

export { TONES, STYLES, DEFAULT_PERSONA };
