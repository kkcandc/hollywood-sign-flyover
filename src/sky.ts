import * as THREE from 'three'
import { GLSL_NOISE } from './glsl'

export const SUN_DIR = new THREE.Vector3(-0.92, 0.145, -0.22).normalize()
export const FOG_COLOR = new THREE.Color(0xe39a72)

export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(2200, 48, 32)
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSun: { value: SUN_DIR },
      uFog: { value: FOG_COLOR },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      uniform vec3 uFog;
      uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 zenith = vec3(0.045, 0.025, 0.09);
        vec3 high = vec3(0.22, 0.08, 0.16);
        vec3 mid = vec3(0.72, 0.24, 0.16);
        vec3 horizon = uFog * 1.15;
        vec3 below = uFog * 0.45;

        float up = clamp(h, 0.0, 1.0);
        vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.18, up));
        sky = mix(sky, high, smoothstep(0.12, 0.55, up));
        sky = mix(sky, zenith, smoothstep(0.35, 0.95, up));
        sky = mix(below, sky, smoothstep(-0.12, 0.02, h));

        float mu = max(dot(dir, uSun), 0.0);
        float disc = smoothstep(0.9992, 0.99975, mu);
        float core = pow(mu, 1800.0);
        float glow = pow(mu, 18.0);
        float halo = pow(mu, 3.0);
        float horizonGlow = pow(mu, 1.4) * smoothstep(0.35, -0.02, h);
        sky += vec3(1.0, 0.45, 0.12) * halo * 0.28;
        sky += vec3(1.0, 0.62, 0.28) * glow * 0.85;
        sky += vec3(1.0, 0.78, 0.45) * horizonGlow * 0.35;
        sky += vec3(1.15, 0.95, 0.75) * core * 3.4;
        sky += vec3(1.4, 1.15, 0.85) * disc * 6.0;

        float cloudPlane = fbm2(dir.xz / max(dir.y, 0.08) * 0.42 + vec2(uTime * 0.004, 0.0));
        float cloud = smoothstep(0.52, 0.74, cloudPlane);
        float cloudH = smoothstep(0.05, 0.22, h) * smoothstep(0.72, 0.28, h);
        float sunLit = pow(mu, 1.6);
        vec3 cloudCol = mix(vec3(0.35, 0.12, 0.16), vec3(1.05, 0.55, 0.28), sunLit);
        cloudCol = mix(cloudCol, vec3(0.95, 0.72, 0.55), pow(mu, 8.0));
        sky = mix(sky, cloudCol, cloud * cloudH * 0.72);

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = -10
  mesh.name = 'sky'
  return mesh
}

export function skyTime(mesh: THREE.Mesh, time: number) {
  const mat = mesh.material as THREE.ShaderMaterial
  mat.uniforms.uTime.value = time
}
