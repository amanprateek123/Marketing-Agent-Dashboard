# Design System: Meridian AI Growth OS

**Project ID:** Repository-native implementation (no Stitch project is connected)
**Theme:** Meridian Atlas Light
**Platform:** Responsive web application, desktop-first with complete mobile navigation

## 1. Visual Theme & Atmosphere

Meridian should feel like a calm, highly capable operating system for growth: intelligent without looking experimental, financial without feeling like a spreadsheet, and premium without decorative excess. Meridian Atlas Light uses a daylight working canvas framed by a deep Atlas-navy navigation rail. Cobalt identifies AI intelligence and primary action; teal is reserved for recorded value and verified growth. The dark rail is structural product framing, not a dark-mode workspace.

The product must make a causal story visible: **business goal → AI reasoning → controlled action → measured result**. Decoration never competes with that sequence. Use generous whitespace, clear grouping, quiet borders, and whisper-soft elevation so the strongest contrast is reserved for decisions, outcomes, and primary actions.

Design principles:

- **Outcomes first:** Lead with what changed for the business; supporting mechanics come second.
- **Calm intelligence:** Prefer precise hierarchy and quiet confidence over neon, heavy gradients, or “AI magic” clichés.
- **Trust is visible:** Data freshness, provenance, confidence, approvals, and safety limits are part of the interface.
- **One dominant action:** Each view should have one visually primary next step.
- **Progressive disclosure:** Plain-English summaries first; detailed evidence and system reasoning remain available.
- **Measured motion:** Motion explains state or continuity. It never delays work or makes financial data harder to read.

## 2. Color Palette & Roles

### Foundation

| Token | Name | Value | Role |
| --- | --- | --- | --- |
| `--paper` | Daylight Canvas | `#F3F5F9` | Application background; visibly separates crisp white working surfaces. |
| `--surface` | Pure Workspace | `#FFFFFF` | Cards, dialogs, navigation, and primary working surfaces. |
| `--surface-warm` | Cloud Panel | `#F8FAFC` | Table headers, grouped controls, secondary panels, and subtle hover states. |
| `--surface-tint` | Cobalt Tint | `#EEF1FF` | AI context, active light states, and feature backgrounds. |
| `--muted` | Mist Well | `#E9EEF5` | Tracks, neutral chips, skeletons, and nested wells. |
| `--ink` | Atlas Ink | `#0F172A` | Primary copy and high-value numerals. |
| `--ink-2` | Slate Copy | `#334155` | Secondary copy and high-emphasis metadata. |
| `--ink-3` | Quiet Slate | `#526176` | Descriptions and supporting labels; AA on white. |
| `--ink-4` | Muted Slate | `#667085` | Placeholders, low-emphasis icons, and compact support text. |
| `--hairline` | Structure Line | `#D7DEE9` | Standard borders and separators. |
| `--hairline-light` | Whisper Line | `#E7ECF3` | Internal dividers and very subtle boundaries. |
| `--hairline-strong` | Emphasis Line | `#B8C3D3` | Hovered card borders and stronger grouping without using dark strokes. |

### Brand and semantic roles

| Token | Name | Value | Role |
| --- | --- | --- | --- |
| `--accent` | Meridian Cobalt | `#3554D1` | Primary action, AI-authored states, and brand moments. |
| `--accent-strong` | Deep Cobalt | `#1F337E` | Hover/pressed action and readable cobalt text. |
| `--accent-bg` | Cobalt Wash | `#EEF1FF` | Active rows, AI context, and subtle emphasis. |
| `--brand-secondary` | Meridian Teal | `#00796F` | Recorded value, earned outcomes, and secondary brand detail. |
| `--nav-bg` | Atlas Navy | `#14213D` | Persistent navigation and product frame. |
| `--nav-active` | Raised Atlas | `#233760` | Active and hovered navigation surfaces. |
| `--nav-accent` | Atlas Iris | `#91A3FF` | Active navigation indicator and inverse brand detail. |
| `--good` | Growth Teal | `#087A5B` | Verified success, profitable outcomes, and healthy state. |
| `--warn` | Attention Amber | `#98600A` | Review-needed or incomplete state; never used as failure. |
| `--bad` | Action Red | `#B4232E` | Errors, destructive actions, and verified negative outcomes. |
| `--info` | Evidence Blue | `#2563B8` | Neutral information, attribution, and supporting evidence. |

Semantic colors must always appear with a label, icon, number, or pattern. Never use color as the only carrier of meaning. Text/background combinations should meet WCAG AA; low-contrast tints are container backgrounds, not text colors.

### Chart palette

| Token | Value | Intended series |
| --- | --- | --- |
| `--viz-spend` | `#526175` | Spend / investment; stable across every chart |
| `--viz-value` | `#00796F` | Meta-attributed action value / recorded revenue |
| `--viz-roas` | `#4F46D9` | Raw ROAS ratio |
| `--viz-purchase` | `#7C3AED` | Purchases and sales results |
| `--viz-awareness` | `#2563EB` | Awareness results |
| `--viz-reach` | `#0284C7` | Reach |
| `--viz-impressions` | `#6366F1` | Impressions |
| `--viz-clicks` | `#D97706` | Clicks / traffic |
| `--viz-leads` | `#0891B2` | Leads |
| `--viz-engagement` | `#C026D3` | Engagement and video-view results |
| `--viz-estimate` | `#B56800` | Estimated values; always dashed or striped |
| `--viz-unknown` | `#94A3B8` | Unknown provenance; dotted or hollow |
| `--viz-grid` | `#E3E8F0` | Plot gridlines |

Charts use direct labels or a nearby legend, 2–2.5 px lines, restrained area fills, tabular numerals, and light gridlines. Hue answers “what metric is this?”, a badge or marker answers “is it healthy?”, and dash/shape answers “is it verified, estimated, or missing?”. Spend and earned/value must remain visually consistent across every chart. Reach is non-additive and must be labelled when aggregated.

## 3. Typography Rules

- **Interface and data:** Plus Jakarta Sans (`--font-sans`). Use 400 for body, 500 for controls, 600 for labels, 700 for headings and major numbers, and 800 only for rare hero outcomes.
- **Editorial accent:** Instrument Serif (`--font-display`). Reserve it for the Meridian wordmark and occasional insight pull-quotes. It is not a general heading font.
- **Technical data:** JetBrains Mono (`--font-mono`). Use only for IDs, timestamps, API/status codes, and raw system output. Financial metrics use tabular sans-serif numerals.
- **Page title:** 30–36 px responsive, weight 700, tight line height and subtle negative tracking.
- **Section title:** 16–18 px, weight 600–700.
- **Body:** 14–15 px with 1.55–1.65 line height.
- **Metadata:** 12–13 px, never below 11 px for persistent content.
- Use sentence case. Avoid uppercase except short navigation group labels or status overlines with generous tracking.

## 4. Spacing, Geometry & Depth

### Spacing

Use a 4 px base unit. Preferred steps are `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Page gutters are 32 px on desktop, 24 px on tablet, and 16 px on mobile. Major sections use 32–40 px vertical separation; related controls use 8–12 px.

### Radius

- Small controls and tags: 8–10 px.
- Inputs and standard buttons: 10–12 px.
- Cards and panels: 16 px (`--radius`).
- Hero or feature containers: 20–24 px.
- Status pills: fully rounded.

### Elevation

- **Flat:** Background wells and table regions rely on borders.
- **Whisper-soft:** Default cards use a short ambient shadow with a crisp border.
- **Raised:** Interactive cards, menus, and sticky controls receive a slightly wider shadow.
- **Overlay:** Dialogs and mobile navigation use a broad, low-opacity shadow plus backdrop blur.
- Do not add colored glows to ordinary cards. The cobalt focus ring is reserved for focus and active decisions.

## 5. Component Styling

### Application shell

- Desktop uses a 264 px persistent Atlas-navy navigation rail with a quiet cobalt/teal atmospheric field, subtle right border, and grouped workflow navigation.
- Mobile uses a 64 px sticky top bar and an off-canvas drawer. The drawer closes on navigation, Escape, or backdrop click.
- Navigation order follows the product story: **Understand → Create → Control → Improve → Prove**.
- The active item uses a raised navy capsule, bright iris indicator, stronger icon treatment, white label, and a concise description.
- Connection state and current workspace stay visible but visually secondary.

### Cards and containers

- Standard cards: white surface, 1 px structure line, 16 px radius, whisper-soft shadow.
- Interactive cards lift by 1 px and strengthen the border; motion lasts 160–200 ms.
- Nested content uses Cloud Panel rather than stacking multiple shadows.
- Hero insight cards may use a very light white-to-cobalt-to-teal wash; gradients must stay below 12% opacity.

### Buttons

- Primary: Meridian Cobalt-to-Deep-Cobalt background with white text, 10–12 px radius, 40–44 px minimum height.
- Secondary: white surface, structure border, Slate Copy.
- Ghost: transparent until hover; use for low-priority actions.
- Destructive: red tint by default, solid red only for final irreversible confirmation.
- Disabled actions retain their label and reduce opacity; loading preserves button width.
- Hover may lift 1 px; pressed returns to the baseline.

### Inputs

- White surface, structure border, 10–12 px radius, 42 px default height.
- Labels sit above fields and remain visible after entry.
- Focus uses a 2 px Meridian Cobalt outline plus a soft focus ring.
- Error state includes red border, icon, and plain-language recovery guidance.

### Status and evidence

- Status chips are quiet tints with 1 px semantic borders and plain-language labels.
- Live state uses a small pulsing beacon; pulse stops under reduced-motion preferences.
- AI suggestions must distinguish **recommended**, **approved**, **executed**, and **measured**.
- Forecasts and estimates must be labelled; they never share the same styling as verified results.
- A measurement-readiness issue is never the hero headline. Lead with available operational truth, show coverage once in a compact actionable status, and replace unknown KPI values with useful measured facts rather than repeated em dashes.
- Connection health and measurement health are separate states: “Meta connected” must not imply that campaign-level purchase value is already verified.

### Tables

- Sticky or clearly separated header on Cloud Panel.
- 44–48 px row height, left-aligned text, right-aligned numeric columns, and tabular numerals.
- Hover uses a cool neutral wash. Avoid zebra striping unless the table exceeds 20 dense rows.
- Preserve horizontal scrolling on narrow screens; do not truncate decision-critical values.

## 6. Layout Principles

- Default content width is 1,600 px with balanced gutters; reading-heavy panels should stay near 760 px.
- Use 12-column responsive grids for dashboards and outcome cards.
- The first viewport should answer: what is happening, what Meridian changed, and what requires the operator.
- Hero outcomes use one compact number plus one short label. Diagnostic sentences never receive display-scale typography.
- Pair each important metric with its comparison or meaning; avoid isolated numbers without context.
- Keep primary action placement consistent at the upper right of the page header or at the end of a guided workflow.
- Empty states explain why the space is empty and offer the next useful action.
- At widths below 900 px, switch the navigation rail to the mobile top bar and drawer. At widths below 640 px, cards and controls stack, page gutters reduce to 16 px, and tables scroll.

## 7. Motion & Interaction

- Fast feedback: 120–160 ms.
- Standard transitions: 180–220 ms.
- Drawers/dialogs: 240–280 ms with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Page entry may fade and rise by no more than 10 px. Stagger delays should not exceed 40 ms per item or 240 ms total.
- Loading skeletons use a low-contrast shimmer; long-running AI work should also show meaningful stage text.
- Respect `prefers-reduced-motion`: remove translation, pulsing, and shimmer while keeping state changes immediate.

## 8. Accessibility & Production Rules

- Maintain keyboard navigation, visible focus, semantic landmarks, and labelled icon-only controls.
- Interactive targets are at least 40 × 40 px on desktop and 44 × 44 px on touch layouts.
- Persistently visible text should meet WCAG AA contrast. `--ink-4` matches the AA-safe `--ink-3`; hierarchy comes from size, weight, and placement rather than lower contrast.
- Do not expose secrets, tokens, raw prompts, or internal exception details in the interface or demo.
- Loading, empty, partial-data, stale-data, disconnected, and failure states are all designed states—not blank gaps.
- Performance claims are scoped to tool-owned campaigns and show source/freshness. Objective-specific campaigns use objective-specific success metrics.
