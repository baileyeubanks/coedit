/**
 * Co-Cut Design Tokens — Content Co-op Brand Central
 * ═══════════════════════════════════════════════════
 * 70% Cream backgrounds · 20% Ink text · 10% Sapphire accent
 * https://contentco-op.com/brandcentral
 */

export const C = {
  // ─── Backgrounds — warm cream family (70%) ────────────────────────────────
  bg:         '#f0ebe0',            // Warm Cream — primary background
  surface:    '#faf6ef',            // Parchment — card / panel surfaces
  surface2:   '#f5f0e7',            // slightly warmer surface
  surface3:   '#ede7da',            // elevated / hover surface
  canvasBg:   '#0b1928',            // Canvas stays DARK — NLE convention

  // ─── Borders ──────────────────────────────────────────────────────────────
  border:     '#d8cfc0',            // Sand — dividers, card borders
  border2:    '#1e4d8c',            // Sapphire — active/focus borders

  // ─── Text — Ink family (20%) ──────────────────────────────────────────────
  text:       '#0b1928',            // Deep Navy / Ink — primary text
  textDim:    '#485670',            // Slate — secondary text
  textMuted:  '#8a8478',            // Muted warm grey — tertiary

  // ─── Primary accent — Sapphire (10%) ──────────────────────────────────────
  accent:     '#1e4d8c',            // Sapphire — CTAs, active states
  accentBright:'#2a63b0',           // Sapphire hover
  accent2:    '#b3c8f0',            // Periwinkle — selected highlights
  accentGlow: 'rgba(30,77,140,0.12)',
  accentDark: '#0b1928',            // Deep Navy — for dark contexts (canvas)

  // ─── Copper — editorial accent ────────────────────────────────────────────
  copper:     '#c4722a',            // Copper — eyebrows, callouts

  // ─── Hover/interactive ────────────────────────────────────────────────────
  surfaceHover: '#ede7da',          // warm hover

  // ─── Semantic (brand-harmonised) ──────────────────────────────────────────
  green:   '#2d8a5e',
  orange:  '#c4722a',               // Copper
  red:     '#b8443e',
  pink:    '#8a5a87',
  blue:    '#1e4d8c',               // Sapphire
  teal:    '#3a7d7e',

  // ─── Status ───────────────────────────────────────────────────────────────
  success: '#2d8a5e',
  warning: '#c4722a',
  error:   '#b8443e',

  // ─── Dark mode panel (for canvas overlay, video preview) ──────────────────
  darkBg:      '#0b1928',
  darkSurface: '#0f1e30',
  darkText:    '#edf3ff',
  darkBorder:  '#1e3550',
} as const;

export const ELEMENT_COLORS: Record<string, string> = {
  text:     C.accent,
  shape:    C.teal,
  circle:   C.teal,
  image:    C.copper,
  video:    C.pink,
  audio:    C.blue,
  subtitle: C.warning,
};
