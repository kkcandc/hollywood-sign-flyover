import * as THREE from 'three'
import { WORD, glyphFor, type Ring } from './glyphs'
import { terrainHeight, SIGN_BASELINE } from './terrain'

const LETTER_HEIGHT = 17.6
const LETTER_GAP = 2.7

function ringToPath(ring: Ring, asHole: boolean): THREE.Path {
  const pts = asHole ? [...ring].reverse() : ring
  const path = asHole ? new THREE.Path() : new THREE.Shape()
  path.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1])
  path.closePath()
  return path
}

const EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: 0.105,
  bevelEnabled: true,
  bevelThickness: 0.012,
  bevelSize: 0.007,
  bevelSegments: 2,
  curveSegments: 1,
}

function extrudeRing(outline: Ring, holes: Ring[]): THREE.ExtrudeGeometry {
  const shape = ringToPath(outline, false) as THREE.Shape
  for (const hole of holes) shape.holes.push(ringToPath(hole, true))
  return new THREE.ExtrudeGeometry(shape, EXTRUDE)
}

function letterObject(ch: string, material: THREE.Material): { object: THREE.Group; width: number } {
  const g = glyphFor(ch)
  const geos = [extrudeRing(g.outline, g.holes), ...g.extra.map((ring) => extrudeRing(ring, []))]
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  for (const geo of geos) {
    geo.scale(LETTER_HEIGHT, LETTER_HEIGHT, LETTER_HEIGHT)
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    minX = Math.min(minX, bb.min.x)
    minY = Math.min(minY, bb.min.y)
    minZ = Math.min(minZ, bb.min.z)
    maxX = Math.max(maxX, bb.max.x)
  }
  const object = new THREE.Group()
  geos.forEach((geo, index) => {
    // The second half of W sits a centimeter forward so the shared peak does not flicker.
    geo.translate(-minX, -minY, -minZ + (index > 0 ? 0.012 : 0))
    const mesh = new THREE.Mesh(geo, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    object.add(mesh)
  })
  return { object, width: maxX - minX }
}

export type SignBuild = {
  group: THREE.Group
  center: THREE.Vector3
}

export function createSign(): SignBuild {
  // One material for every extrude group so the faces stay white from any angle.
  // A modest emissive keeps the south faces bright while the sun rakes the ridge.
  const paint = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.0,
    emissive: 0xfff6ee,
    emissiveIntensity: 0.22,
    side: THREE.DoubleSide,
  })
  const steel = new THREE.MeshStandardMaterial({
    color: 0x2c2926,
    roughness: 0.48,
    metalness: 0.72,
    side: THREE.DoubleSide,
  })

  const group = new THREE.Group()
  group.name = 'sign'

  const built = WORD.map((ch) => letterObject(ch, paint))
  const gap = LETTER_GAP
  const total = built.reduce((a, b) => a + b.width, 0) + gap * (built.length - 1)
  let cursor = -total / 2

  const placed: { x: number; w: number }[] = []
  built.forEach((letter, i) => {
    const w = letter.width
    const dx = cursor + w / 2
    letter.object.position.x = cursor
    letter.object.position.z = -(dx * dx) * 0.00028
    letter.object.name = `letter-${WORD[i]}-${i}`
    group.add(letter.object)
    placed.push({ x: dx, w })
    cursor += w + gap
  })

  group.position.y = SIGN_BASELINE
  // The south-facing camera looks along +Z. Its right-handed basis puts west on
  // screen-right, which would spell the word backwards. Mirroring X cancels that
  // so H is on the left and the L stems face the correct way.
  group.scale.x = -1

  const postGeo = new THREE.BoxGeometry(0.42, 1, 0.42)
  const braceGeo = new THREE.BoxGeometry(1, 0.28, 0.28)
  for (const p of placed) {
    for (const sideK of [-0.28, 0.28]) {
      const lx = p.x + sideK * p.w
      const lz = 1.35
      const wx = lx
      const wz = lz
      const ground = terrainHeight(wx, wz)
      const top = SIGN_BASELINE + 0.15
      const h = Math.max(0.8, top - ground)
      const post = new THREE.Mesh(postGeo, steel)
      post.scale.y = h
      post.position.set(wx, ground + h / 2 - SIGN_BASELINE, wz)
      post.castShadow = true
      post.receiveShadow = true
      group.add(post)
    }
    const brace = new THREE.Mesh(braceGeo, steel)
    brace.scale.x = p.w * 0.72
    brace.position.set(p.x, 1.4, 1.35)
    brace.castShadow = true
    group.add(brace)

    const cat = new THREE.Mesh(braceGeo, steel)
    cat.scale.x = p.w * 0.72
    cat.position.set(p.x, 7.2, 1.15)
    cat.castShadow = true
    group.add(cat)
  }

  // Ridge beam tying the letters together behind the baseline.
  const beam = new THREE.Mesh(new THREE.BoxGeometry(total + 2, 0.34, 0.34), steel)
  beam.position.set(0, 0.2, 1.2)
  beam.castShadow = true
  group.add(beam)

  const center = new THREE.Vector3(0, SIGN_BASELINE + LETTER_HEIGHT * 0.46, 0)
  return { group, center }
}

export function createTower(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'tower'
  const x = 36
  const z = 48
  const base = terrainHeight(x, z)
  const height = 34
  const steel = new THREE.MeshStandardMaterial({
    color: 0x3a3532,
    metalness: 0.65,
    roughness: 0.42,
  })
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.55, height, 6), steel)
  mast.position.set(x, base + height / 2, z)
  mast.castShadow = true
  g.add(mast)

  for (let i = 0; i < 5; i++) {
    const y = base + 6 + i * 5.5
    const w = 3.2 - i * 0.35
    const ring = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), steel)
    ring.position.set(x, y, z)
    const ring2 = ring.clone()
    ring2.rotation.y = Math.PI / 2
    ring2.scale.set(1, 1, 1)
    g.add(ring, ring2)
  }

  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.15, 0.08) })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), lampMat)
  lamp.position.set(x, base + height + 0.4, z)
  lamp.name = 'beacon'
  g.add(lamp)

  const bulb = new THREE.PointLight(0xff2210, 4, 48, 2)
  bulb.position.copy(lamp.position)
  bulb.name = 'beacon-light'
  g.add(bulb)
  return g
}

export function blinkBeacon(tower: THREE.Group, time: number) {
  const lamp = tower.getObjectByName('beacon') as THREE.Mesh
  const bulb = tower.getObjectByName('beacon-light') as THREE.PointLight
  const on = Math.sin(time * 2.2) > 0.35 ? 1 : 0.15
  const mat = lamp.material as THREE.MeshBasicMaterial
  mat.color.setRGB(3.4 * on, 0.12 * on, 0.05 * on)
  bulb.intensity = 2 + on * 8
}
