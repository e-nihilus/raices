---
name: Serene Heritage
colors:
  surface: '#f6fbf5'
  surface-dim: '#d7dbd6'
  surface-bright: '#f6fbf5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5f0'
  surface-container: '#ebefea'
  surface-container-high: '#e5e9e4'
  surface-container-highest: '#dfe4df'
  on-surface: '#181d1a'
  on-surface-variant: '#424843'
  inverse-surface: '#2c322e'
  inverse-on-surface: '#edf2ed'
  outline: '#727973'
  outline-variant: '#c2c8c1'
  surface-tint: '#476553'
  primary: '#385645'
  on-primary: '#ffffff'
  primary-container: '#506e5c'
  on-primary-container: '#cdefd8'
  inverse-primary: '#adceb9'
  secondary: '#8c4e2a'
  on-secondary: '#ffffff'
  secondary-container: '#fcab7f'
  on-secondary-container: '#773d1a'
  tertiary: '#3d5546'
  on-tertiary: '#ffffff'
  tertiary-container: '#546d5d'
  on-tertiary-container: '#d2eeda'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c9ead4'
  primary-fixed-dim: '#adceb9'
  on-primary-fixed: '#032113'
  on-primary-fixed-variant: '#304d3c'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb68f'
  on-secondary-fixed: '#331100'
  on-secondary-fixed-variant: '#6f3715'
  tertiary-fixed: '#cee9d5'
  tertiary-fixed-dim: '#b2cdba'
  on-tertiary-fixed: '#082014'
  on-tertiary-fixed-variant: '#344c3d'
  background: '#f6fbf5'
  on-background: '#181d1a'
  surface-variant: '#dfe4df'
typography:
  display-lg:
    fontFamily: Newsreader
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  headline-sm:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 19px
    fontWeight: '400'
    lineHeight: 30px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1.25rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
---

## Brand & Style

The design system establishes a warm, intimate, and serene sanctuary for recording and preserving family memories across generations. The visual style merges editorial warmth with accessible modern utility—drawing from organic minimalism and warm tactile paper goods rather than cold digital software. 

Targeting multi-generational users ranging from tech-savvy grandchildren to elderly storytellers, the experience balances dignified simplicity with comforting nostalgia. Interfaces must evoke emotional grounding, reverence, and tactile presence. Visual weight relies on generous whitespace, unhurried typographic rhythm, large thumb-friendly contact points, and soft physical metaphors reminiscent of archival paper, cloth albums, and dried botanical tones.

## Colors

The color palette centers on earth pigments, sun-bleached parchment, and deep vegetal inks.

- **Primary (`#506E5C` - Sage Green):** Guides primary progress, active recording mechanisms, and affirmative actions. Hover/active states darken naturally to deep forest sage (`#3D5546`), with tinted pastel resting states using soft mist sage (`#E3EBE5`).
- **Secondary (`#C27A52` - Terracotta / Warm Amber):** Denotes human warmth, pending memory prompts, questions awaiting answers, bookmarks, and audio highlights. Backed by its soft wash (`#EEDCCF`).
- **Surfaces & Backgrounds (Parchment Layers):** 
  - Base canvas: Ivory parchment (`#FAF8F5`).
  - Elevated cards & containers: Soft linen (`#F5F1EB`).
  - Recessed interactive areas & borders: Weathered paper (`#EFE9DE`).
- **Neutral / Text Inks:** Deep carbon slate (`#1F2421`) delivers accessible contrast against light parchment. Subdued body copy adopts graphite olive (`#2C3531`), and metadata or timestamps rely on muted lichen gray (`#5C6560`).

## Typography

Typography pairs the literary, grounded authority of **Newsreader** for headings with the high-legibility, open-aperture geometry of **Plus Jakarta Sans** for running text and functional controls.

- **Headings (Newsreader):** Brings an authentic storytelling tone, mimicking printed family chronicles and legacy memoirs. Never set in uppercase; title and sentence case maintain gentle cadence.
- **Body & Labels (Plus Jakarta Sans):** Selected for generous x-height, clear optical counters, and forgiving legibility for aging eyes.
- **Accessibility Adjustments:** Standard body sizes avoid anything below 15px for narrative text, while `body-xl` (19px) provides an unhurried, comfortable reading option for longer oral transcripts.

## Layout & Spacing

The layout is built upon an 8pt modular grid with a mobile-first philosophy focused on single-handed thumb accessibility and low visual noise.

- **Grid Model:** Fluid grid utilizing 4 columns on mobile viewports (<640px), 8 columns on tablets (640px–1024px), and 12 columns on desktop/tablets in landscape (>1024px).
- **Vertical Rhythm:** Generous spacing cushions reading cards, narrative blocks, and recorded timeline chapters. Ample white space frames each life event to prevent cognitive overload.
- **Thumb-Zone Optimization:** Critical action buttons—especially recording initiation, audio scrubbing, and next-chapter controls—anchor strictly within the lower 40% of the mobile viewport.

## Elevation & Depth

Visual hierarchy abandons clinical drop shadows in favor of **warm ambient diffusion** combined with **tonal surface stepping**.

- **Tonal Layers:** Elevation begins at the canvas base (`#FAF8F5`), rises onto memory card surfaces (`#F5F1EB`), and reaches floating playback trays on clean ivory (`#FFFFFF`).
- **Ambient Shadows:** Cast shadows use a soft warm umber tint rather than grey or black (`rgba(31, 36, 33, 0.05)` to `rgba(31, 36, 33, 0.08)`), pairing large blur radii (16px–24px) with subtle vertical offsets (4px–8px).
- **Physical Outlines:** Cards and dialog containers employ soft hairline borders (`1px solid #EFE9DE`) to ensure visual clarity even on devices with uncalibrated displays.

## Shapes

The design system embraces deep, organic curvature (level 3: pill and extra-rounded) to instill comfort, safety, and tenderness. 

- **Containers & Memory Cards:** Styled with generous corner curvature (`rounded-2xl` at 1.5rem and `rounded-3xl` at 2rem), softening the interface into an album feel.
- **Interactive Controls:** Action buttons, search containers, audio pills, and filter chips leverage full pill radii (`9999px`) to invite touch without sharp boundaries.
- **Media Framing:** Archival photos and waveform player envelopes follow matched corner curves with soft internal padding.

## Components

### Buttons & Interactive Controls
- **Primary Buttons:** Minimum height of 56px to guarantee elder-accessible touch surfaces. Styled with Sage Green (`#506E5C`) background, white text (`#FFFFFF`), full pill rounding (`9999px`), and bold label typography (`label-lg`). Active state compresses subtly with background `#3D5546`.
- **Secondary / Action Cards:** Ivory parchment backgrounds (`#F5F1EB`), framed by a 1px border (`#EFE9DE`) with deep carbon text (`#1F2421`).
- **Recording FAB / Shutter:** Prominent 72px circular trigger in deep Terracotta (`#C27A52`) with a soft pulsing ring in Terracotta wash (`#EEDCCF`) when active.

### Cards & Story Containers
- **Memory Story Card:** Surfaces render in `#F5F1EB` with 24px internal padding (`space-xl`), `rounded-3xl` geometry, and hairline borders (`#EFE9DE`).
- **Story Metadata:** Tags appear in rounded badge shapes; dates and storytellers use `body-sm` in Lichen Gray (`#5C6560`).

### Chips & Filter Tags
- **Category Chips:** Minimum height of 40px. Resting state utilizes Mist Sage (`#E3EBE5`) with Sage text (`#506E5C`). 
- **Prompt / Question Chips:** Unresolved stories and memory prompts leverage warm Terracotta wash (`#EEDCCF`) with Terracotta text (`#C27A52`) to gently prompt completion without anxiety.

### Input Fields & Story Prompts
- **Text Inputs:** Height of 54px, filled with base ivory parchment (`#FAF8F5`), framed by `#EFE9DE`, shifting to Sage Green (`#506E5C`) on focus. Label text remains visible above the field at 14px (`label-md`).

### Audio Waveform Player
- **Track Progress:** Unplayed audio renders in muted paper gray (`#EFE9DE`), while played progress fills in solid Sage Green (`#506E5C`). High-interest audio stamps mark playback via subtle Terracotta indicator ticks (`#C27A52`).
- **Scrubber Node:** Large 24px circular touch target for effortless scrubbing.

### Accessible Iconography
- Rendered with 2px consistent line weight, rounded stroke ends, and 24px bounding boxes centered inside minimum 48px touch targets.