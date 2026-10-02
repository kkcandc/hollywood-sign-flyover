const perm = new Uint8Array(512)
const grad2: Array<[number, number]> = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function buildPerm(seed: number) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = seed >>> 0
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
}

buildPerm(0x51a7c0de)

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Classic 2D Perlin, roughly −1…1. */
export function noise2(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const xf = x - x0
  const yf = y - y0
  const u = fade(xf)
  const v = fade(yf)
  const aa = perm[x0 & 255] + (y0 & 255)
  const ab = perm[x0 & 255] + ((y0 + 1) & 255)
  const ba = perm[(x0 + 1) & 255] + (y0 & 255)
  const bb = perm[(x0 + 1) & 255] + ((y0 + 1) & 255)
  const g = (h: number, dx: number, dy: number) => {
    const g2 = grad2[perm[h] & 7]
    return g2[0] * dx + g2[1] * dy
  }
  const x1 = lerp(g(aa, xf, yf), g(ba, xf - 1, yf), u)
  const x2 = lerp(g(ab, xf, yf - 1), g(bb, xf - 1, yf - 1), u)
  return lerp(x1, x2, v)
}

export function fbm(x: number, y: number, octaves = 5): number {
  let v = 0
  let a = 0.5
  let f = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    v += a * noise2(x * f, y * f)
    norm += a
    f *= 2.03
    a *= 0.5
  }
  return v / norm
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function hash2(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263)
  n = (n ^ (n >>> 13)) >>> 0
  n = Math.imul(n, 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}
