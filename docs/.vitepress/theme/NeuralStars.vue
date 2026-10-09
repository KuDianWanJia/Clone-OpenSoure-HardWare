<template>
  <div ref="container" class="neural-stars space-layer" aria-hidden="true"></div>
</template>

<script setup>
// 星光背景：球壳分布的闪烁星点（直接渲染，无后处理）
// 移植自 CodePen: https://codepen.io/VoXelo/pen/dPMeGze（仅保留星场部分）
import { onMounted, onBeforeUnmount, onActivated, onDeactivated, ref } from 'vue'
import * as THREE from 'three'

const container = ref(null)

const isMobile = window.matchMedia('(max-width: 768px)').matches
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer = null
let camera = null
let scene = null
let clock = null
let starField = null

let rafId = 0
let isVisible = true
let disposed = false
let resizeObs = null
let io = null
let darkModeObs = null

/* ================= 星场 ================= */
function createStarfield(count) {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.randFloat(50, 150)
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2))
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2)
    const i3 = i * 3
    positions[i3]     = r * Math.sin(phi) * Math.cos(theta)
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i3 + 2] = r * Math.cos(phi)
    const colorChoice = Math.random()
    if (colorChoice < 0.7) {
      colors[i3] = 1; colors[i3 + 1] = 1; colors[i3 + 2] = 1
    } else if (colorChoice < 0.85) {
      colors[i3] = 0.7; colors[i3 + 1] = 0.8; colors[i3 + 2] = 1
    } else {
      colors[i3] = 1; colors[i3 + 1] = 0.9; colors[i3 + 2] = 0.8
    }
    sizes[i] = THREE.MathUtils.randFloat(0.1, 0.3)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = sin(uTime * 2.0 + position.x * 100.0) * 0.3 + 0.7;
        gl_PointSize = size * twinkle * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      void main() {
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center);
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(vColor, alpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  return new THREE.Points(geo, mat)
}

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
  camera.updateProjectionMatrix()
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (document.hidden || !isVisible) return
  const t = clock.getElapsedTime()

  if (!reducedMotion) {
    starField.rotation.y += 0.0002
  }

  starField.material.uniforms.uTime.value = t
  renderer.render(scene, camera)
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

  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x000000, 0.002)
  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(0, 0, 32)
  camera.lookAt(0, 0, 0)

  // 直接渲染，无后处理 — antialias:false 省掉默认帧缓冲 MSAA
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false })
  // DPR 上限 1.5（桌面端原生像素密度往往 2~3，封顶 1.5 足够平滑且省像素填充）
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.5))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  el.appendChild(renderer.domElement)

  // 星场
  starField = createStarfield(isMobile ? 4200 : 8000)
  scene.add(starField)

  clock = new THREE.Clock()

  resizeObs = new ResizeObserver(handleResize)
  resizeObs.observe(el)

  io = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting
    if (isVisible) start()
  })
  io.observe(el)

  // VitePress 亮/暗色切换：亮色下 .space-layer 被隐藏，暂停渲染释放 GPU
  darkModeObs = new MutationObserver(() => {
    if (isDark()) start()
    else stop()
  })
  darkModeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  if (reducedMotion) {
    starField.material.uniforms.uTime.value = 0
    renderer.render(scene, camera)
  } else {
    start()
  }
})

onActivated(() => start())
onDeactivated(() => stop())

onBeforeUnmount(() => {
  disposed = true
  stop()
  resizeObs?.disconnect()
  io?.disconnect()
  darkModeObs?.disconnect()
  scene?.traverse((obj) => {
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
.neural-stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.neural-stars :deep(canvas) {
  display: block;
}
</style>
