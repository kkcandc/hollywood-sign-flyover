import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { hash2 } from './noise'
import { SUN_DIR } from './sky'
import { terrainHeight } from './terrain'

export type Dressing = {
  group: THREE.Group
  update: (time: number, camera: THREE.Vector3) => void
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color) {
  const n = geo.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

function shrubGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const olive = new THREE.Color(0x6a7034)
  const dry = new THREE.Color(0xa7843c)
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.ConeGeometry(0.55 + (i % 2) * 0.2, 1.15, 5)
    cone.translate((i - 1) * 0.32, 0.55, i === 1 ? 0.12 : -0.05)
    paint(cone, i === 1 ? dry : olive)
    parts.push(cone)
  }
  return mergeGeometries(parts)
}

function palmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.1, 0.2, 6.5, 5)
  trunk.translate(0, 3.25, 0)
  paint(trunk, new THREE.Color(0x6b5340))
  parts.push(trunk)
  const frondColor = new THREE.Color(0x2f6a32)
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.ConeGeometry(0.08, 2.8, 3)
    frond.translate(0, 1.4, 0)
    frond.rotateZ(1.15)
    frond.rotateY((i / 7) * Math.PI * 2)
    frond.translate(0, 6.4, 0)
    paint(frond, frondColor)
    parts.push(frond)
  }
  return mergeGeometries(parts)
}

export function createDressing(quality: 'high' | 'low'): Dressing {
  const group = new THREE.Group()
  group.name = 'dressing'

  const shrubCount = quality === 'high' ? 900 : 380
  const shrubs = new THREE.InstancedMesh(
    shrubGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    shrubCount,
  )
  const tint = new THREE.Color()
  let placed = 0
  const tmp = new THREE.Object3D()
  for (let n = 0; n < shrubCount * 8 && placed < shrubCount; n++) {
    const x = (hash2(n, 1) - 0.5) * 420
    const z = (hash2(n, 2) - 0.5) * 220 - 10
    if (Math.abs(x) < 78 && z > -8 && z < 18) continue
    const h = terrainHeight(x, z)
    if (h < 20 || h > 78) continue
    const slope = Math.abs(terrainHeight(x + 2, z) - h) + Math.abs(terrainHeight(x, z + 2) - h)
    if (slope > 8) continue
    const s = 0.7 + hash2(n, 3) * 1.5
    tmp.position.set(x, h, z)
    tmp.rotation.set(0, hash2(n, 4) * Math.PI * 2, 0)
    tmp.scale.set(s, s * (0.8 + hash2(n, 5) * 0.6), s)
    tmp.updateMatrix()
    shrubs.setMatrixAt(placed, tmp.matrix)
    tint.setHex(hash2(n, 6) > 0.5 ? 0xc4a15a : 0x7d8648)
    shrubs.setColorAt(placed, tint)
    placed++
  }
  shrubs.count = placed
  shrubs.instanceMatrix.needsUpdate = true
  if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true
  group.add(shrubs)

  const palmCount = quality === 'high' ? 70 : 28
  const palms = new THREE.InstancedMesh(
    palmGeometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    palmCount,
  )
  const palmData: { x: number; z: number; phase: number; base: number }[] = []
  let pcount = 0
  for (let n = 0; n < palmCount * 6 && pcount < palmCount; n++) {
    const x = (hash2(n, 20) - 0.42) * 900
    const z = -40 - hash2(n, 21) * 700
    const h = terrainHeight(x, z)
    if (h > 34 || h < 8) continue
    const s = 0.85 + hash2(n, 22) * 0.7
    tmp.position.set(x, h, z)
    tmp.rotation.set(0, hash2(n, 23) * 6, 0)
    tmp.scale.set(s, s, s)
    tmp.updateMatrix()
    palms.setMatrixAt(pcount, tmp.matrix)
    palmData.push({ x, z, phase: hash2(n, 24) * 6, base: h })
    pcount++
  }
  palms.count = pcount
  palms.instanceMatrix.needsUpdate = true
  group.add(palms)

  const birds = createBirds()
  group.add(birds.group)
  const dust = createDust()
  group.add(dust.points)
  const haze = createHaze()
  group.add(haze.group)
  group.add(createShafts())

  return {
    group,
    update(time, camera) {
      birds.update(time)
      dust.update(camera)
      haze.update(time, camera)
      swayPalms(palms, palmData, time)
    },
  }
}

const palmTmp = new THREE.Object3D()

function swayPalms(
  palms: THREE.InstancedMesh,
  data: { x: number; z: number; phase: number; base: number }[],
  time: number,
) {
  for (let i = 0; i < data.length; i++) {
    const p = data[i]
    palmTmp.position.set(p.x, p.base, p.z)
    palmTmp.rotation.set(
      Math.sin(time * 1.3 + p.phase) * 0.03,
      p.phase,
      Math.cos(time * 1.1 + p.phase) * 0.025,
    )
    palmTmp.scale.set(1, 1, 1)
    palmTmp.updateMatrix()
    palms.setMatrixAt(i, palmTmp.matrix)
  }
  palms.instanceMatrix.needsUpdate = true
}

function createBirds() {
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array([
    -0.7, 0, 0,
    0, 0.08, 0.15,
    0, 0, 0,
    0, 0, 0,
    0, 0.08, 0.15,
    0.7, 0, 0,
  ])
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshBasicMaterial({ color: 0x1c1418, side: THREE.DoubleSide })
  const group = new THREE.Group()
  const flock: THREE.Mesh[] = []
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(geo, mat)
    m.scale.setScalar(1.4 + (i % 3) * 0.3)
    group.add(m)
    flock.push(m)
  }
  return {
    group,
    update(time: number) {
      for (let i = 0; i < flock.length; i++) {
        const a = time * 0.18 + i * 0.7
        const r = 38 + (i % 3) * 8
        const x = Math.cos(a) * r + (i - 4) * 4
        const z = Math.sin(a * 0.8) * 16 + 30
        const y = 92 + Math.sin(a * 2 + i) * 3
        flock[i].position.set(x, y, z)
        flock[i].rotation.y = -a + Math.PI / 2
        flock[i].rotation.z = Math.sin(time * 8 + i) * 0.4
      }
    },
  }
}

function createDust() {
  const count = 420
  const geo = new THREE.BufferGeometry()
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 48
    positions[i * 3 + 1] = (Math.random() - 0.5) * 24
    positions[i * 3 + 2] = (Math.random() - 0.5) * 48
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uSun: { value: SUN_DIR }, uCam: { value: new THREE.Vector3() } },
    vertexShader: /* glsl */ `
      uniform vec3 uCam;
      uniform vec3 uSun;
      varying float vA;
      void main() {
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        vec3 toCam = normalize(uCam - wp);
        float phase = pow(max(dot(toCam, -uSun), 0.0), 1.6);
        vA = phase;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + phase * 3.5) * (180.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);
        if (d > 1.0) discard;
        float a = smoothstep(1.0, 0.2, d) * vA * 0.28;
        gl_FragColor = vec4(1.0, 0.72, 0.38, a);
      }
    `,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  return {
    points,
    update(camera: THREE.Vector3) {
      points.position.copy(camera)
    },
  }
}

function createHaze() {
  const group = new THREE.Group()
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xe7a07a) },
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWPos;
      void main() {
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWPos = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform vec3 uCam;
      varying vec2 vUv;
      varying vec3 vWPos;
      ${NOISE}
      void main() {
        float n = fbm2(vUv * vec2(3.0, 1.4) + vec2(uTime * 0.008, 0.0));
        float dist = length(vWPos - uCam);
        float near = smoothstep(12.0, 70.0, dist);
        float a = smoothstep(0.35, 0.75, n) * 0.18 * near;
        a *= smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        gl_FragColor = vec4(uColor, a);
      }
    `,
  })
  const heights = [16, 28, 42]
  for (let i = 0; i < heights.length; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), mat)
    plane.rotation.x = -Math.PI / 2
    plane.position.set(80, heights[i], -620)
    plane.renderOrder = 2
    group.add(plane)
  }
  return {
    group,
    update(time: number, camera: THREE.Vector3) {
      mat.uniforms.uTime.value = time
      mat.uniforms.uCam.value.copy(camera)
    },
  }
}

const NOISE = /* glsl */ `
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash12(i);
  float b = hash12(i+vec2(1.0,0.0));
  float c = hash12(i+vec2(0.0,1.0));
  float d = hash12(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm2(vec2 p){
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return v;
}
`

function createShafts() {
  const group = new THREE.Group()
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float across = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.55, vUv.x);
        float along = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.2, vUv.y);
        float a = across * along * 0.07;
        gl_FragColor = vec4(1.0, 0.62, 0.28, a);
      }
    `,
  })
  const along = SUN_DIR.clone().normalize()
  const sideways = new THREE.Vector3(-along.z, 0, along.x).normalize()
  const up = new THREE.Vector3().crossVectors(sideways, along).normalize()
  for (let i = 0; i < 4; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(220, 36), mat)
    const shift = sideways.clone().multiplyScalar((i - 1.5) * 18)
    plane.position.set(-8, 78, 4).add(shift)
    const basis = new THREE.Matrix4().makeBasis(along, up, sideways)
    plane.quaternion.setFromRotationMatrix(basis)
    plane.rotateZ(i * 0.04)
    plane.renderOrder = 3
    group.add(plane)
  }
  return group
}
