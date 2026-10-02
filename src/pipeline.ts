import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uSunVis: { value: 1 },
    uTime: { value: 0 },
    uPunch: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSun;
    uniform float uSunVis;
    uniform float uTime;
    uniform float uPunch;
    varying vec2 vUv;

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 color = src.rgb;

      vec2 toSun = uSun - vUv;
      float dist = length(toSun);
      float glow = exp(-dist * 7.5) * uSunVis;
      color += vec3(1.0, 0.55, 0.18) * glow * (0.45 + uPunch * 0.35);

      vec2 streak = vec2(toSun.x, 0.0);
      float horiz = exp(-abs(vUv.y - uSun.y) * 28.0) * exp(-abs(toSun.x) * 2.2);
      color += vec3(1.0, 0.72, 0.4) * horiz * uSunVis * (0.18 + uPunch * 0.22);

      for (int i = 1; i <= 4; i++) {
        float f = float(i) / 4.0;
        vec2 g = mix(uSun, vec2(0.5), f * 1.35);
        vec3 tint = mix(vec3(1.0, 0.7, 0.4), vec3(0.5, 0.7, 1.0), f);
        float gd = length(vUv - g);
        color += tint * exp(-gd * (18.0 + f * 20.0)) * uSunVis * 0.12;
      }

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 graded = mix(color * vec3(0.72, 0.78, 1.08), color * vec3(1.08, 0.98, 0.9), smoothstep(0.02, 0.45, luma));
      color = mix(color, graded, 0.38);

      vec2 q = vUv - 0.5;
      float vig = smoothstep(0.28, 1.05, length(q * vec2(1.15, 1.28)));
      color *= mix(1.0, 0.78, vig);

      float grain = fract(sin(dot(gl_FragCoord.xy + uTime * 12.0, vec2(12.9898, 78.233))) * 43758.5453);
      color += (grain - 0.5) * 0.012;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

export type Pipeline = {
  composer: EffectComposer
  setSize: (w: number, h: number, pr: number) => void
  setSun: (ndcX: number, ndcY: number, visible: number, time: number, punch: number) => void
  render: () => void
}

export function createPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Pipeline {
  const size = new THREE.Vector2()
  renderer.getSize(size)
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
  })
  const composer = new EffectComposer(renderer, rt)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(size, 0.48, 0.72, 0.82)
  composer.addPass(bloom)
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)
  composer.addPass(new OutputPass())

  return {
    composer,
    setSize(w, h, pr) {
      renderer.setPixelRatio(pr)
      renderer.setSize(w, h, false)
      composer.setPixelRatio(pr)
      composer.setSize(w, h)
    },
    setSun(ndcX, ndcY, visible, time, punch) {
      grade.uniforms.uSun.value.set(ndcX, ndcY)
      grade.uniforms.uSunVis.value = visible
      grade.uniforms.uTime.value = time
      grade.uniforms.uPunch.value = punch
    },
    render() {
      composer.render()
    },
  }
}
