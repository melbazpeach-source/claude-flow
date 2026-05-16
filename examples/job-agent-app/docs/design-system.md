# Job Agent Squad — Design System Spec

A Figma-ready spec reverse-engineered from `examples/job-agent-app/demo.html`.
Drop this file into Figma AI, Claude Desktop, or any LLM with design-tool
plugins to scaffold a matching component library.

---

## 1. Design tokens

### 1.1 Colors

**Dark theme (default).** Six functional roles plus four semantic accents.

| Token         | Hex       | Role                                            |
| ------------- | --------- | ----------------------------------------------- |
| `bg`          | `#0F1115` | App background                                  |
| `panel`       | `#161922` | Surface 1 — cards, header, inputs               |
| `panel-2`     | `#1E2230` | Surface 2 — buttons, log boxes, letter editor   |
| `text`        | `#E7EBF3` | Primary text                                    |
| `muted`       | `#8A93A6` | Secondary text, meta, labels                    |
| `border`      | `#2A2F3D` | Hairlines, dividers, idle stars                 |
| `accent`      | `#6AA9FF` | Links, hover, "saved" badge                     |
| `accent-2`    | `#4F8CF0` | Primary action buttons, page-level pill         |
| `good`        | `#5FD17F` | Strengths, "progress" badge                     |
| `warn`        | `#F0B35F` | Stars, "drafted" badge                          |
| `bad`         | `#EF6E6E` | Destructive, gaps, errors                       |

**Light theme.** Only neutrals are remapped today; accents reuse the dark
palette (see §4 for a refined light-mode proposal).

| Token         | Hex       |
| ------------- | --------- |
| `bg`          | `#F6F7FB` |
| `panel`       | `#FFFFFF` |
| `panel-2`     | `#F0F2F7` |
| `text`        | `#1A1D24` |
| `muted`       | `#5B6173` |
| `border`      | `#E0E3EC` |

#### As CSS custom properties

```css
:root {
  --bg: #0F1115;
  --panel: #161922;
  --panel-2: #1E2230;
  --text: #E7EBF3;
  --muted: #8A93A6;
  --border: #2A2F3D;
  --accent: #6AA9FF;
  --accent-2: #4F8CF0;
  --good: #5FD17F;
  --warn: #F0B35F;
  --bad: #EF6E6E;
}
@media (prefers-color-scheme: light) {
  :root {
    --bg: #F6F7FB;
    --panel: #FFFFFF;
    --panel-2: #F0F2F7;
    --text: #1A1D24;
    --muted: #5B6173;
    --border: #E0E3EC;
  }
}
```

#### As Style Dictionary JSON

```json
{
  "color": {
    "bg":      { "value": "#0F1115" },
    "panel":   { "value": "#161922" },
    "panel2":  { "value": "#1E2230" },
    "text":    { "value": "#E7EBF3" },
    "muted":   { "value": "#8A93A6" },
    "border":  { "value": "#2A2F3D" },
    "accent":  { "value": "#6AA9FF" },
    "accent2": { "value": "#4F8CF0" },
    "good":    { "value": "#5FD17F" },
    "warn":    { "value": "#F0B35F" },
    "bad":     { "value": "#EF6E6E" }
  }
}
```

### 1.2 Typography

Single family stack, six sizes.

| Token      | Size / line-height | Weight | Usage                         |
| ---------- | ------------------ | ------ | ----------------------------- |
| `font-xs`  | 11.5 / 1.4         | 500    | Badges, pills                 |
| `font-sm`  | 12.5 / 1.45        | 400    | Card meta, captions           |
| `font-md`  | 13 / 1.5           | 400    | Hints, fieldset labels        |
| `font-base`| 14 / 1.45          | 400    | Body, inputs, buttons         |
| `font-lg`  | 15 / 1.35          | 600    | Card title (h3)               |
| `font-xl`  | 18 / 1.3           | 600    | Header (h1)                   |

Family stacks:

```css
--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, Menlo, Consolas, monospace;
```

`textarea` and the agent log use `--font-mono`. Everything else uses `--font-sans`.

### 1.3 Spacing

8-point scale with two half-step values.

| Token      | px  | Common usage                                  |
| ---------- | --- | --------------------------------------------- |
| `space-1`  | 4   | Tab nav gap, inline list item gap             |
| `space-1-5`| 6   | Button padding-y                              |
| `space-2`  | 8   | Action row gap, small padding                 |
| `space-2-5`| 10  | Input padding-y, log padding                  |
| `space-3`  | 12  | Button padding-x, fieldset padding            |
| `space-4`  | 16  | Section gap, fieldset margin                  |
| `space-6`  | 24  | Page padding, header padding                  |

### 1.4 Radii

| Token         | px  | Used by                                  |
| ------------- | --- | ---------------------------------------- |
| `radius-sm`   | 6   | Buttons, inputs, log, tab pill           |
| `radius-md`   | 8   | Fieldset, banner, letter editor          |
| `radius-lg`   | 10  | Job card                                 |
| `radius-pill` | 999 | Badges, header pill                      |

### 1.5 Elevation

The current design uses **no shadows** — separation comes from layered
surfaces (`panel` over `bg`, `panel-2` over `panel`) plus 1px borders.

Recommended elevation scale to add:

| Token       | Value                                | Use                       |
| ----------- | ------------------------------------ | ------------------------- |
| `shadow-0`  | none                                 | Resting cards             |
| `shadow-1`  | `0 1px 2px rgba(0,0,0,.25)`          | Hovered cards             |
| `shadow-2`  | `0 8px 24px rgba(0,0,0,.35)`         | Popovers, dropdowns       |
| `shadow-3`  | `0 24px 64px rgba(0,0,0,.45)`        | Modal dialog              |

### 1.6 Motion

| Token              | Value             | Use                                |
| ------------------ | ----------------- | ---------------------------------- |
| `motion-fast`      | 120ms ease-out    | Hover, button press                |
| `motion-base`      | 200ms ease-out    | Tab swap, panel show               |
| `motion-deliberate`| 420ms             | Agent log line-by-line reveal      |

Respect `prefers-reduced-motion: reduce` — see §3.

---

## 2. Component inventory

Each component lists: **props**, **states**, **slots**, **anatomy notes**.

### 2.1 AppHeader

App-level chrome at top of viewport.

- **Props:** `title`, `badge?`
- **States:** static
- **Anatomy:**
  - `h1` with optional inline pill badge (font-xs, accent-2 background)
  - Below: `TabNav`
- **Layout:** 16px vertical, 24px horizontal padding; 1px bottom border in `border`.

### 2.2 TabNav

- **Props:** `items: { id, label }[]`, `activeId`
- **States per tab:** `default`, `hover`, `active`
- **Anatomy:**
  - Flex row, `gap: space-1` (4px), wraps on narrow viewports
  - Tab is a button-shaped pill: `padding: 6px 12px`, `radius-sm`
  - Default: transparent bg + transparent border + `muted` text
  - Hover: `text` color, border still transparent
  - Active: `panel-2` bg, `border` color, `text` color
- **A11y to add:** `role="tablist"` on container; `role="tab"`, `aria-selected`, `aria-controls` on each button.

### 2.3 Banner

Top-of-page info strip.

- **Props:** `tone: 'info' | 'success' | 'warn' | 'danger'`, `children`
- **States:** static
- **Anatomy:** `panel` bg, 1px `accent` border (for `info`), `radius-md`, padding `space-2-5 space-3-5`, `font-md` (13px). Inline `code` uses `panel-2` bg.

### 2.4 Fieldset

Grouped form controls.

- **Anatomy:**
  - `panel` bg, 1px `border`, `radius-md`, padding `12px 16px`
  - `legend` sits in `text` color, padded `0 6px`
  - Each `label` is a stacked field: 13px `muted` label + control below
- **Pattern:** put short label text above a full-width input.

### 2.5 TextField / TextArea

- **Props:** `value`, `placeholder`, `type`, `multiline`, `rows?`
- **States:** `default`, `focus`, `disabled`, `error` (add new)
- **Anatomy:**
  - `panel` bg, 1px `border`, `radius-sm`, `padding: 8px 10px`
  - Full-width by default
  - Mono family for textareas, vertical-resize
- **A11y to add:** explicit 2px focus ring (`outline: 2px solid var(--accent)`).

### 2.6 CheckBox / Radio

- Native HTML, vertical stack inside `label`.
- **A11y note:** label currently wraps the input on the same line — keep that pattern; ensure visible focus ring is preserved.

### 2.7 Button

Three variants + a file-input "label-as-button" pattern.

- **Variants:** `default`, `primary`, `danger`, `btn-label` (file input wrapper)
- **States:** `default`, `hover`, `active`, `focus`, `disabled` (add new), `loading` (add new)
- **Anatomy:** `padding: 7px 12px`, `radius-sm`, 1px border, `font-base`
  - `default`: `panel-2` bg, `border` border, `text` color → on hover, border becomes `accent`
  - `primary`: `accent-2` bg + border, white text → hover lifts to `accent`
  - `danger`: transparent bg, `bad` border + text → fills `bad` on hover (add)
  - `btn-label`: same as `default`, wraps an invisible `<input type="file">`

Add a **loading state**: replace label with inline spinner + dim opacity; disable `pointer-events`.

### 2.8 RatingStars

- **Props:** `value: 1..5`, `max: 5`, `label?` (tooltip)
- **States:** static; consider an `interactive` mode for filtering later
- **Anatomy:** five `★` glyphs, 16px, letter-spacing 1px. Idle = `border`, filled = `warn`.
- **A11y:** wrapper has `aria-label="3 of 5 stars"` (currently just `agent rating`). Use `role="img"` and an SR-only numeric label so screen readers don't read "star star star border border".

### 2.9 Badge

Status pill, used in card meta lines.

- **Variants:** `default`, `status-saved` (accent), `status-progress` (good), `status-drafted` (warn)
- **Anatomy:** `font-xs`, `padding: 2px 7px`, `radius-pill`, 1px border, foreground == border color, transparent bg.

### 2.10 JobCard

The core list item — used in Hunt results, Saved list, Progress list (with letter editor).

- **Props:** `job: { title, company, location, rating, reasoning, strengths, gaps, url, status?, savedAt?, letter? }`, `mode: 'suggest' | 'saved' | 'progress'`
- **Slots:** header (rating area), body (reasoning, details), footer (actions)
- **States per mode:**
  - `suggest`: Discard / Save / Save & progress (primary) + Open listing link
  - `saved`: Progress (draft letter) / Remove (danger) + Open listing
  - `progress`: embedded LetterEditor + edit actions
- **Anatomy:**
  - `panel` bg, 1px `border`, `radius-lg`, padding `14px 16px`
  - Top row: title + meta on the left, RatingStars on the right
  - Body: reasoning (`font-md`), then collapsible `details` for strengths/gaps lists
  - Footer: row of buttons, separated from body by a 1px `border` top + 10px padding-top
  - Inline `flash` status text after action buttons
- **Empty state:** parent shows a `.hint` paragraph instead of cards.

### 2.11 LetterEditor

Nested inside a `JobCard` in `progress` mode.

- **Props:** `subject`, `body`, `onSave`, `onRegenerate`, `onCopy`, `onExportEml`
- **Anatomy:**
  - `panel-2` bg, 1px `border`, `radius-md`, padding 12px
  - Subject input full-width, then body textarea (mono, 12-row default)
  - Action row: Save edits (primary) / Re-draft / Copy / Export .eml
- **State to add:** `dirty` (unsaved edits indicator), `regenerating` (button shows spinner).

### 2.12 LogBox

Streamed agent narration during hunt + demo runs.

- **Anatomy:** `font-mono`, 12px, `panel` bg, 1px `border`, `radius-sm`, padding 10px, max-height 220px, scrolls.
- **Behavior:** appends one line every `motion-deliberate` (420ms).
- **A11y:** wrap in `role="log"` and `aria-live="polite"`.

### 2.13 ListGrid (Suggestions / Saved / Progress)

Container layout for stacks of JobCards.

- **Anatomy:** CSS grid, `gap: space-3` (12px), single column.
- **Empty state:** centered `.hint` paragraph.

### 2.14 Link

- **Anatomy:** `accent` color, no underline by default, underline on hover, `margin-right: auto` inside card footers to push siblings to the right.

---

## 3. Accessibility gaps + fixes

The demo is keyboard-navigable but has the following issues to address in the
formal design system:

1. **Tab semantics.** TabNav uses plain `button`s — add `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and wire arrow-key navigation between tabs.
2. **Star ratings.** Stars are decorative spans. Replace with `role="img"` and an `aria-label="<n> of 5 stars"` on the container; remove per-star ARIA.
3. **Focus rings.** Inputs and buttons rely on browser defaults. Add a token: `--focus-ring: 0 0 0 2px var(--accent)` and apply with `:focus-visible`.
4. **Color-only signaling.** Badges and ratings use color alone. Pair each badge with an icon or short text suffix; ratings already include a numeric tooltip — surface it as visible text on hover/focus.
5. **Native `alert` / `prompt`.** Demo uses `alert()` and `prompt()` for confirmations. Replace with a proper Dialog component (focus-trapped, `aria-modal`, ESC closes).
6. **Reduced motion.** The log line-by-line reveal ignores `prefers-reduced-motion`. Inside the simulation loop, collapse to a single render when reduce-motion is set.
7. **Light-mode contrast.** Accents are unchanged from dark mode. `accent-2 #4F8CF0` on white is only ~3.6:1 — fails WCAG AA for normal text. See §4.
8. **Live regions.** Hunt status text and per-card `flash` updates are silent for screen readers. Wrap with `aria-live="polite"`.

---

## 4. Refined light-mode palette

The current light palette only remaps neutrals. Proposed accent remapping for
WCAG-AA contrast on white surfaces:

| Token       | Dark (current) | Light (proposed) | Notes                                  |
| ----------- | -------------- | ---------------- | -------------------------------------- |
| `accent`    | `#6AA9FF`      | `#2C6FD1`        | 4.6:1 on `#FFFFFF` — passes AA         |
| `accent-2`  | `#4F8CF0`      | `#1F5FCB`        | 5.4:1 on white; safe for primary btn   |
| `good`      | `#5FD17F`      | `#1E8A45`        | Darker for sufficient contrast         |
| `warn`      | `#F0B35F`      | `#9A5E10`        | Stars stay readable on white           |
| `bad`       | `#EF6E6E`      | `#C03434`        | Buttons + gaps remain legible          |
| `border`    | `#2A2F3D`      | `#E0E3EC`        | Already correct                        |

Surfaces stay the same:

| Token       | Light value     |
| ----------- | --------------- |
| `bg`        | `#F6F7FB`       |
| `panel`     | `#FFFFFF`       |
| `panel-2`   | `#F0F2F7`       |
| `text`      | `#1A1D24`       |
| `muted`     | `#5B6173` (4.6:1 on `panel`) |

Apply by extending the existing `@media (prefers-color-scheme: light)` block.

---

## 5. Three polish moves before product

1. **Progressive results.** Stream Hunter → Scout → Rater output per-job (server-sent events / WebSocket). The user should see a card appear as soon as the Rater finishes it, not after all jobs complete. Add a `skeleton` JobCard variant for slots that haven't returned yet.
2. **Mobile layout.** TabNav already wraps but the `progress-grid` collapses cleanly only ≤760px. Audit Hunt preferences fieldset (labels overflow at narrow widths) and JobCard footer (button row wraps awkwardly). Define mobile breakpoints (`@420px`, `@760px`) and snap rule.
3. **Trust + onboarding.** Add a first-run empty state with three actions: (a) paste a sample URL, (b) try the Demo tab, (c) connect Gmail/Outlook. Without this, an unconfigured app looks broken. Pair with a small "Setup status" widget in Settings showing AI provider + email-connector health at a glance.

---

## 6. Component matrix (for Figma library setup)

| Component       | Variants                                              | Properties                                              |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Button          | default / primary / danger / btn-label                | label, icon?, leadingIcon?, trailingIcon?, loading      |
| Badge           | default / saved / progress / drafted                  | label                                                   |
| TextField       | text / number / email / search                        | label, placeholder, error, disabled                     |
| TextArea        | sans / mono                                           | rows, placeholder, disabled                             |
| Tab             | default / hover / active                              | label                                                   |
| RatingStars     | 1 / 2 / 3 / 4 / 5                                     | value, max, label                                       |
| JobCard         | suggest / saved / progress                            | rating, status, hasFlash                                |
| LetterEditor    | clean / dirty / regenerating                          | subject, body                                           |
| LogBox          | empty / streaming / done                              | lines                                                   |
| Banner          | info / success / warn / danger                        | body, hasCode                                           |
| Fieldset        | default                                               | legend                                                  |
| Dialog (new)    | confirm / form                                        | title, body, primary, secondary                         |
| Skeleton (new)  | card / line                                           | width                                                   |

Use these column headers as Figma variant properties; the variant grid maps
1:1 to the React/Tauri component API for the eventual implementation.
