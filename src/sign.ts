import * as THREE from 'three'
import { WORD, glyphFor, type Ring } from './glyphs'
import { terrainHeight, SIGN_BASELINE } from './terrain'

const LETTER_HEIGHT = 15.2

function ringToPath(ring: Ring, clockwiseHole: boolean): THREE.Path {
  const path = clockwiseHole ? new THREE.Path() : new THREE.Shape()
  path.moveTo(ring[0][0], ring[0][1])
  for (let i = 1; i < ring.length; i++) path.lineTo(ring[i][0], ring[i][1])
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

function letterObject(
  ch: string,
  materials: THREE.Material[],
): { object: THREE.Group; width: number } {
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
    const mesh = new THREE.Mesh(geo, materials)
    mesh.castShadow = true
    mesh.receiveShadow = true
    object.add(mesh)
  })
  return { object, width: maxX - minX }
}

function paintTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#f3f0e8'
  g.fillRect(0, 0, 512, 512)
  const img = g.getImageData(0, 0, 512, 512)
  const d = img.data
  for (let y = 0; y < 512; y++) {
    const streak = Math.sin(y * 0.37) * 0.5 + Math.sin(y * 0.11 + 2) * 0.5
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4
      const n = Math.sin(x * 12.1 + y * 4.7) * Math.sin(x * 0.2 + y * 0.7)
      const grime = (n * 0.5 + 0.5) * 18 + streak * 8
      const edge = x < 18 || x > 494 || y < 18 || y > 494 ? 22 : 0
      d[i] = Math.max(0, d[i] - grime - edge)
      d[i + 1] = Math.max(0, d[i + 1] - grime * 0.95 - edge)
      d[i + 2] = Math.max(0, d[i + 2] - grime * 0.7 - edge)
    }
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

function roughnessTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  const img = g.createImageData(256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + Math.floor(Math.random() * 70)
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export type SignBuild = {
  group: THREE.Group
  center: THREE.Vector3
}

export function createSign(): SignBuild {
  const faceMap = paintTexture()
  const roughMap = roughnessTexture()
  const face = new THREE.MeshPhysicalMaterial({
    map: faceMap,
    roughnessMap: roughMap,
    color: 0xfff6ee,
    roughness: 0.46,
    metalness: 0.05,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
    sheen: 0.45,
    sheenColor: new THREE.Color(0xffb27a),
    sheenRoughness: 0.55,
  })
  const side = new THREE.MeshStandardMaterial({
    color: 0xc9c2b4,
    roughness: 0.72,
    metalness: 0.08,
  })
  const back = new THREE.MeshStandardMaterial({
    color: 0xb7b0a3,
    roughness: 0.8,
    metalness: 0.06,
  })
  const steel = new THREE.MeshStandardMaterial({
    color: 0x2c2926,
    roughness: 0.48,
    metalness: 0.72,
  })

  const group = new THREE.Group()
  group.name = 'sign'

  const built = WORD.map((ch) => letterObject(ch, [face, back, side]))
  const gap = 2.45
  const total = built.reduce((a, b) => a + b.width, 0) + gap * (built.length - 1)
  let cursor = -total / 2

  const placed: { x: number; w: number }[] = []
  built.forEach((letter, i) => {
    const w = letter.width
    const dx = cursor + w / 2
    letter.object.position.x = cursor
    letter.object.position.z = -(dx * dx) * 0.00028
    letter.object.rotation.y = -dx * 0.0011
    letter.object.name = `letter-${WORD[i]}-${i}`
    group.add(letter.object)
    placed.push({ x: dx, w })
    cursor += w + gap
  })

  group.position.y = SIGN_BASELINE

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
