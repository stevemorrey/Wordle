
# Daily Word Game (Wordle-style)

A lightweight, dependency-free web app that picks a 5-letter **word of the day**. You can
optionally override the word for specific dates via `daily-words.json`.

## Features
- 5-letter, 6-attempt word guessing with proper letter evaluation (handles duplicates).
- Deterministic daily word rotation from `words.json` so everyone sees the same word.
- Optional override by date using `daily-words.json`.
- On-screen keyboard + physical keyboard support.
- Local storage persistence per-day.
- Share result (emoji grid copied to clipboard).

## Quick start
1. Serve the folder with any static web server (e.g., VS Code Live Server, `python -m http.server`).
2. Open `index.html` in your browser.
3. To set a specific word for a date, edit `daily-words.json` and add an entry like:
   ```json
   { "2026-01-06": "BRAVE" }
   ```

## Changing the word daily
- **Automatic**: The app derives the word from the calendar date using a rotation across `answers` in `words.json`.
- **Manual override**: Put today's date in `daily-words.json` with the desired 5-letter uppercase word.

## Deployment
- Host on any static hosting (GitHub Pages, Netlify, Azure Static Web Apps). Upload the folder contents.
- Ensure `daily-words.json` is redeployed whenever you change a date mapping.

## Optional server-side control
If you want a central admin to set today's word without redeploying, add a simple endpoint that returns JSON:
```json
{ "2026-01-06": "BRAVE" }
```
Then modify `script.js` to fetch that endpoint instead of the local `daily-words.json`.

## Notes
- The included word lists are small examples. You can expand `answers` and `allowed` with any 5-letter words.
- Default rotation starts from 2026-01-01; adjust in `script.js` if you prefer another baseline.

## License
MIT
