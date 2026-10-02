import * as THREE from 'three'
import { terrainHeight } from './terrain'

export const FLIGHT_DURATION = 52

type Key = {
  t: number
  p: [number, number, number]
  l: [number, number, number]
  fov: number
  roll: number
}

/**
 * Every key looks at the south face of the sign. The word is about 150m wide,
 * so the camera stays far enough south that all nine letters fit, including
 * the wide passes. Times are seconds.
 */
const keys: Key[] = [
  { t: 0, p: [18, 86, -128], l: [0, 72, 0], fov: 54, roll: 3.5 },
  { t: 1.5, p: [-6, 94, -142], l: [2, 71, 0], fov: 54, roll: -1.5 },
  { t: 3.2, p: [-28, 108, -168], l: [0, 70, 1], fov: 52, roll: -3 },
  { t: 9, p: [-78, 124, -188], l: [6, 70, 0], fov: 52, roll: -4 },
  { t: 16, p: [16, 148, -156], l: [0, 68, 2], fov: 54, roll: 3 },
  { t: 25, p: [96, 136, -196], l: [-8, 70, 0], fov: 52, roll: 4 },
  { t: 34, p: [-24, 112, -176], l: [8, 71, 0], fov: 50, roll: -2.5 },
  { t: 43, p: [42, 92, -134], l: [-2, 72, 0], fov: 52, roll: 2 },
  { t: 48.5, p: [28, 86, -124], l: [0, 72, 0], fov: 54, roll: 3 },
  { t: FLIGHT_DURATION, p: [18, 86, -128], l: [0, 72, 0], fov: 54, roll: 3.5 },
]

function catmull(a: number, b: number, c: number, d: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
}

function keyIndex(i: number) {
  const n = keys.length - 1
  return ((i % n) + n) % n
}

const pose = {
  position: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  fov: 40,
}
const look = new THREE.Vector3()
// Camera.lookAt, not Object3D.lookAt. A plain object aims +Z at the target;
// copying that quaternion onto the shot camera (which looks down -Z) faced
// the lens away from the hillside for the entire flyover.
const rig = new THREE.PerspectiveCamera()

export function sampleFlight(time: number) {
  const dur = FLIGHT_DURATION
  let t = time % dur
  if (t < 0) t += dur
  const n = keys.length - 1
  let i = 0
  for (; i < n - 1; i++) if (t < keys[i + 1].t) break
  const span = keys[i + 1].t - keys[i].t
  const u = span > 0 ? (t - keys[i].t) / span : 0
  const k0 = keys[keyIndex(i - 1)]
  const k1 = keys[i]
  const k2 = keys[keyIndex(i + 1)]
  const k3 = keys[keyIndex(i + 2)]

  pose.position.set(
    catmull(k0.p[0], k1.p[0], k2.p[0], k3.p[0], u),
    catmull(k0.p[1], k1.p[1], k2.p[1], k3.p[1], u),
    catmull(k0.p[2], k1.p[2], k2.p[2], k3.p[2], u),
  )
  look.set(
    catmull(k0.l[0], k1.l[0], k2.l[0], k3.l[0], u),
    catmull(k0.l[1], k1.l[1], k2.l[1], k3.l[1], u),
    catmull(k0.l[2], k1.l[2], k2.l[2], k3.l[2], u),
  )
  const roll = catmull(k0.roll, k1.roll, k2.roll, k3.roll, u)
  pose.fov = catmull(k0.fov, k1.fov, k2.fov, k3.fov, u)

  const ground = terrainHeight(pose.position.x, pose.position.z)
  if (pose.position.y < ground + 8) pose.position.y = ground + 8

  // Low, slow gimbal drift. Continuous clock time is mixed in by the caller via `time`.
  pose.position.x += Math.sin(time * 0.65) * 0.18
  pose.position.y += Math.sin(time * 0.47 + 1.2) * 0.12

  rig.position.copy(pose.position)
  rig.up.set(0, 1, 0)
  rig.lookAt(look)
  rig.rotateZ(THREE.MathUtils.degToRad(roll))
  pose.quaternion.copy(rig.quaternion)
  return pose
}
