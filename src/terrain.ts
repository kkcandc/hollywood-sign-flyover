import * as THREE from 'three'
import { GLSL_NOISE } from './glsl'
import { fbm, smoothstep } from './noise'

/**
 * +X east, −Z south (the city basin), +Z north (the back of the ridge).
 * The letters sit on the south face, baseline above the slope.
 */
export const SIGN_BASELINE = 63

export function terrainHeight(x: number, z: number): number {
  const crestZ = 22
  const southT = (z - crestZ) / 46
  const northT = (z - crestZ) / 120
  const profile = z < crestZ ? Math.exp(-southT * southT * 2.35) : Math.exp(-northT * northT * 0.85)
  const mount = Math.exp(-(x * x) / (2 * 130 * 130))
  const ridge = profile * (50 + 7 * mount)

  const hills = fbm(x * 0.0034 + 2, z * 0.0034) * 9 + fbm(x * 0.011 + 8, z * 0.011) * 2.6
  const basin = smoothstep(28, -180, z) * 42
  const westSea = smoothstep(-900, -1400, x) * smoothstep(40, -200, z)

  let h = 16 + ridge + hills - basin
  h = h * (1 - westSea * 0.35) + 8 * westSea * 0.35
  return Math.max(7.5, h)
}

function cluster(u: number, c: number, p: number): number {
  const cc = Math.min(0.9, Math.max(0.1, c))
  if (u <= cc) {
    const t = u / cc
    return cc * (1 - Math.pow(1 - t, p))
  }
  const t = (u - cc) / (1 - cc)
  return cc + (1 - cc) * Math.pow(t, p)
}

export type TerrainBuild = {
  mesh: THREE.Mesh
  /** Longest edge, useful while tuning density. */
  maxEdge: number
}

export function createTerrain(quality: 'high' | 'low'): TerrainBuild {
  const x0 = -1500
  const x1 = 1300
  const z0 = -1900
  const z1 = 520
  const segX = quality === 'high' ? 300 : 170
  const segZ = quality === 'high' ? 230 : 130
  const focusX = (0 - x0) / (x1 - x0)
  const focusZ = (0 - z0) / (z1 - z0)
  const p = 1.62

  const gx = segX + 1
  const gz = segZ + 1
  const positions = new Float32Array(gx * gz * 3)
  const uvs = new Float32Array(gx * gz * 2)

  for (let j = 0; j < gz; j++) {
    for (let i = 0; i < gx; i++) {
      const u = i / segX
      const v = j / segZ
      const cu = cluster(u, focusX, p)
      const cv = cluster(v, focusZ, p)
      const x = x0 + (x1 - x0) * cu
      const z = z0 + (z1 - z0) * cv
      const y = terrainHeight(x, z)
      const idx = j * gx + i
      positions[idx * 3] = x
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = z
      uvs[idx * 2] = cu
      uvs[idx * 2 + 1] = cv
    }
  }

  const indices = new Uint32Array(segX * segZ * 6)
  let k = 0
  let maxEdge = 0
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * gx + i
      const b = a + 1
      const c = a + gx
      const d = c + 1
      indices[k++] = a
      indices[k++] = c
      indices[k++] = b
      indices[k++] = b
      indices[k++] = c
      indices[k++] = d
      const ax = positions[a * 3]
      const az = positions[a * 3 + 2]
      const bx = positions[b * 3]
      const bz = positions[b * 3 + 2]
      const cx = positions[c * 3]
      const cz = positions[c * 3 + 2]
      maxEdge = Math.max(maxEdge, Math.hypot(bx - ax, bz - az), Math.hypot(cx - ax, cz - az))
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeVertexNormals()

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.02,
  })

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNrm;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         vWNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNrm;
         ${GLSL_NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float slope = 1.0 - clamp(vWNrm.y, 0.0, 1.0);
         float n = fbm2(vWPos.xz * 0.012);
         float n2 = fbm2(vWPos.xz * 0.045 + 4.0);
         float micro = vnoise(vWPos.xz * 0.35);
         vec3 soil = vec3(0.34, 0.22, 0.13);
         vec3 dry = vec3(0.55, 0.38, 0.18);
         vec3 gold = vec3(0.78, 0.55, 0.24);
         vec3 sage = vec3(0.30, 0.33, 0.16);
         vec3 rock = vec3(0.40, 0.36, 0.32);
         vec3 albedo = mix(soil, dry, smoothstep(0.35, 0.7, n));
         albedo = mix(albedo, gold, smoothstep(0.55, 0.85, n2) * (1.0 - slope));
         albedo = mix(albedo, sage, smoothstep(0.62, 0.9, n) * smoothstep(0.45, 0.1, slope) * 0.65);
         albedo = mix(albedo, rock, smoothstep(0.38, 0.72, slope));
         albedo *= mix(0.92, 1.06, micro);

         float dx = abs(mod(vWPos.x + 17.0, 34.0) - 17.0);
         float dz = abs(mod(vWPos.z + 17.0, 34.0) - 17.0);
         float cityMask = smoothstep(34.0, 16.0, vWPos.y) * smoothstep(6.0, -50.0, vWPos.z);
         float onRoad = (1.0 - smoothstep(3.3, 4.8, min(dx, dz))) * cityMask;
         float freeway = (1.0 - smoothstep(8.0, 11.0, abs(vWPos.z + 520.0))) * cityMask;
         freeway = max(freeway, (1.0 - smoothstep(7.0, 10.0, abs(vWPos.x - 180.0))) * cityMask * smoothstep(-40.0, -120.0, vWPos.z));
         vec3 asphalt = vec3(0.11, 0.10, 0.10);
         albedo = mix(albedo, albedo * vec3(0.62, 0.58, 0.52), cityMask * (1.0 - onRoad) * 0.72);
         albedo = mix(albedo, asphalt, max(onRoad, freeway));
         float lane = step(0.72, fract(vWPos.x * 0.08)) * step(0.72, fract(vWPos.z * 0.08));
         albedo += vec3(0.25, 0.18, 0.05) * freeway * lane * 0.35;
         diffuseColor.rgb *= albedo;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float slopeR = 1.0 - clamp(vWNrm.y, 0.0, 1.0);
         float nR = fbm2(vWPos.xz * 0.045 + 4.0);
         float dxR = abs(mod(vWPos.x + 17.0, 34.0) - 17.0);
         float dzR = abs(mod(vWPos.z + 17.0, 34.0) - 17.0);
         float cityR = smoothstep(34.0, 16.0, vWPos.y) * smoothstep(6.0, -50.0, vWPos.z);
         float roadR = max(
           (1.0 - smoothstep(3.3, 4.8, min(dxR, dzR))) * cityR,
           (1.0 - smoothstep(8.0, 11.0, abs(vWPos.z + 520.0))) * cityR
         );
         roughnessFactor = mix(0.96, 0.72, (1.0 - slopeR) * smoothstep(0.4, 0.8, nR));
         roughnessFactor = mix(roughnessFactor, 0.88, roadR);`,
      )
  }
  mat.customProgramCacheKey = () => 'hills-v1'

  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.name = 'hills'
  return { mesh, maxEdge }
}
