import * as THREE from 'three'
import { GLSL_NOISE } from './glsl'
import { hash2 } from './noise'
import { SUN_DIR } from './sky'
import { terrainHeight } from './terrain'

export type CityBuild = {
  group: THREE.Group
  update: (time: number, camera: THREE.Vector3) => void
}

const tmp = new THREE.Object3D()
const color = new THREE.Color()

export function createCity(quality: 'high' | 'low'): CityBuild {
  const group = new THREE.Group()
  group.name = 'city'

  type Lot = {
    x: number
    z: number
    y: number
    w: number
    d: number
    h: number
    seed: number
    style: number
    tint: number
  }
  const lots: Lot[] = []
  const span = quality === 'high' ? 1 : 2

  for (let ix = -26; ix <= 32; ix += span) {
    for (let iz = -52; iz <= -2; iz += span) {
      const lotH = hash2(ix + 3, iz + 11)
      if (lotH < 0.16) continue
      const x = ix * 34 + 17
      const z = iz * 34 + 17
      const ground = terrainHeight(x, z)
      if (ground > 52) continue
      if (Math.abs(x) < 84 && z > -18) continue

      const downtown = Math.exp(-((x - 260) ** 2 + (z + 680) ** 2) / (2 * 190 * 190))
      const core = Math.exp(-((x + 30) ** 2 + (z + 280) ** 2) / (2 * 260 * 260))
      const foothill = ground > 18 ? 1 : 0
      let h = 7 + lotH * 18 + core * 26 + downtown * (50 + lotH * 150)
      if (foothill) h = 5.5 + lotH * 8
      const glass = downtown > 0.35 && lotH > 0.62 ? 1 : 0
      const foot = foothill ? 8 + lotH * 4 : 12 + lotH * 8
      lots.push({
        x,
        z,
        y: ground,
        w: foot,
        d: foot * (0.62 + hash2(iz, ix) * 0.5),
        h,
        seed: lotH * 100 + ix,
        style: glass,
        tint: hash2(ix, iz + 4),
      })
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1)
  const seeds = new Float32Array(lots.length)
  const styles = new Float32Array(lots.length)
  for (let i = 0; i < lots.length; i++) {
    seeds[i] = lots[i].seed
    styles[i] = lots[i].style
  }
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styles, 1))

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0.08,
  })
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: SUN_DIR },
    uCam: { value: new THREE.Vector3() },
    uFogColor: { value: new THREE.Color(0xe39a72) },
    uFogDensity: { value: 0.00105 },
  }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uSun = uniforms.uSun
    shader.uniforms.uCam = uniforms.uCam
    shader.uniforms.uFogColor = uniforms.uFogColor
    shader.uniforms.uFogDensity = uniforms.uFogDensity
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aSeed;
         attribute float aStyle;
         varying float vSeed;
         varying float vStyle;
         varying vec3 vWPos;
         varying vec3 vLocal;
         varying vec2 vBoxUv;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vSeed = aSeed;
         vStyle = aStyle;
         vLocal = position;
         vBoxUv = uv;
         #ifdef USE_INSTANCING
           vWPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
         #else
           vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
         #endif`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         uniform vec3 uSun;
         uniform vec3 uCam;
         uniform vec3 uFogColor;
         uniform float uFogDensity;
         varying float vSeed;
         varying float vStyle;
         varying vec3 vWPos;
         varying vec3 vLocal;
         ${GLSL_NOISE}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         vec3 N = normalize(vWNrm);
         float ndl = max(dot(N, uSun), 0.0);
         float paneX = mix(4.0, 7.0, vStyle);
         float sx = floor(vBoxUv.x * paneX + vSeed);
         float sy = floor(vBoxUv.y * (10.0 + vStyle * 16.0));
         float pane = step(0.22, fract(vBoxUv.x * paneX)) * step(0.28, fract(vBoxUv.y * (10.0 + vStyle * 16.0)));
         pane *= 1.0 - smoothstep(0.45, 0.85, N.y);
         float rnd = hash12(vec2(sx, sy) + vSeed);
         float on = step(mix(0.58, 0.28, vStyle), rnd);
         float twinkle = step(0.985, rnd) * step(0.65, fract(sin(uTime * 0.35 + rnd * 40.0)));
         on *= mix(1.0, 1.0 - twinkle, step(0.985, rnd));
         vec3 warm = vec3(1.15, 0.62, 0.24);
         vec3 cool = vec3(0.55, 0.74, 1.05);
         vec3 win = mix(warm, cool, step(0.82, rnd));
         float shade = mix(0.45, 1.0, 1.0 - ndl);
         totalEmissiveRadiance += win * on * pane * shade * mix(1.15, 2.4, vStyle);`,
      )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 Nlit = normalize(vWNrm);
       float glass = smoothstep(0.5, 1.0, vStyle);
       vec3 stucco = diffuseColor.rgb;
       vec3 glazing = vec3(0.16, 0.18, 0.22);
       diffuseColor.rgb = mix(stucco, glazing, glass);
       float roof = smoothstep(0.22, 0.48, vLocal.y);
       diffuseColor.rgb *= mix(1.0, 0.62, roof * (1.0 - glass));
       float fres = pow(1.0 - max(dot(Nlit, normalize(uCam - vWPos)), 0.0), 3.0);
       diffuseColor.rgb += vec3(1.0, 0.55, 0.32) * fres * glass * 0.45;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       roughnessFactor = mix(0.86, 0.22, smoothstep(0.5, 1.0, vStyle));`,
    )
    // World normal for the city shader. Injected next to the varyings above.
    shader.vertexShader = shader.vertexShader.replace(
      'varying vec3 vLocal;',
      `varying vec3 vLocal;
       varying vec3 vWNrm;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      'varying vec3 vLocal;',
      `varying vec3 vLocal;
       varying vec2 vBoxUv;
       varying vec3 vWNrm;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
       #ifdef USE_INSTANCING
         vWNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
       #else
         vWNrm = normalize(mat3(modelMatrix) * objectNormal);
       #endif`,
    )
  }
  mat.customProgramCacheKey = () => 'city-blocks-v1'

  const buildings = new THREE.InstancedMesh(geo, mat, lots.length)
  buildings.castShadow = false
  buildings.receiveShadow = false
  const palette = [0xf3e6d4, 0xe6d2b4, 0xd8c2a4, 0xf7f1e8, 0xc98462, 0xb9ada0, 0xded4c6]
  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i]
    tmp.position.set(lot.x, lot.y + lot.h / 2, lot.z)
    tmp.rotation.set(0, lot.y > 18 ? (lot.tint - 0.5) * 0.5 : 0, 0)
    tmp.scale.set(lot.w, lot.h, lot.d)
    tmp.updateMatrix()
    buildings.setMatrixAt(i, tmp.matrix)
    color.setHex(palette[Math.floor(lot.tint * (palette.length - 0.01))])
    if (lot.style > 0.5) color.setHex(0x9aa7b0)
    color.multiplyScalar(0.82 + (lot.tint % 0.2))
    buildings.setColorAt(i, color)
  }
  buildings.instanceMatrix.needsUpdate = true
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true
  group.add(buildings)

  const cars = createCars(quality)
  group.add(cars.mesh)
  const lamps = createLamps()
  group.add(lamps)

  return {
    group,
    update(time, cam) {
      uniforms.uTime.value = time
      uniforms.uCam.value.copy(cam)
      cars.update(time)
    },
  }
}

function createCars(quality: 'high' | 'low') {
  const count = quality === 'high' ? 220 : 90
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.frustumCulled = false
  const axis = new Uint8Array(count)
  const fixed = new Float32Array(count)
  const speed = new Float32Array(count)
  const phase = new Float32Array(count)
  const y = new Float32Array(count)
  const len = new Float32Array(count)
  const tint = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const freeway = i < count * 0.45
    if (freeway) {
      const east = i % 2 === 0
      axis[i] = east ? 0 : 1
      fixed[i] = east ? -520 + (i % 5) * 3.2 : 180 + (i % 4) * 3.2
      speed[i] = 70 + (i % 7) * 18
      len[i] = east ? 2.8 : 2.2
    } else {
      axis[i] = i % 2
      const lane = (i % 18) - 9
      fixed[i] = lane * 34 + 17
      speed[i] = 18 + (i % 5) * 6
      len[i] = 1.4
    }
    phase[i] = hash2(i, 9) * 4000
    y[i] = 0
    tint[i] = i % 3 === 0 ? 0 : 1
    color.setRGB(tint[i] > 0 ? 2.4 : 1.5, tint[i] > 0 ? 1.7 : 0.18, tint[i] > 0 ? 0.7 : 0.1)
    mesh.setColorAt(i, color)
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  return {
    mesh,
    update(time: number) {
      for (let i = 0; i < count; i++) {
        const travel = phase[i] + time * speed[i] * (i % 2 === 0 ? 1 : -1)
        let x: number
        let z: number
        if (axis[i] === 0) {
          x = ((travel % 1600) + 1600) % 1600 - 700
          z = fixed[i]
          tmp.rotation.set(0, 0, 0)
          tmp.scale.set(len[i], 0.12, 0.12)
        } else {
          z = -(((travel % 1400) + 1400) % 1400) - 40
          x = fixed[i]
          tmp.rotation.set(0, 0, 0)
          tmp.scale.set(0.12, 0.12, len[i])
        }
        const ground = terrainHeight(x, z)
        if (ground > 30) {
          tmp.scale.set(0.001, 0.001, 0.001)
          tmp.position.set(x, ground, z)
        } else {
          tmp.position.set(x, ground + 0.35, z)
        }
        tmp.updateMatrix()
        mesh.setMatrixAt(i, tmp.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}

function createLamps() {
  const spots: { x: number; z: number }[] = []
  for (let ix = -20; ix <= 26; ix += 2) {
    for (let iz = -46; iz <= -3; iz += 2) {
      if (hash2(ix, iz) < 0.45) continue
      const x = ix * 34
      const z = iz * 34
      if (terrainHeight(x, z) > 28) continue
      spots.push({ x, z })
    }
  }
  const geo = new THREE.SphereGeometry(0.55, 6, 6)
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.15, 0.62) })
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length)
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i]
    const ground = terrainHeight(s.x, s.z)
    tmp.position.set(s.x, ground + 7.5, s.z)
    tmp.rotation.set(0, 0, 0)
    tmp.scale.set(1, 1, 1)
    tmp.updateMatrix()
    mesh.setMatrixAt(i, tmp.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}
