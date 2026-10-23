# PRD: A personal relationship CRM built for people who build things

Product requirements document · v1.0 · October 22, 2026 · Working product name: **Relo**

> **Prototype status.** The first build in this repo is a local-only prototype: plain JavaScript, no build step, data in IndexedDB. It covers the core loop (boards, drag-and-drop, card detail, Today, quick add, command palette, import/export) and the landing page. The Claude/MCP integration (section G) is not in the prototype; the storage choice for it is still open (see "Open decisions" at the end).

The central product decision is this: build a personal relationship workspace, not a miniature sales CRM. Every person, company, creator, tool, and opportunity is the same fundamental object. Boards give those objects context, stages show where things stand, and reminders make sure good intentions turn into action.

The product inherits Sedi's local-first philosophy, constrained layouts, tactile cards, and understated visual design. Its own identity comes from a different promise: keeping relationships moving without turning human connection into a quota.

One architectural distinction shapes the PRD: the web app can be fully local-first and static, but an external Claude MCP connection cannot reliably access browser IndexedDB on its own. The integration must bridge that gap deliberately.

## A. Name and positioning

### 1. Candidate names

Creative candidates, not cleared trademarks or verified domains.

| Name        | Pronunciation | Rationale                                                                    | Availability risk                                                     |
| ----------- | ------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Relo        | REH-loh       | Short, approachable, suggestive of relationships without sounding corporate. | High: short name, and "relo" is common shorthand for relocation.      |
| Nilo        | NEE-loh       | Soft, memorable, and naturally sits beside Sedi.                             | High: common name and existing brand possibilities.                   |
| Kinly       | KIN-lee       | Conveys closeness and human connection.                                      | High: likely crowded in consumer software.                            |
| Gather      | GATH-er       | Bringing relationships and intentions together.                              | Very high: common word, broad existing usage.                         |
| Orbit       | OR-bit        | People and opportunities move through a personal universe.                   | Very high: heavily used in software.                                  |
| Thread      | THRED         | Every relationship is an ongoing thread, not a one-off transaction.          | Very high: generic and established product usage.                     |
| Kindred     | KIN-drid      | Meaningful connections and shared interests.                                 | High: established word with broad brand use.                          |
| Peopleboard | PEE-pul-board | A visual board for relationships.                                            | Medium-high: descriptive, weak trademark distinctiveness.             |
| Relora      | reh-LOR-ah    | Invented, softer name with a relationship-oriented root.                     | Medium-high: coined names can still have existing registrations.      |
| Sela        | SEE-lah       | Short, calm, shares Sedi's compact, vowel-led character.                     | High: short names tend to be crowded.                                 |

Before committing, verify domains, GitHub org availability, app-store usage, and Canadian and US trademark databases.

### 2. Working name: Relo

Easy to say, short enough for an app icon, broad enough for people, companies, products, and opportunities. Sedi organizes personal work; Relo organizes the relationships that help that work become real. Provisional until clearance.

- **Tagline:** Keep good connections moving.
- **Positioning:** Relo is a private, visual relationship workspace for creators and independent builders who want to remember the right people, follow through on opportunities, and turn scattered intentions into meaningful connections.

**Why now**

- Independent builders work across creator platforms, communities, AI tools, and direct relationships without an operations team.
- AI assistants can now operate structured tools. Adding a person, logging a conversation, or setting a follow-up can happen through natural language.
- Local-first software is an appealing alternative to putting a personal relationship graph inside a company's sales platform.
- Traditional CRMs optimize sales processes. Relo optimizes the earlier, messier work of remembering who matters and deciding what to do next.

## B. Problem, principles, and non-goals

### The problem

Independent builders collect valuable relationships in browser tabs, social feeds, DMs, notes, and half-finished spreadsheets. They remember an interesting creator, intend to contact a potential partner, and discover a useful tool, but the context and next action are quickly lost. Conventional CRMs bring too much setup, too many fields, and a sales workflow that feels unnatural for personal projects. Relo gives these loose intentions one visual home, with just enough structure to make following through easy.

### Product principles

1. **A card in five seconds.** A title is enough to create a card. Everything else is optional.
2. **One object, many contexts.** A card can appear on multiple boards without disconnected copies.
3. **Next action beats historical reporting.** The question is "What should I do next?", not "How many activities did I log?"
4. **Limits create focus.** Boards stay intentionally small. Parking something is a legitimate outcome.
5. **Private by default.** The local app needs no account, no tracking, and no remote database.
6. **AI operates through explicit tools.** Claude uses the same validated actions as the interface, with confirmation and undo.
7. **Delight comes from feedback.** Movement feels tactile; success is quiet. No streaks, confetti cannons, or guilt.

### Non-goals for v1

- Email campaigns, automated outreach sequences, or email sending.
- Sales forecasting, lead scoring, quotas, or revenue pipelines.
- Team accounts, permissions, shared workspaces, or collaboration.
- Scraping private social profiles or automated contact harvesting.
- Automatic relationship scoring or AI judgments about a person's value.
- Mandatory accounts, subscriptions, analytics, or cloud sync.
- A full calendar, email client, contact directory, or social network.
- Autonomous outreach or sending messages through Claude.
- Infinite canvases, dashboard builders, or scripting.
- Native iOS and Android apps.

## C. Brand identity

### 1. Voice and tone

Relo speaks like a thoughtful creative partner: direct, warm, and confident without being overly familiar.

| Context           | Do                                                            | Don't                                          |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Empty board       | "A few good people to start with."                            | "Your pipeline is empty!"                      |
| Reminder          | "You planned to follow up with Maya today."                   | "You're falling behind."                       |
| Successful action | "Moved to Active."                                            | "Amazing! You're crushing it!"                 |
| Delete            | "Move this card to Trash?"                                    | "Are you absolutely sure?"                     |
| First run         | "Start with someone you want to know."                        | "Unlock the power of relationship management." |
| Error             | "Couldn't save that change. Your last saved version is safe." | "Oops! Something went wrong."                  |

Writing rules: sentence case for headings and buttons; concrete verbs (Add, Move, Follow up, Park, Restore); no pipeline, conversion, lead, or prospect; never imply a person is a task or an asset; exclamation marks sparingly; distinguish what the user entered from what was inferred from a URL.

### 2. Color system

Paper-white surfaces, near-black ink, cool grey wells, one signature periwinkle. Muted colors identify categories and stages; they never carry meaning alone.

#### Core tokens

| Token         | Light     | Dark      |
| ------------- | --------- | --------- |
| `ink-950`     | `#111111` | `#F5F5F6` |
| `ink-800`     | `#292B30` | `#E2E3E7` |
| `ink-600`     | `#565B66` | `#B4B8C2` |
| `ink-400`     | `#858B96` | `#858B96` |
| `paper`       | `#FFFFFF` | `#17191D` |
| `surface`     | `#FAFAFB` | `#1D2025` |
| `well`        | `#F5F6F8` | `#24272D` |
| `well-strong` | `#ECEEF1` | `#30343B` |
| `line`        | `#E6E7EB` | `#373B44` |
| `line-strong` | `#D2D5DC` | `#4A505A` |
| `brand`       | `#596CB3` | `#A7B5F2` |
| `brand-soft`  | `#EEF0FA` | `#292F49` |
| `focus`       | `#5268C5` | `#A7B5F2` |

#### Category and stage tokens

| Category    | Light text | Light tint | Dark text | Dark tint |
| ----------- | ---------- | ---------- | --------- | --------- |
| Person      | `#596CB3`  | `#EEF0FA`  | `#A7B5F2` | `#292F49` |
| Creator     | `#8463AD`  | `#F3EFF8`  | `#C4ADE5` | `#362A43` |
| Brand       | `#9A7040`  | `#F7F0E6`  | `#D8B581` | `#3B3023` |
| Tool        | `#417E68`  | `#EAF4EF`  | `#94D2B5` | `#243A31` |
| Opportunity | `#A35D70`  | `#F8EDF0`  | `#E2A9B8` | `#422B33` |
| Community   | `#4E7E95`  | `#EAF2F6`  | `#9BC9DC` | `#253740` |
| Project     | `#72764C`  | `#F1F2E7`  | `#C5CA92` | `#363924` |
| Neutral     | `#626873`  | `#F0F1F3`  | `#BFC3CB` | `#30343A` |

#### Semantic tokens

| Token          | Light     | Dark      |
| -------------- | --------- | --------- |
| `success`      | `#26734D` | `#8BD0A7` |
| `success-soft` | `#E8F5EC` | `#24382C` |
| `warning`      | `#875B16` | `#E6BF76` |
| `warning-soft` | `#FBF1DE` | `#3A3020` |
| `danger`       | `#B43B3B` | `#FF9D9D` |
| `danger-soft`  | `#FBEAEA` | `#402628` |

All text/background pairs must meet WCAG 2.2 AA (4.5:1 normal text, 3:1 large text and UI boundaries). These values are a starting palette; the build must check contrast and adjust failing pairs before release.

### 3. Typography

Inter for interface text with a system sans-serif fallback. Self-host fonts for offline use.

| Token         | Size / line height | Weight | Usage                           |
| ------------- | ------------------ | ------ | ------------------------------- |
| `display`     | 48 / 56 px         | 600    | Landing-page hero               |
| `h1`          | 32 / 40 px         | 600    | Page titles                     |
| `h2`          | 24 / 32 px         | 600    | Board and panel titles          |
| `h3`          | 18 / 26 px         | 600    | Section headings                |
| `body`        | 14 / 22 px         | 400    | Primary UI copy                 |
| `body-strong` | 14 / 22 px         | 550    | Card titles and selected labels |
| `small`       | 12 / 18 px         | 400    | Metadata and timestamps         |
| `micro`       | 11 / 16 px         | 500    | Short labels only               |
| `button`      | 13 / 18 px         | 550    | Buttons and commands            |

Wrap long names to two lines in compact cards; show the full name in the detail panel.

### 4. Logo direction

Two overlapping rounded rectangles with a small shared connection point: two independent objects linked by a relationship. 24 × 24 grid, 2 px stroke, 6 px radius, no gradients. Wordmark in Inter SemiBold. App icon: periwinkle square with a white mark. On hover the front rectangle translates 1.5 px and rotates 2° over 180 ms; under reduced motion only the color changes.

### 5. Iconography, illustration, and empty states

Lucide-style line icons, 16 or 18 px, 1.75 px strokes. No emoji as interface icons. Sparse line illustrations of connected cards; no stock photography or gradient art.

- Partnerships: "The next good collaboration starts somewhere." / `Add a brand`
- Creators: "Keep the people whose work moves you close." / `Add a creator`
- Tools: "Curiosity, collected." / `Add a tool`
- Today: "Nothing needs your attention today." / `See all reminders`

## D. Design system

### 1. Layout and surface tokens

| Token                | Value  | Use                         |
| -------------------- | ------ | --------------------------- |
| `space-1` … `space-10` | 4, 8, 12, 16, 20, 24, 32, 40 px | Spacing scale |
| `radius-sm`          | 8 px   | Inputs, tags                |
| `radius-md`          | 12 px  | Compact cards               |
| `radius-lg`          | 16 px  | Expanded cards, panels      |
| `radius-xl`          | 22 px  | Modals, hero demonstrations |
| `radius-pill`        | 999 px | Stage pills                 |
| `column-width`       | 272 px | Board column                |
| `column-gap`         | 16 px  | Between columns             |
| `card-min-height`    | 88 px  | Compact card                |
| `sidebar-width`      | 232 px | Desktop navigation          |
| `detail-panel-width` | 440 px | Desktop detail panel        |
| `header-height`      | 56 px  | Main toolbar                |

Desktop boards scroll horizontally, not vertically within each column. Below 760 px the sidebar becomes a drawer, columns become a swipeable stage view, and the detail panel becomes a full-screen sheet.

### 2. Elevation and blur

| Token         | Definition                                                     | Purpose               |
| ------------- | -------------------------------------------------------------- | --------------------- |
| `shadow-1`    | `0 1px 2px rgba(17,17,17,.04), 0 1px 3px rgba(17,17,17,.05)`   | Resting card          |
| `shadow-2`    | `0 4px 12px rgba(17,17,17,.08), 0 1px 3px rgba(17,17,17,.05)`  | Hover                 |
| `shadow-3`    | `0 12px 28px rgba(17,17,17,.14), 0 3px 8px rgba(17,17,17,.07)` | Drag lift             |
| `shadow-4`    | `0 20px 60px rgba(0,0,0,.18)`                                  | Modal                 |
| `blur-header` | 16 px                                                          | Frosted header        |
| `blur-modal`  | 4 px                                                           | Modal backdrop        |

Dark mode uses more opaque shadows and stronger surface separation.

### 3. Motion specification

Shared easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`. Animate transforms and opacity only.

| Interaction   | Motion                                                     | Duration     | Reduced motion                    |
| ------------- | ---------------------------------------------------------- | ------------ | --------------------------------- |
| Card hover    | Translate Y −2 px; shadow 1 → 2                            | 160 ms       | Border and shadow only            |
| Card press    | Scale 0.985                                                | 90 ms        | Immediate pressed color           |
| Drag lift     | Translate Y −4 px; scale 1.02; shadow 3; rotate ≤ 1°       | 150 ms       | No scale or rotation              |
| Drag ghost    | Follows pointer via transform                              | Frame-synced | Outline placeholder               |
| Drop settle   | Y +2 px then return; scale 1 → 0.99 → 1                    | 220 ms       | Instant placement                 |
| Reorder       | Neighbors translate to new slots                           | 180 ms       | Instant                           |
| Duplicate     | Fade in, Y +6 → 0                                          | 180 ms       | Immediate                         |
| Delete / undo | Collapse and fade; undo restores position                  | 180 ms       | Immediate                         |
| Open card     | Panel enters from right by 16 px with opacity              | 220 ms       | Immediate                         |
| Stage change  | Pill color change; card settles                            | 200 ms       | Instant                           |
| Celebration   | 1.02 pulse and soft ring                                   | 240 ms       | Static success indicator          |
| Toast         | Y +8 → 0 and fade                                          | 180 ms       | Immediate                         |

One celebration at a time. Dragging never triggers open. Touch never depends on hover.

### 4. Component inventory

- **Card (compact / expanded):** avatar or initials, title, category chip, next-step indicator, overflow menu. Hover lifts; click opens details; `Space` picks up a focused card for keyboard movement.
- **Board column:** stage title, count, capacity indicator, add button, ordered cards. 272 px wide. Empty columns show a dashed drop target.
- **Stage pill, tag, avatar chip:** tinted backgrounds with readable text. Missing images fall back to initials or a category icon.
- **Command palette and quick add:** centered 560 px dialog, grouped results, shortcut hints, keyboard-only operation.
- **Side panel and toast:** 440 px panel with editable fields, links, tags, timeline, reminder. Toasts sit 24 px above the bottom, last 4 s, and offer Undo.

All components define default, hover, focus, active, disabled, loading, and error states, distinguishable without color alone.

The ready-to-use CSS custom properties live in [`styles.css`](../styles.css).

## E. Information architecture and data model

### 1. Navigation

- **Today:** reminders overdue, due today, and upcoming; recently touched cards.
- **Boards:** each with its own stages and ordering.
- **All cards:** global search and filters.
- **Templates** and **Settings** (theme, backup, import, storage, Claude connection).

Quick add and `⌘K` / `Ctrl+K` are available everywhere. There is no analytics dashboard.

### 2. Universal card model

A card is the canonical record. Board placement is a separate relationship, so one card can appear on multiple boards. IDs are UUIDs; stored dates are ISO 8601 UTC; reminders keep an explicit time zone.

### 3. TypeScript schema

```ts
type ID = string;
type ISODate = string;

type CardType = "person" | "company" | "creator" | "tool" | "opportunity" | "community" | "project" | "other";

type Stage = { id: ID; boardId: ID; name: string; colorToken: string; order: number; isTerminal?: boolean };

type Board = { id: ID; name: string; description?: string; attentionCap: number; order: number; createdAt: ISODate; updatedAt: ISODate };

type BoardPlacement = { id: ID; cardId: ID; boardId: ID; stageId: ID; order: number; createdAt: ISODate; updatedAt: ISODate };

type LinkKind = "website" | "email" | "linkedin" | "instagram" | "youtube" | "tiktok" | "x" | "podcast" | "other";
type CardLink = { id: ID; kind: LinkKind; label?: string; url: string };

type Tag = { id: ID; name: string; colorToken?: string };

type Reminder = {
  id: ID; cardId: ID; title: string; dueAt: ISODate; timeZone: string;
  status: "open" | "completed" | "snoozed"; snoozedUntil?: ISODate;
  createdAt: ISODate; completedAt?: ISODate;
};

type Touchpoint = {
  id: ID; cardId: ID;
  kind: "note" | "message" | "meeting" | "call" | "email" | "research" | "status_change";
  summary: string; occurredAt: ISODate; createdAt: ISODate;
  source: "user" | "claude" | "import" | "system";
};

type Relationship = {
  id: ID; fromCardId: ID; toCardId: ID;
  kind: "works_with" | "founded" | "created_by" | "uses" | "recommended_by" | "related_to";
  note?: string; createdAt: ISODate;
};

type Card = {
  id: ID; title: string; type: CardType; description: string; notes: string;
  links: CardLink[]; tagIds: ID[];
  customFields: Record<string, string | number | boolean | null>;
  createdAt: ISODate; updatedAt: ISODate; archivedAt?: ISODate; deletedAt?: ISODate;
  source: "manual" | "import" | "url" | "claude" | "sample";
};

type WorkspaceData = {
  schemaVersion: number;
  cards: Card[]; boards: Board[]; stages: Stage[]; placements: BoardPlacement[];
  tags: Tag[]; reminders: Reminder[]; touchpoints: Touchpoint[]; relationships: Relationship[];
};
```

Type-specific data (creator platforms and audience size, tool pricing and trial status, company industry) lives in `customFields` in v1, restricted to JSON primitives.

### 4. Data integrity rules

1. Every placement references an existing card, board, and a stage of that board.
2. Every reminder and touchpoint references an existing card.
3. Every relationship references two distinct existing cards.
4. Deleting a card never silently destroys its history; deletions go to Trash.
5. Archived cards are hidden from default views but stay searchable.
6. Reordering is scoped to one board and stage. Moving across boards updates a placement, not the card.
7. All mutations validate references and types before writing.
8. IDs never depend on titles, URLs, or positions.

### 5. Day-one board templates

| Template         | Default stages                                                     | Attention cap |
| ---------------- | ------------------------------------------------------------------ | ------------- |
| Partnerships     | Idea → Reach out → In conversation → Active → Parked               | 20            |
| Creators         | Discovered → Research → Reach out → Collaborating → Parked         | 25            |
| People to know   | Interested → Introduce myself → Connected → Keep in touch → Parked | 25            |
| Tools to try     | Curious → To try → Trying → Adopted → Not for me                   | 20            |
| Opportunities    | Found → Evaluate → Pursue → In progress → Closed / Parked          | 20            |
| Ideas & projects | Spark → Exploring → Building → Shipped → Parked                    | 15            |

Stages can be renamed, reordered, added, or removed. Deleting a stage with cards requires choosing where those cards go.

## F. Core experience and features

### 1. Capture in seconds

Quick add opens with `C` (outside text fields) or `⌘N` / `Ctrl+N`. Pasting a URL or handle saves it as a link and suggests a name. Type, board, stage, and reminder are optional; board and stage default to the current view.

Enrichment is best effort. A static app cannot read most third-party pages, so the URL is always saved and the user names the card. (Claude, once connected, is the better enrichment path: it can look a person up and fill the card.)

Acceptance: a title-only card in ≤ 5 s; quick add opens in < 100 ms warm; `Enter` saves; failed previews never block saving; works offline; focus returns to the originating view.

### 2. Boards and drag-and-drop

Drag between stages and reorder within a stage, with an insertion line before commit. Keyboard: focus a card, `Space` to pick up, arrows to choose a target, `Enter` to drop, `Escape` to cancel. If a stage is full, show a clear message and offer to raise the cap.

Acceptance: moves persist; cancelled drags change nothing; a stage change records a touchpoint; every operation is possible without a pointer.

### 3. Duplicate and templates

Duplicate copies title, description, notes, links, tags, and custom fields, with a new ID, inserted after the original with "Copy" appended. Touchpoints, reminders, and relationships are not copied. Duplicate board copies stages and settings; cards are not copied by default. Duplicates can be undone.

### 4. Card detail

A right-side panel with title, type, stage, description, notes, links, type-specific fields, tags, related cards, next step, and activity timeline. Inline editing autosaves after 400 ms. The timeline records meaningful actions and labels their source.

### 5. Follow-ups: Today

Overdue, due today, upcoming (7 days), and recently touched cards. Each reminder supports Complete, Snooze (1 day, 3 days, 1 week), Reschedule, and Open card. No push notifications in v1. Clearing everything shows the calm empty state, never a score or streak.

### 6. Command palette

`⌘K` / `Ctrl+K` searches cards, boards, and actions: create, open, move, add reminder, log touchpoint, duplicate, archive, undo, switch board or theme, export. Arrow keys, `Enter`, `Escape`. Destructive commands confirm.

### 7. Search, filters, and saved views

Case-insensitive search over titles, descriptions, notes, links, and tags. Filters by type, board, stage, tag, reminder state, and archived state. Saved views store queries, not snapshots. Target ≤ 100 ms for 5,000 cards, offline.

### 8. Limits by design

Each board has an attention cap. Stages warn at 80% and block at 100%. **Terminal stages (Parked, Not for me, Closed) do not count toward the cap**, so parking something actually frees attention. No card is ever deleted automatically.

### 9. Import and export

JSON is the complete backup and round-trips all objects and IDs. CSV is for spreadsheets. Imports validate fully before committing and never replace data on failure.

### 10. Onboarding: five cards in two minutes

Welcome ("Keep good connections moving.") → pick starting boards → add up to five cards → set one next step. Sample data is labeled and can be cleared in one click without touching user cards. No account or email.

### 11. Moments of delight

URL resolves into a named card; cards lift on hover; a clean insertion gap on drag; a soft pulse when a card lands in an active stage; "One less thing to hold in your head." on completing a reminder; duplicates appear beside the original; an empty Today says "Nothing needs your attention today."; restoring a card returns it to its old place; undo without a page refresh. Reduced motion suppresses all movement. No streaks, points, or badges.

## G. Claude and MCP integration

### 1. Goal

"Add Maya Chen to Creators, move her to Reach out, and remind me Friday" should happen in Claude and show up in Relo.

### 2. Architecture (open decision)

A local stdio MCP server cannot read the app's IndexedDB, and only works in Claude Desktop and Claude Code (not Claude on the web or mobile). Options:

1. **File bridge:** the app exports `workspace.json`; a local MCP server edits it; the app imports changes. Simple and private, but not live.
2. **File System Access API:** the app holds a handle to the same `workspace.json` the MCP server edits and watches it. Near-live with no backend; Chromium only; desktop Claude only.
3. **Hosted sync (e.g. Supabase) + remote MCP server:** live everywhere, including Claude on the web and phone. Requires an account and moves data off the device.

The prototype stays on IndexedDB. Pick an option before milestone 4.

### 3. Tool contract

Every result uses one envelope:

```ts
type MCPResult<T> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
  change?: { changeId: string; undoToken?: string; requiresSync: boolean };
};
```

| Tool                | Input                                                                                          | Output                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `create_card`       | `{title, type?, description?, boardId?, stageId?, links?, tagIds?}`                            | `{card, placement?, change}`                   |
| `update_card`       | `{cardId, patch, expectedUpdatedAt?}`                                                          | `{card, change}`                               |
| `move_card`         | `{cardId, boardId, stageId, beforeCardId?}`                                                    | `{placement, change}`                          |
| `search_cards`      | `{query?, type?, boardId?, stageId?, tagIds?, includeArchived?, limit?}`                       | `{cards, total}`                               |
| `log_touchpoint`    | `{cardId, kind, summary, occurredAt?}`                                                         | `{touchpoint, change}`                         |
| `set_reminder`      | `{cardId, title, dueAt, timeZone, reminderId?}`                                                | `{reminder, change}`                           |
| `list_due`          | `{from?, to?, timeZone, includeSnoozed?}`                                                      | `{reminders, total}`                           |
| `get_board`         | `{boardId?, name?, includeCards?}`                                                             | `{board, stages, placements?, cards?}`         |
| `duplicate_card`    | `{cardId, title?, boardId?, stageId?}`                                                         | `{card, placement?, change}`                   |
| `complete_reminder` | `{reminderId, completedAt?}`                                                                   | `{reminder, change}`                           |
| `archive_card`      | `{cardId}`                                                                                     | `{card, change}`                               |
| `undo_change`       | `{changeId, undoToken}`                                                                        | `{restored, change}`                           |
| `list_changes`      | `{since?, limit?, source?}`                                                                    | `{changes}`                                    |

`search_cards.limit` defaults to 20 (max 100). `get_board` by name only resolves unique matches. `update_card` uses a field allowlist. `archive_card` is reversible. A `batch_actions` tool runs up to 20 actions atomically.

### 4. Example requests

| Request                                            | Tool sequence                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| "Add Maya Chen to Creators in Reach out."          | `get_board(name="Creators")` → `create_card(...)`                                                   |
| "Find the three podcast hosts I mentioned."        | `search_cards(query="podcast")` → `search_cards(query="host")` → ask before inventing names          |
| "Move Maya into Collaborating."                    | `search_cards` → `get_board` → `move_card`                                                           |
| "Remind me to email Alex on Friday at 10 AM."      | `search_cards(query="Alex")` → `set_reminder(...)`                                                   |
| "Log that I spoke with Jordan about a podcast."    | `search_cards` → `log_touchpoint(kind="meeting")`                                                    |
| "Who do I need to follow up with today?"           | `list_due(...)`                                                                                      |
| "Duplicate this brand card for a second campaign." | `search_cards` → `duplicate_card(...)`                                                               |
| "What do I know about Maya and Northstar?"         | `search_cards` ×2 → summarize relationships and touchpoints                                          |
| "Archive the old partnership with Acme."           | `search_cards` → confirm → `archive_card`                                                            |
| "Undo the last change you made."                   | `list_changes(source="claude")` → `undo_change`                                                      |

### 5. Confirmation, undo, audit, privacy

Unambiguous creates, edits, moves, and reminders run directly. Archives, multi-card moves, and batches show a confirmation summary. No permanent deletion through Claude. Every mutation returns a change ID and undo token; the timeline labels the source "Claude". Writes use a revision number and fail with `REVISION_CONFLICT` if the data changed underneath. The UI explains exactly what data is exposed before enabling the integration, and that the AI service processes it under its own policies.

## H. Landing page

### Copy

- **Hero:** "Good connections shouldn't get lost." / "Keep track of the people, brands, ideas, and opportunities you want to do something with. Then follow through." / `Start your workspace` · `See how it works` / "Private by default. No account required."
- **Problem:** "From 'I should reach out' to 'I did.'" / "Your next collaboration shouldn't depend on remembering a tab you opened three weeks ago."
- **One card model:** "One place for all the people and possibilities." / "Creators, companies, tools, collaborators, and opportunities. Capture them once. Give each one a next step."
- **Calm by design:** "A little structure goes a long way." / "Move cards. Park distractions. Keep your attention on the relationships that matter now."
- **Claude:** "Tell Claude. Relo takes care of the details." / "Add people, log conversations, move cards, and plan follow-ups in natural language. You stay in control of every change."
- **Privacy:** "Your relationships belong to you." / "Your workspace lives on your device. Export it whenever you want. Connect Claude only when you choose."
- **Close:** "Keep good connections moving." / "Start with five cards. See what changes when nothing important gets lost." / `Start with Relo`

### Signature interaction: "Put them in order"

Four scattered cards (Maya Chen · Creator, Northstar Wellness · Brand, Alex Rivera · Collaborator, Studio Notes · Tool) at −2° to 2°, labeled "Saved somewhere", "Need to follow up", "Look into later".

1. 0–150 ms: cards lift, rotation eases to zero, shadows deepen.
2. 150–350 ms: cards slide into three columns: Reach out, In conversation, Explore.
3. 350–550 ms: stage pills appear; a next-step date appears on the card that needs follow-up.
4. 550–750 ms: cards settle; "Nothing important left floating around." appears.
5. The button toggles `Put them in order` / `Scatter them again`. Reduced motion snaps with an opacity fade.

The Claude section shows a request, the validated changes (create card, place in stage, set reminder), and the result with an undo path. Any simulation is labeled as a demo until the integration ships.

Requirements: 680 px max text width; no autoplay video, newsletter modal, cookie banner, or fake testimonials; core message works without JavaScript; 44 × 44 px touch targets.

## I. Technical architecture

### Prototype (this repo)

- Plain HTML, CSS, and ES modules. No build step; deploys directly to GitHub Pages.
- IndexedDB through a small hand-written wrapper.
- Custom pointer-event drag and drop with keyboard equivalents.
- Service worker for offline use.

### Full v1 (per PRD, revisit after prototype)

React + TypeScript + Vite, `@dnd-kit`, Dexie, Zod, `vite-plugin-pwa`, Lucide, the official TypeScript MCP SDK, Vitest + Playwright, deployed by GitHub Actions. A shared `core` package owns types, validation, and domain commands for both the app and the MCP server.

### Budgets and quality

LCP ≤ 2.5 s mobile; CLS ≤ 0.1; INP ≤ 200 ms; palette ≤ 100 ms warm; search ≤ 100 ms at 5,000 cards; 60 fps drag. WCAG 2.2 AA, full keyboard support, visible focus, screen-reader announcements for drag and undo, reduced motion everywhere. Latest two versions of Chrome, Edge, Firefox, Safari, plus iOS Safari. Never silently clear IndexedDB; a failed migration keeps a recoverable backup.

## J. Roadmap and success

### Milestones

1. **Foundation:** data model, IndexedDB, boards and cards, JSON export.
2. **Core interaction:** card components, drag and drop, duplicate, keyboard, palette, detail panel.
3. **Follow-through:** reminders, Today, timeline, search, limits, import/export.
4. **Claude integration:** MCP server, revision checks, change journal, undo.
5. **Release quality:** responsive layout, onboarding, landing page, offline, accessibility, deploy.

### Later

V1.1: browser capture extension, better CSV mapping, custom fields, recurring reminders. V1.2: optional encrypted sync. V2: multi-device, sharing, richer relationship graph, calendar.

### Success metrics (opt-in studies only; no silent telemetry)

| Metric              | Definition                                                | Initial target |
| ------------------- | --------------------------------------------------------- | -------------- |
| Activation          | ≥ 5 real cards and one next step within 24 h              | ≥ 60%          |
| Time to value       | First open to fifth card                                  | < 2 min median |
| Week-one retention  | Used on ≥ 2 days in week one                              | ≥ 40%          |
| Week-four retention | Still weekly in week four                                 | ≥ 25%          |
| Follow-through      | Reminders completed or rescheduled                        | ≥ 50%          |
| Claude adoption     | Connected users with ≥ 1 MCP action weekly                | ≥ 30%          |
| Data safety         | Data loss in backup/restore tests                         | 0              |

### Risks

| Risk                          | Mitigation                                                    |
| ----------------------------- | ------------------------------------------------------------- |
| Another abandoned tool        | Title-only cards, five-card onboarding, good templates        |
| Boards become backlogs        | Attention caps, Parked stages outside the cap, archive        |
| Feels transactional           | Human language; no scoring, quotas, or conversion dashboards  |
| Claude sync is awkward        | Decide architecture deliberately; show sync state honestly    |
| Local data is lost            | Backup reminders, validated imports, migration tests          |
| URL enrichment fails          | Always save the link; let Claude enrich                       |
| Claude makes unintended edits | Target resolution, confirmation, journal, undo                |

## Open decisions

1. **Name.** "Relo" is the working name; "relo" commonly means relocation, so check search and trademark collisions before launch.
2. **Claude integration architecture** (section G.2).
3. **Signature color.** The brand periwinkle is close to Sedi's and identical to the Person category color; consider a distinct signature hue.
