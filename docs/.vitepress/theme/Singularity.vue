<template>
  <div ref="container" class="singularity space-layer" aria-hidden="true"></div>
</template>

<script setup>
// 奇点黑洞特效，移植自 CodePen: https://codepen.io/VoXelo/pen/VYKMNwE
// 原 Pen 为全屏交互页（OrbitControls + UI 面板 + gsap 状态切换）；
// 背景化改造：去 OrbitControls/UI/gsap，透明 canvas 叠在星云之上，
// 自动旋转 + 定时状态切换（形态/压缩/亮度/轨道速度），暗色渲染。
import { onMounted, onBeforeUnmount, onActivated, onDeactivated, ref } from 'vue'
import * as THREE from 'three'

const container = ref(null)

const isMobile = window.matchMedia('(max-width: 768px)').matches
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer = null
let scene = null
let camera = null
let clock = null
let diskMaterial = null
let auraMat = null
let instancedDisk = null
let scene2 = null
let camera2 = null
let instancedDisk2 = null

let rafId = 0
let isVisible = true
let disposed = false
let resizeObs = null
let io = null
let darkModeObs = null
let transitionTimer = null
let cameraAngle = 0
let cameraAngle2 = 0

// ---- 状态切换配置（三种震荡形态参数 已注释：保留平缓旋转，去掉正弦波震荡） ----
const config = [
  { morph: 0.1, compress: 1.0,  intensity: 1.0, rotate: 0.4, camY: 25, camDist: 85, orbit: 1.0 },
  { morph: 4.5, compress: 1.15, intensity: 1.4, rotate: 1.5, camY: 45, camDist: 95, orbit: 1.8 },
  { morph: 0.8, compress: 0.38, intensity: 3.5, rotate: 5.0, camY: 12, camDist: 55, orbit: 4.5 }
]
let stateIdx = 0
/* ---- 奇点相机(大小)、及旋转速度参数 ---- */
const camControl = { distance: 500, y: 150, rotateSpeed: 0.4 }

/* ---- 奇点屏幕位置参数 (0=最左/上, 0.5=居中, 1=最右/下) ---- */
const singularityPos = { x: 0.50, y: 0.45 }

/* ---- 奇点相机(大小)、及旋转速度参数 ---- */
const camControl2 = { distance: 900, y: 200, rotateSpeed: 5 }

/* ---- 第二奇点独立参数 (屏幕位置/大小/粒子数) ---- */
const singularity2 = { x: 0.35, y: 0.12, count: isMobile ? 1000 : 1800 }

/* ---- 轻量 tween（替代 gsap，power2.inOut 缓动） ---- */
let activeTweens = []
function easeInOutPow2(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
function tweenTo(target, key, endVal, duration) {
  activeTweens.push({
    target, key,
    startVal: target[key],
    endVal,
    duration,
    startTime: 0,
    ease: easeInOutPow2
  })
}
function updateTweens(now) {
  activeTweens = activeTweens.filter(tw => {
    if (!tw.startTime) tw.startTime = now
    const p = Math.min((now - tw.startTime) / tw.duration, 1)
    const e = tw.ease(p)
    tw.target[tw.key] = tw.startVal + (tw.endVal - tw.startVal) * e
    return p < 1
  })
}
// 状态切换（切换形态/压缩/亮度/轨道速度 已注释：去掉正弦波震荡，只保留平缓旋转）
function transition() {
  stateIdx = (stateIdx + 1) % config.length
  const s = config[stateIdx]
  tweenTo(diskMaterial.uniforms.uMorph, 'value', s.morph, 4)
  tweenTo(diskMaterial.uniforms.uCompression, 'value', s.compress, 4)
  tweenTo(diskMaterial.uniforms.uIntensity, 'value', s.intensity, 4)
  tweenTo(diskMaterial.uniforms.uOrbitScale, 'value', s.orbit, 4)
  tweenTo(auraMat.uniforms.uIntensity, 'value', s.intensity, 4)
  tweenTo(camControl, 'rotateSpeed', s.rotate, 4)
  tweenTo(camControl, 'y', s.camY, 4)
  tweenTo(camControl, 'distance', s.camDist, 4)
}

/* ================= 着色器 ================= */
const noiseChunk = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`

/* ================= 生命周期 ================= */
function isDark() {
  return document.documentElement.classList.contains('dark')
}

function handleResize() {
  const el = container.value
  if (!el || !renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h)
  camera.aspect = w / h
  const sx = singularityPos.x * w
  const sy = singularityPos.y * h
  camera.setViewOffset(w * 2, h * 2, w - sx, h - sy, w, h)
  camera.updateProjectionMatrix()
  if (camera2) {
    const s2x = singularity2.x * w
    const s2y = singularity2.y * h
    camera2.aspect = w / h
    camera2.setViewOffset(w * 2, h * 2, w - s2x, h - s2y, w, h)
    camera2.updateProjectionMatrix()
  }
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (document.hidden || !isVisible) return
  const t = clock.getElapsedTime()

  updateTweens(t)

  // 第一奇点 自动旋转相机（替代 OrbitControls.autoRotate）
  cameraAngle += camControl.rotateSpeed * 0.01
  camera.position.x = Math.cos(cameraAngle) * camControl.distance
  camera.position.y = camControl.y
  camera.position.z = Math.sin(cameraAngle) * camControl.distance
  camera.lookAt(0, 0, 0)
  // 第二奇点
  cameraAngle2 += camControl2.rotateSpeed * 0.01
  camera2.position.x = Math.cos(cameraAngle2) * camControl2.distance
  camera2.position.y = camControl2.y
  camera2.position.z = Math.sin(cameraAngle2) * camControl2.distance
  camera2.lookAt(0, 0, 0)

  diskMaterial.uniforms.uTime.value = t
  auraMat.uniforms.uTime.value = t
  instancedDisk.rotation.y += 0.0005

  renderer.autoClear = false
  renderer.clear()
  renderer.render(scene, camera)
  renderer.clearDepth()
  instancedDisk2.rotation.y += 0.0007
  renderer.render(scene2, camera2)
}

function start() {
  if (disposed || rafId || !renderer) return
  if (!isDark()) return
  clock.getDelta()
  rafId = requestAnimationFrame(loop)
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
}

onMounted(() => {
  const el = container.value
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || window.innerHeight

  // 第一奇点相机初始 setViewOffset
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000)
  camera.position.set(60, 30, 60)
  const sx0 = singularityPos.x * w
  const sy0 = singularityPos.y * h
  camera.setViewOffset(w * 2, h * 2, w - sx0, h - sy0, w, h)

  // 第二奇点相机初始 setViewOffset
  scene2 = new THREE.Scene()
  camera2 = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000)
  camera2.position.set(10, 5, 60)
  const s2x0 = singularity2.x * w
  const s2y0 = singularity2.y * h
  camera2.setViewOffset(w * 2, h * 2, w - s2x0, h - s2y0, w, h)

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.6
  el.appendChild(renderer.domElement)

  /* ---- 核心：黑洞 + 光环 ---- */
  // 第一奇点
  const coreGroup = new THREE.Group()
  scene.add(coreGroup)

  const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(4, 64, 64), bhMat))

  // 第二奇点
  const coreGroup2 = new THREE.Group()
  scene2.add(coreGroup2)
  coreGroup2.add(new THREE.Mesh(new THREE.SphereGeometry(4, 64, 64), bhMat))

  auraMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 1.0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 4.0);
        gl_FragColor = vec4(vec3(1.0, 0.45, 0.1) * rim * uIntensity * 5.0, 1.0);
      }
    `,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending
  })
  coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(4.25, 64, 64), auraMat))
  coreGroup2.add(new THREE.Mesh(new THREE.SphereGeometry(4.25, 64, 64), auraMat))

  /* ---- 吸积盘（实例化条带） ---- */
  const instanceCount = isMobile ? 2500 : 5000
  const streakGeo = new THREE.CylinderGeometry(0.01, 0.12, 2.2, 3)
  streakGeo.rotateX(Math.PI / 2)

  diskMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 0.1 },
      uCompression: { value: 1.0 },
      uIntensity: { value: 1.0 },
      uOrbitScale: { value: 1.0 }
    },
    vertexShader: `
      ${noiseChunk}
      uniform float uTime;
      uniform float uMorph;
      uniform float uCompression;
      uniform float uIntensity;
      uniform float uOrbitScale;
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float rOriginal = length(instPos.xz);
        float r = rOriginal * uCompression;
        float initialAngle = atan(instPos.z, instPos.x);
        float orbitalVelocity = (1.5 / sqrt(rOriginal)) * uOrbitScale;
        float currentAngle = initialAngle + (uTime * orbitalVelocity);
        vec3 morphedWorldPos = vec3(cos(currentAngle) * r, instPos.y, sin(currentAngle) * r);
        float noise = snoise(vec3(morphedWorldPos.x * 0.08, morphedWorldPos.z * 0.08, uTime * 0.3));
        morphedWorldPos.y += noise * uMorph * 4.0;
        vec3 viewDir = normalize(cameraPosition - morphedWorldPos);
        vec3 orbitDir = normalize(vec3(-sin(currentAngle), 0.0, cos(currentAngle)));
        float doppler = dot(orbitDir, viewDir);
        vec3 hot = vec3(1.0, 0.95, 0.9);
        vec3 warm = vec3(1.0, 0.45, 0.1);
        vec3 cool = vec3(0.1, 0.35, 1.0);
        vec3 color = mix(cool, warm, smoothstep(45.0, 12.0, r));
        color = mix(color, hot, smoothstep(10.0, 4.0, r));
        vColor = color * (1.3 + doppler * 0.7) * uIntensity;
        vOpacity = (smoothstep(3.8, 5.5, r) * (1.0 - smoothstep(38.0, 48.0, r))) * 0.8;
        float deltaAngle = currentAngle - initialAngle;
        float c = cos(deltaAngle);
        float s = sin(deltaAngle);
        mat3 rotY = mat3(c, 0, s, 0, 1, 0, -s, 0, c);
        vec3 localPos = (instanceMatrix * vec4(position, 0.0)).xyz;
        vec3 rotatedLocalPos = rotY * localPos;
        gl_Position = projectionMatrix * viewMatrix * vec4(morphedWorldPos + rotatedLocalPos, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      void main() {
        gl_FragColor = vec4(vColor, vOpacity);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  })

  /* ---- 第一奇点 ---- */
  instancedDisk = new THREE.InstancedMesh(streakGeo, diskMaterial, instanceCount)
  const dummy = new THREE.Object3D()
  for (let i = 0; i < instanceCount; i++) {
    const r = 5 + Math.pow(Math.random(), 1.3) * 40
    const angle = Math.random() * Math.PI * 2
    dummy.position.set(Math.cos(angle) * r, (Math.random() - 0.5) * (8 / r), Math.sin(angle) * r)
    dummy.lookAt(dummy.position.x + Math.sin(angle), dummy.position.y, dummy.position.z - Math.cos(angle))
    dummy.updateMatrix()
    instancedDisk.setMatrixAt(i, dummy.matrix)
  }
  scene.add(instancedDisk)

  /* ---- 第二奇点 ---- */
  instancedDisk2 = new THREE.InstancedMesh(streakGeo, diskMaterial, singularity2.count)
  const dummy2 = new THREE.Object3D()
  for (let i = 0; i < singularity2.count; i++) {
    const r = 5 + Math.pow(Math.random(), 1.3) * 40
    const a = Math.random() * Math.PI * 2
    dummy2.position.set(Math.cos(a) * r, (Math.random() - 0.5) * (8 / r), Math.sin(a) * r)
    dummy2.lookAt(dummy2.position.x + Math.sin(a), dummy2.position.y, dummy2.position.z - Math.cos(a))
    dummy2.updateMatrix()
    instancedDisk2.setMatrixAt(i, dummy2.matrix)
  }
  scene2.add(instancedDisk2)

  clock = new THREE.Clock()

  resizeObs = new ResizeObserver(handleResize)
  resizeObs.observe(el)

  io = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting
    if (isVisible) start()
  })
  io.observe(el)

  darkModeObs = new MutationObserver(() => {
    if (isDark()) start()
    else stop()
  })
  darkModeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (reducedMotion) {
    diskMaterial.uniforms.uTime.value = 0
    auraMat.uniforms.uTime.value = 0
    renderer.render(scene, camera)
  } else {
    start()
    /*
    transitionTimer = setInterval(transition, 10000) // 定时触发器:改变波形形态
    */
  }
})

onActivated(() => start())
onDeactivated(() => stop())

onBeforeUnmount(() => {
  disposed = true
  stop()
  if (transitionTimer) clearInterval(transitionTimer)
  resizeObs?.disconnect()
  io?.disconnect()
  darkModeObs?.disconnect()
  scene?.traverse((obj) => {
    obj.geometry?.dispose()
    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
    else obj.material?.dispose()
  })
  scene2?.traverse((obj) => {
    obj.geometry?.dispose()
    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
    else obj.material?.dispose()
  })
  renderer?.dispose()
  renderer?.domElement?.remove()
  renderer = null
})
</script>

<style scoped>
.singularity {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.singularity::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 50%, rgba(0, 0, 0, 0.4) 100%);
  pointer-events: none;
}

.singularity :deep(canvas) {
  display: block;
}
</style>
