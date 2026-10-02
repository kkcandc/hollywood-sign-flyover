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
 * The first three seconds ride the face of the sign into the sun,
 * then open onto the basin. Times are seconds.
 */
const keys: Key[] = [
  { t: 0, p: [84, 72, -11], l: [-16, 76, -10], fov: 30, roll: 8 },
  { t: 1.05, p: [34, 77, -20], l: [-4, 73, -4], fov: 36, roll: -1 },
  { t: 2.15, p: [-6, 92, -44], l: [6, 68, -12], fov: 46, roll: -5 },
  { t: 3.2, p: [14, 132, -118], l: [0, 56, -36], fov: 55, roll: 2 },
  { t: 9, p: [-62, 138, -130], l: [12, 62, -20], fov: 48, roll: -6 },
  { t: 16, p: [24, 168, -48], l: [-10, 48, -240], fov: 56, roll: 7 },
  { t: 25, p: [-110, 210, -340], l: [90, 36, -640], fov: 60, roll: -3 },
  { t: 34, p: [150, 156, -200], l: [-30, 64, -30], fov: 50, roll: 5 },
  { t: 43, p: [-20, 86, -36], l: [16, 72, 2], fov: 36, roll: -7 },
  { t: 48.5, p: [62, 74, -16], l: [4, 74, -8], fov: 32, roll: 4 },
  { t: FLIGHT_DURATION, p: [84, 72, -11], l: [-16, 76, -10], fov: 30, roll: 8 },
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
const rig = new THREE.Object3D()

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
