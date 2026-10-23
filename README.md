# Relo

**Keep good connections moving.**

Relo is a private, visual workspace for the people, brands, creators, tools, and opportunities you want to do something with. It's a personal CRM for creators, entrepreneurs, and solo builders: no sales pipeline, no quotas, just cards you can move around and a next step for each one.

- **Open Relo:** https://nweinberg97.github.io/relo/app/
- **About Relo:** https://nweinberg97.github.io/relo/

> This is the first prototype. Data lives in your browser (IndexedDB). There's no account and no server. The full plan is in [`docs/PRD.md`](docs/PRD.md).

## What works today

- **Boards and stages** from six templates (Partnerships, Creators, People to know, Tools to try, Opportunities, Ideas & projects) or a blank board. Rename, add, and delete stages.
- **Drag and drop** between stages with a lifted card, an insertion line, edge auto-scroll, and a settle animation. Press and hold to drag on touch.
- **Keyboard moves:** focus a card, press `Space`, use arrow keys, `Enter` to drop, `Esc` to cancel. Arrow keys also move focus between cards.
- **Attention caps:** each board has a cap on cards in play. Parked stages don't count, so parking something actually frees room.
- **Card detail panel:** name, type, next steps, contact info, notes, description, type-specific fields, and an activity timeline. Edits autosave.
- **Contact info:** email, phone, website, Instagram, YouTube, TikTok, X, LinkedIn, podcasts, and any other link. Paste anything and Relo detects what it is; type a bare `@handle` and it asks which network. One click to email, call, open, or copy. Cards show small icons for how you can reach someone.
- **Notes:** a roomy notes field on every card for how you met, what they care about, and ideas to bring up.
- **Today:** overdue, today, and the next 7 days of next steps, with complete and snooze.
- **Quick add** (`C`): type a name, or paste a link, email, or `@handle` and Relo suggests a name and type.
- **Command palette** (`⌘K` / `Ctrl+K`): search cards and boards, run actions.
- **All cards:** search and filter by type, including archived cards.
- **Undo** for every change (toast button or `⌘Z` / `Ctrl+Z`).
- **Duplicate and archive** cards; duplicate boards.
- **Backup:** JSON export and import (validated before anything is replaced), CSV export.
- **Onboarding:** start with examples, or pick boards and add your first five cards. Examples clear in one click.
- **Light and dark mode**, reduced-motion support, and offline use after the first visit.
- **Landing page** with the interactive "Put them in order" demo.

## Run it locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/ (landing) or http://localhost:8000/app/
```

Opening `index.html` straight from disk won't work, because ES modules and IndexedDB need a real origin.

## Deploy to GitHub Pages

Settings → Pages → Build and deployment → Deploy from a branch → `main` / root. The site is served at `https://<user>.github.io/relo/`.

## Project layout

```
index.html, landing.css, landing.js   Landing page
app/index.html, app/app.css           The app shell and styles
app/js/db.js                          IndexedDB wrapper
app/js/store.js                       Workspace state, commands, undo, import/export
app/js/templates.js                   Board templates, card types, sample data
app/js/app.js                         Views and interactions
app/js/dnd.js                         Drag and drop
app/js/ui.js, app/js/icons.js         Toasts, dialogs, menus, dates, icons
assets/tokens.css                     Design tokens (colors, type, spacing, motion)
sw.js, manifest.webmanifest           Offline support and install
docs/PRD.md                           Product requirements
```

## Data and privacy

Everything is stored in this browser's IndexedDB. Nothing is sent anywhere. Clearing your browser's site data erases the workspace, so use Settings → Back up to keep a copy.

## Next

1. Decide how Claude connects (PRD §G.2): a local file bridge, the File System Access API, or hosted sync with a remote MCP server.
2. Build the MCP server and tool set (PRD §G.3).
3. Saved views, tags, and relationships between cards.
4. Settle the name and signature color (PRD "Open decisions").
