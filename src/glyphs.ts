/** Original block letters. Height is 1. Not a licensed typeface. */

export type Ring = [number, number][]

export type Glyph = {
  width: number
  outline: Ring
  holes: Ring[]
  /** Extra solid silhouettes (the second half of W). */
  extra: Ring[]
}

function ellipse(cx: number, cy: number, rx: number, ry: number, n: number, clockwise: boolean): Ring {
  const pts: Ring = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const t = clockwise ? -a : a
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry])
  }
  return pts
}

function rect(x: number, y: number, w: number, h: number): Ring {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

const S = 0.185

function H(): Glyph {
  const W = 0.76
  return {
    width: W,
    outline: rect(0, 0, W, 1),
    holes: [rect(S, 0.6, W - S * 2, 0.4 - 0.02), rect(S, 0.02, W - S * 2, 0.4 - 0.02)],
    extra: [],
  }
}

function O(): Glyph {
  const W = 0.82
  return {
    width: W,
    outline: ellipse(W / 2, 0.5, W / 2, 0.5, 72, false),
    holes: [ellipse(W / 2, 0.5, W / 2 - S, 0.5 - S, 56, true)],
    extra: [],
  }
}

function L(): Glyph {
  const W = 0.66
  return {
    width: W,
    outline: [
      [0, 0],
      [W, 0],
      [W, S],
      [S, S],
      [S, 1],
      [0, 1],
    ],
    holes: [],
    extra: [],
  }
}

function Y(): Glyph {
  return {
    width: 0.82,
    outline: [
      [0.32, 0],
      [0.5, 0],
      [0.5, 0.36],
      [0.82, 1],
      [0.62, 1],
      [0.46, 0.5],
      [0.36, 0.5],
      [0.18, 1],
      [0, 1],
      [0.32, 0.36],
    ],
    holes: [],
    extra: [],
  }
}

/**
 * W is two V silhouettes that share the middle peak.
 * Each V is a simple polygon so the fill can't punch itself.
 */
function W(): Glyph {
  return {
    width: 1.16,
    outline: [
      [0.18, 0],
      [0.5, 0],
      [0.62, 1],
      [0.46, 1],
      [0.36, 0.16],
      [0.16, 1],
      [0.0, 1],
    ],
    holes: [],
    extra: [
      [
        [0.98, 0],
        [0.66, 0],
        [0.54, 1],
        [0.7, 1],
        [0.8, 0.16],
        [1.0, 1],
        [1.16, 1],
      ],
    ],
  }
}

function D(): Glyph {
  const bowlR = 0.5
  const cx = 0.34
  const outer: Ring = [
    [0, 0],
    [0, 1],
    [cx, 1],
  ]
  const steps = 40
  for (let i = 1; i < steps; i++) {
    const a = Math.PI / 2 - (i / steps) * Math.PI
    outer.push([cx + Math.cos(a) * bowlR, 0.5 + Math.sin(a) * bowlR])
  }
  outer.push([cx, 0])
  const inner: Ring = [[S, S], [S, 1 - S], [cx, 1 - S]]
  const r = bowlR - S
  for (let i = 1; i < steps; i++) {
    const a = Math.PI / 2 - (i / steps) * Math.PI
    inner.push([cx + Math.cos(a) * r, 0.5 + Math.sin(a) * r])
  }
  inner.push([cx, S])
  return { width: cx + bowlR, outline: outer, holes: [inner], extra: [] }
}

const GLYPHS: Record<string, Glyph> = { H: H(), O: O(), L: L(), Y: Y(), W: W(), D: D() }

export function glyphFor(ch: string): Glyph {
  const g = GLYPHS[ch]
  if (!g) throw new Error(`No glyph for ${ch}`)
  return g
}

export const WORD = ['H', 'O', 'L', 'L', 'Y', 'W', 'O', 'O', 'D'] as const
