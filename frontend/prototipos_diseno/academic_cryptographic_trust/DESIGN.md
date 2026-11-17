---
name: Academic Cryptographic Trust
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4d5f7d'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#071c37'
  on-primary-container: '#7284a5'
  inverse-primary: '#b5c7ea'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#346cef'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b5c7ea'
  on-primary-fixed: '#071c37'
  on-primary-fixed-variant: '#354765'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea7'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  bg-base: '#f8f9ff'
  surface-sunken: '#f1f5f9'
  surface-default: '#ffffff'
  surface-elevated: '#e2e8f0'
  border-subtle: '#e2e8f0'
  success-bg: '#ecfdf5'
  success-text: '#065f46'
  success-icon: '#059669'
  warning-bg: '#fffbeb'
  warning-text: '#92400e'
  warning-border: '#fde68a'
  danger-bg: '#fef2f2'
  danger-icon-container: '#fee2e2'
  danger-text: '#991b1b'
  danger-action: '#dc2626'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 35px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 29px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 29px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  tech-code:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  tech-data-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  tech-data-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 2.5rem
---

## Brand & Style

This design system serves the institutional research project governance platform. The visual and functional philosophy is rooted in three tenets: **Academic Authority**, **Cryptographic Verifiability**, and **Administrative Precision**.

The system balances traditional institutional governance with modern distributed ledger integrity. Visual noise is strictly minimized to facilitate dense document workflows, ethical compliance reviews, and financial audits.

### Visual Aesthetic & Philosophy
- **Style:** High-integrity Corporate/Technical Minimalist. Surfaces prioritize crisp boundaries, typographic hierarchy, and tonal stratification over decorative ornament.
- **Cognitive Hygiene:** Visual priority is ruthlessly singular. Each screen affords exactly **one primary action** (`#0051d5`), while administrative and secondary paths rely on quiet outline or tonal ghost executions.
- **Cryptographic Transparency:** Deep technical data (SHA-256 hashes, CVD certificates, ledger receipts) are treated with reverence but surfaced via progressive disclosure (`<TechDetails>` pattern) to avoid administrative fatigue.
- **Target Audience:** Principal Investigators, Peer Reviewers, Ethics Board Members, and Research Compliance Auditors requiring rapid, unambiguous decision-making and verifiable provenance.

## Colors

The color palette is engineered for prolonged operational focus and verifiable accessibility compliance (WCAG AAA/AA).

### Functional Palette Structure
- **Primary (`#00142f` - Deep Navy):** The bedrock institutional tone. Used exclusively for navigation chrome, structural containers, and high-emphasis typographic headings.
- **Secondary / Action (`#0051d5` - Vibrant Blue):** The interactive catalyst. Reserved exclusively for the singular primary CTA per view, focused states, and interactive links.
- **Base & Neutral Tiers:**
  - `bg-base` (`#f8f9ff`): A calibrated canvas tint designed to eliminate stark contrast fatigue during extended reading sessions.
  - `surface-sunken` (`#f1f5f9`): Form field interiors, table column headers, and administrative footer regions.
  - `surface-default` (`#ffffff`): Foreground content cards, active drawers, and modal sheets.
  - `border-subtle` (`#e2e8f0`): Standard 1px architectural boundary separating functional zones.

### Semantic Status Architecture
Feedback states are built with dedicated container/foreground pairings to guarantee minimum 4.5:1 (AA) to 7:1 (AAA) contrast:
- **Success (`#ecfdf5` / `#065f46`):** Validated hashes, quorum thresholds achieved (e.g. 3/3 approvals), successful file digest parsing.
- **Warning (`#fffbeb` / `#92400e` / border `#fde68a`):** Impending ethical deadlines (≤7 days), AI similarity thresholds (≥78%), quorum pending.
- **Danger (`#fef2f2` / `#991b1b` / action `#dc2626`):** Critical non-compliance notices, word count overflow (>500 words), ethical conflicts of interest, and permanent file deletion.

## Typography

Typography uses a mathematical **Minor Third scale (1.200 ratio)** rooted at 14px body text, terminating at an immutable accessibility floor of **12px**. Under no circumstances may any label, badge, or metadata component render below 12px.

### Font Family Segmentation
- **Plus Jakarta Sans:** Primary structural and narrative typeface. Conveys approachability grounded in structural precision. Used for interface navigation, headers, forms, dialogs, and long-form scientific narratives.
- **JetBrains Mono:** Strict technical, cryptographic, and financial domain typeface. Must be rendered with `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across budget rows, CVD verification strings, transaction hashes, and ledger references.

### Application Rules
- **Display & Section Headers:** Apply negative letter-spacing (`-0.02em`) to `headline-xl` and `headline-lg` to reinforce density and authority.
- **Long-Form Reading:** Narrative evaluations and AI rationales must use `body-lg` or `body-md` with `line-height: 150%` (`leading-relaxed`) to sustain reading stamina.
- **Technical Strings:** Hashes (SHA-256), project identifiers (`PID-2023-CRH-019`), masked legal identities (`***.***.342`), and financial amounts (`S/. 157,500.00 PEN`) must map strictly to `tech-code`, `tech-data-md`, or `tech-data-lg`.

## Layout & Spacing

The layout is governed by a strict **8px base unit system**. Spacing tokens strictly determine layout emptiness, outer gutter boundaries, and section rhythm.

### Grid Infrastructure
- **Desktop Breakpoint (1440px+):**
  - Static structural sidebar: `280px` width, anchored to `#00142f`.
  - Main operational workspace: Max-width constrained to `1160px` centered within the remaining viewport.
  - Standard multi-column grid: 12 columns with `24px` (`gutter`) spacing.
  - KPI dashboards enforce a maximum 4-column distribution per row. Complex research product workflows utilize an asymmetrical 60% / 40% split grid.
- **Mobile Breakpoint (375px - 767px):**
  - Structural navigation collapses off-canvas into a persistent header with a drawer pattern.
  - Outer screen boundary collapses to `16px` (`margin-mobile`).
  - Grids collapse to single vertical stacks. Multi-cell data tables reflow into stacked card components with zero horizontal scrollbars.

### Spatial Hierarchy Rules
- Internal padding for any content card or interactive panel must never fall below `16px` (`space-md`). Standard density requires `24px` (`space-lg`).
- High-level functional modules (e.g., protocol overview vs. cryptographic audit trail) are separated by `40px` (`space-2xl`).

## Elevation & Depth

Depth in this system communicates validation state and interaction context rather than physical weight. The aesthetic avoids exaggerated drop shadows in favor of precise structural boundaries.

### Architectural Surface Layers
1. **Canvas (`bg-base` / `#f8f9ff`):** Ground level. Houses structural margins and page backgrounds.
2. **Sunken (`surface-sunken` / `#f1f5f9`):** Recessed functional areas. Used for interactive data input fields, table header rows, audit trail containers, and institutional breadcrumbs.
3. **Card Base (`surface-default` / `#ffffff`):** Active task level. Standard for all analytical cards, form sections, and data rows. Bound by a crisp `1px solid #e2e8f0` stroke.
4. **Elevated Overlays (`surface-default` with Ambient Shadow):** Modals, confirmation dialogs, and slide-over audit drawers.

### Shadow Specifications
- **Resting Cards & Panels:** No heavy blur. Boundaries are established by the 1px `border-subtle` stroke on `#ffffff`.
- **Active / Floating Overlays:** 
  - `box-shadow: 0 4px 16px -2px rgba(0, 20, 47, 0.06), 0 2px 6px -1px rgba(0, 20, 47, 0.04);`
  - Subtle navy tinting (`#00142f`) within the shadow preserves tonal unity with the primary brand anchor.
- **Scaffold Backdrop:** Full modal dialogs employ a 40% opacity overlay (`rgba(0, 20, 47, 0.4)`) with backdrop blur (`blur(4px)`) to freeze background operations during ethics confirmations or signature events.

## Shapes

The shape system expresses administrative order through consistent, controlled curvature. It explicitly rejects soft, overly-playful radii in favor of disciplined structural clarity.

### Radius Token Hierarchy
- **`sm-component` (8px / `roundedness: 2` default):** Applied to form inputs, dropdown select triggers, action buttons, table row selections, and segmented controls.
- **`large-card` (12px):** Applied to standard content cards, KPI display containers, verification modals, and lateral slide-out drawers.
- **`rounded-pill` (9999px):** Exclusively reserved for status indicators, verification tags, notification counters, and automated AI assistance indicators.

### Edge Treatments
- **Standard Structural Outlines:** Uniform `1px solid #e2e8f0`.
- **Dashed Upload Zones:** Research evidence dropzones use a `1.5px dashed #0051d5` border resting on a 2% opacity `#0051d5` tint.
- **Warning Containers:** Bounded by `1px solid #fde68a`.

## Components

### Buttons
- **Primary Action (Unique Rule):** Exactly one per screen. Solid background (`#0051d5`), text `#ffffff`, border radius `8px`, font weight 600. Focus ring: `2px solid #ffffff, 4px solid #0051d5`.
- **Secondary Action:** Outlined with `1px solid #e2e8f0`, background `#ffffff`, text `#00142f`. Hover: background `#f1f5f9`.
- **Destructive Trigger:** Outlined with `1px solid #dc2626`, background transparent, text `#dc2626`. Hover: background `#fef2f2`.
- **Ghost Action:** No border, background transparent, text `#00142f`. Used for auxiliary triggers and row-level administrative options.

### Input Fields & Controls
- **Text Inputs & Dropdowns:** Minimum height `40px`. Background `#f1f5f9` (`surface-sunken`), border `1px solid #e2e8f0`, border radius `8px`. Active focus shifts border to `#0051d5` with a 2px offset glow.
- **Textareas:** Include real-time word calculation microcopy (`tech-code`). Overflows (>500 words) turn the counter and boundary to `#991b1b`.
- **Checkboxes & Radios:** Must start **unselected by default** across all ethics, conflict-of-interest, and regulatory forms. 8px/round radius, active fill `#0051d5`.

### Cards & Analytical Panels
- **Container Structure:** Background `#ffffff`, border `1px solid #e2e8f0`, border radius `12px`, padding `24px` (`space-lg`).
- **KPI Metrics:** Display metric values in `tech-data-lg` (`JetBrains Mono`), subtitle in `body-sm`, and status indicator aligned top-right.

### Chips & Status Badges
- **Shape:** Full pill radius (`9999px`), padding `4px 10px`, typography `tech-code` (12px uppercase).
- **Semantics:**
  - *Approved / Verified:* `#ecfdf5` background, `#065f46` text, `#059669` leading icon.
  - *Pending / Audit:* `#fffbeb` background, `#92400e` text, `#fde68a` border.
  - *Inhibited / Revoked:* `#fef2f2` background, `#991b1b` text.

### Data Tables
- **Header:** Background `#f1f5f9`, typography `body-sm` (600 weight), uppercase, border-bottom `1px solid #e2e8f0`.
- **Cells:** Background `#ffffff`, height `48px`, padding `0 16px`. Tabular data (monetary, IDs, hashes) rendered via `tech-data-md` (`JetBrains Mono`).

### Progressive Disclosure (`<TechDetails>`)
- High-density cryptographic verification records (e.g., X.509 chains, TSA timestamps, raw ledger payload) are collapsed into accordion blocks.
- **Trigger:** Chevron with `body-sm` text ("Verificar Prueba Criptográfica"). Expanding reveals an inset panel with `#f1f5f9` fill, displaying copyable hashes in `tech-code`.