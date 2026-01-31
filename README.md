# LinkedIn AI Comment Generator

Chrome extension that generates AI-powered comment suggestions for LinkedIn posts using the Claude API.

## Setup

```bash
npm install
npm run build
```

Then load `dist/` as an unpacked extension in `chrome://extensions` (enable Developer Mode).

## Configuration

1. Click the extension icon to open the side panel
2. Go to **Settings** tab and enter your Claude API key
3. Set your preferred persona (tone + style)
4. Browse LinkedIn — click **"Analyze"** on any post to generate comments

## Architecture

```
src/
├── background/service-worker.js   # Message routing, rate limiting, analysis pipeline
├── content/linkedin-scraper.js    # DOM scraping, "Analyze" button injection
├── sidepanel/                     # Side panel UI (HTML/CSS/JS)
├── api/claude.js                  # Claude API client, prompt construction
├── core/
│   ├── classifier.js              # Post classification (type, author, sentiment)
│   ├── strategies.js              # Strategy selection engine
│   ├── persona.js                 # Tone/style persona system
│   └── safety.js                  # Word limits, forbidden patterns, brand safety
├── storage/db.js                  # IndexedDB wrapper
└── learning/tracker.js            # Engagement tracking (stub)
```

## Constraints

- Max 30 words per comment
- 7 comments/hour, 2-minute gap between uses
- No generic phrases, no hashtags, minimal emojis
