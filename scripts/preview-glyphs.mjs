import { glyphFor, WORD } from '../src/glyphs.ts'

function inside(ring, x, y) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][1]
    const yj = ring[j][1]
    const xi = ring[i][0]
    const xj = ring[j][0]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) c = !c
  }
  return c
}

function filled(g, x, y) {
  const solid = (ring) => inside(ring, x, y)
  if (solid(g.outline)) {
    for (const h of g.holes) if (inside(h, x, y)) return false
    return true
  }
  for (const extra of g.extra ?? []) if (solid(extra)) return true
  return false
}

const rows = 28
const colsPer = 16
let lines = Array.from({ length: rows }, () => '')
for (const ch of WORD) {
  const g = glyphFor(ch)
  for (let r = 0; r < rows; r++) {
    const y = 1 - (r + 0.5) / rows
    let row = ''
    const cols = Math.max(8, Math.round((colsPer * g.width) / 0.8))
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * g.width
      row += filled(g, x, y) ? '█' : ' '
    }
    lines[r] += row + ' '
  }
}
console.log(lines.join('\n'))
