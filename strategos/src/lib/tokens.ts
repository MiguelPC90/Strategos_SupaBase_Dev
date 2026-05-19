/**
 * Stratgos design tokens — JS/TS source of truth.
 * Mirrors src/index.css :root variables for use in charts and inline styles.
 * Keep in sync with index.css when brand changes.
 */

export const colors = {
  /** Brand primary palette — Nocturne */
  brand: {
    ink900:    '#0B1220',
    ink700:    '#1E2A44',
    ink500:    '#475369',
    ink300:    '#8B93A3',
    ink100:    '#D8DCE4',
    ember:     '#C8553D',
    emberDark: '#B34B36',
    moss:      '#5B7A3A',
    parchment: '#F4F0E8',
    cream:     '#FBF8F2',
  },

  /** Semantic palette — status-driven charts and pills ONLY */
  status: {
    ontrack: '#4A7C59',
    late:    '#9B2D2D',
    done:    '#2F5F8F',
    risk:    '#C89A3C',
  },

  /** Neutral overlays */
  neutral: {
    white:    '#FFFFFF',
    gridLine: 'rgba(11, 18, 32, 0.08)',
    axisLabel: '#8B93A3',
  },
} as const

/** Returns the status color by key. */
export function statusColor(key: 'ontrack' | 'late' | 'done' | 'risk'): string {
  return colors.status[key]
}

/** Color palette for multi-series non-status charts. */
export const chartPalette = [
  colors.brand.ink700,
  colors.brand.ember,
  colors.brand.moss,
  colors.brand.ink500,
  colors.status.risk,
  colors.status.done,
] as const

/** Common chart defaults — axis/grid/tooltip. */
export const chartDefaults = {
  gridStroke:     colors.neutral.gridLine,
  axisStroke:     colors.brand.ink300,
  axisTickColor:  colors.brand.ink500,
  tooltipBg:      colors.brand.cream,
  tooltipBorder:  colors.brand.ink100,
  tooltipText:    colors.brand.ink900,
} as const
