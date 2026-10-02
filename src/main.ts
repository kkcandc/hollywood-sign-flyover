import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import './style.css'
import { createCity } from './city'
import { createDressing } from './dressing'
import { FLIGHT_DURATION, sampleFlight } from './flight'
import { createPipeline } from './pipeline'
import { blinkBeacon, createSign, createTower } from './sign'
import { createSky, FOG_COLOR, skyTime, SUN_DIR } from './sky'
import { createTerrain, terrainHeight } from './terrain'
import { createUi } from './ui'

const params = new URLSearchParams(location.search)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const quality = matchMedia('(max-width: 800px)').matches ? 'low' : 'high'
const pixelCap = quality === 'high' ? 1.75 : 1.35

const app = document.querySelector<HTMLDivElement>('#app')!
const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
})
renderer.setClearColor(0x14080c, 1)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = FOG_COLOR
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.00105)
scene.environmentIntensity = 0.62

const camera = new THREE.PerspectiveCamera(40, 1, 0.4, 5000)

const sun = new THREE.DirectionalLight(0xffc9a0, 4.4)
sun.position.copy(SUN_DIR).multiplyScalar(180)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.00025
sun.shadow.normalBias = 0.035
sun.shadow.camera.near = 20
sun.shadow.camera.far = 320
sun.shadow.camera.left = -160
sun.shadow.camera.right = 160
sun.shadow.camera.top = 140
sun.shadow.camera.bottom = -80
const sunTarget = new THREE.Object3D()
sunTarget.position.set(0, 66, 0)
sun.target = sunTarget
scene.add(sun, sunTarget)

scene.add(new THREE.HemisphereLight(0xffb48a, 0x2a2038, 0.55))
const fill = new THREE.DirectionalLight(0x8ea0c4, 0.38)
fill.position.set(20, 50, -180)
scene.add(fill)
// The sun rakes the ridge from the west and leaves the south faces in shade.
const signLight = new THREE.DirectionalLight(0xfff8f2, 1.85)
signLight.position.set(10, 96, -160)
scene.add(signLight)

const sky = createSky()
const envScene = new THREE.Scene()
envScene.add(sky)
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(envScene, 0.04).texture
envScene.remove(sky)
pmrem.dispose()
scene.add(sky)

const terrain = createTerrain(quality)
scene.add(terrain.mesh)

const sign = createSign()
scene.add(sign.group)
const tower = createTower()
scene.add(tower)

const city = createCity(quality)
scene.add(city.group)
const dressing = createDressing(quality)
scene.add(dressing.group)

const pipeline = createPipeline(renderer, scene, camera)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enabled = false
controls.enableDamping = true
controls.enablePan = false
controls.minDistance = 14
controls.maxDistance = 700
controls.maxPolarAngle = 1.35
controls.target.copy(sign.center)

let flightTime = params.has('t') ? Number(params.get('t')) || 0 : reduced ? 3.35 : 0
let playing = !reduced && !params.has('still')
let orbit = reduced || params.has('orbit')
let chromeShown = false
let titleShown = false
let titleHidden = false
const blend = { active: false, t: 0, duration: 1.35, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fromFov: 40 }

const sunWorld = new THREE.Vector3()
const ndc = new THREE.Vector3()

function framedFov(baseFov: number) {
  // Keyframes are tuned for 16:9. On a portrait screen the vertical fov would
  // crop the word, so widen it until the horizontal coverage matches.
  const wide = 16 / 9
  if (camera.aspect >= wide) return baseFov
  const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * wide)
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfH) / Math.max(0.35, camera.aspect)))
}

function applyFlight(time: number) {
  const pose = sampleFlight(time)
  camera.position.copy(pose.position)
  camera.quaternion.copy(pose.quaternion)
  const fov = framedFov(pose.fov)
  if (Math.abs(camera.fov - fov) > 0.02) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}

function enableOrbit() {
  orbit = true
  controls.enabled = true
  const dir = new THREE.Vector3()
  camera.getWorldDirection(dir)
  controls.target.copy(camera.position).addScaledVector(dir, 30)
  controls.update()
  ui.setOrbit(true)
  ui.showChrome()
  chromeShown = true
}

function disableOrbit() {
  orbit = false
  controls.enabled = false
  blend.active = true
  blend.t = 0
  blend.fromPos.copy(camera.position)
  blend.fromQuat.copy(camera.quaternion)
  blend.fromFov = camera.fov
  ui.setOrbit(false)
}

function seek(u: number) {
  flightTime = u * FLIGHT_DURATION
  playing = false
  if (orbit) disableOrbit()
  blend.active = false
  applyFlight(flightTime)
  ui.setPlaying(false)
  ui.setProgress(u)
}

const ui = createUi({
  onTogglePlay() {
    if (orbit) disableOrbit()
    playing = !playing
    ui.setPlaying(playing)
  },
  onToggleOrbit() {
    if (orbit) {
      disableOrbit()
      playing = true
      ui.setPlaying(true)
    } else {
      playing = false
      ui.setPlaying(false)
      enableOrbit()
    }
  },
  onSeek: seek,
})

applyFlight(flightTime)
ui.setPlaying(playing)
if (orbit) enableOrbit()

function resize() {
  const pr = Math.min(window.devicePixelRatio || 1, pixelCap)
  pipeline.setSize(window.innerWidth, window.innerHeight, pr)
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight)
  camera.updateProjectionMatrix()
}
resize()
window.addEventListener('resize', resize)

window.addEventListener('keydown', (event) => {
  if (event.key === ' ') {
    event.preventDefault()
    if (orbit) disableOrbit()
    playing = !playing
    ui.setPlaying(playing)
  } else if (event.key === 'ArrowRight') {
    seek(Math.min(1, flightTime / FLIGHT_DURATION + 1 / FLIGHT_DURATION))
  } else if (event.key === 'ArrowLeft') {
    seek(Math.max(0, flightTime / FLIGHT_DURATION - 1 / FLIGHT_DURATION))
  } else if (event.key === 'o' || event.key === 'O') {
    if (orbit) {
      disableOrbit()
      playing = true
      ui.setPlaying(true)
    } else {
      playing = false
      ui.setPlaying(false)
      enableOrbit()
    }
  } else if (event.key === 'f' || event.key === 'F') {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }
})

function sunVisibility(origin: THREE.Vector3) {
  let vis = 1
  for (let i = 1; i <= 7; i++) {
    const dist = 18 + i * 22
    const p = origin.clone().addScaledVector(SUN_DIR, dist)
    if (terrainHeight(p.x, p.z) > p.y + 1.5) vis *= 0.55
  }
  return vis
}

renderer.compile(scene, camera)

let last = performance.now()
let shotFrames = 0
const clean = params.has('clean') || params.has('shot')
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now

  if (playing && !orbit) flightTime += dt
  if (flightTime > FLIGHT_DURATION) flightTime -= FLIGHT_DURATION

  if (orbit) {
    controls.update()
  } else if (blend.active) {
    blend.t += dt
    const k = smooth(Math.min(1, blend.t / blend.duration))
    const pose = sampleFlight(flightTime)
    camera.position.lerpVectors(blend.fromPos, pose.position, k)
    camera.quaternion.slerpQuaternions(blend.fromQuat, pose.quaternion, k)
    camera.fov = blend.fromFov + (framedFov(pose.fov) - blend.fromFov) * k
    camera.updateProjectionMatrix()
    if (k >= 1) blend.active = false
  } else {
    applyFlight(flightTime)
  }

  sky.position.copy(camera.position)
  skyTime(sky, flightTime)
  blinkBeacon(tower, flightTime)
  city.update(flightTime, camera.position)
  dressing.update(flightTime, camera.position)

  sunWorld.copy(SUN_DIR).multiplyScalar(4000)
  ndc.copy(sunWorld).project(camera)
  const inFront = ndc.z < 1
  const punch = Math.exp(-Math.min(flightTime, 8) * 0.45)
  pipeline.setSun(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, inFront ? sunVisibility(camera.position) : 0, flightTime, punch)
  pipeline.render()
  ui.setProgress(flightTime / FLIGHT_DURATION)

  if (params.has('shot')) {
    shotFrames += 1
    if (shotFrames >= 3) {
      document.documentElement.dataset.ready = '1'
      return
    }
  }

  if (clean) {
    requestAnimationFrame(frame)
    return
  }
  if (!chromeShown && (flightTime > 3.3 || orbit)) {
    chromeShown = true
    ui.showChrome()
  }
  if (!titleShown && flightTime > 3.25 && flightTime < 9) {
    titleShown = true
    ui.showTitle()
  }
  if (titleShown && !titleHidden && flightTime > 8.6) {
    titleHidden = true
    ui.hideTitle()
  }

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

if (params.has('debug')) {
  console.info('terrain max edge', terrain.maxEdge.toFixed(1), 'm')
}
