<template>
  <div ref="container" class="neural-stars space-layer" aria-hidden="true"></div>
</template>

<script setup>
// 星光背景：球壳分布的闪烁星点 + UnrealBloom 辉光
// 移植自 CodePen: https://codepen.io/VoXelo/pen/dPMeGze（仅保留星场部分）
import { onMounted, onBeforeUnmount, onActivated, onDeactivated, ref } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

const container = ref(null)

const isMobile = window.matchMedia('(max-width: 768px)').matches
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderer = null
let composer = null
let bloomPass = null
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
  const positions = []
  const colors = []
  const sizes = []
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.randFloat(50, 150)
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2))
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2)
    positions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    )
    const colorChoice = Math.random()
    if (colorChoice < 0.7) {
      colors.push(1, 1, 1)
    } else if (colorChoice < 0.85) {
      colors.push(0.7, 0.8, 1)
    } else {
      colors.push(1, 0.9, 0.8)
    }
    sizes.push(THREE.MathUtils.randFloat(0.1, 0.3))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1))
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

/* ================= 透明底辉光：用最终亮度重建 alpha，让 bloom 光晕可见 ================= */
const AlphaFromLuminanceShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
      gl_FragColor = vec4(c.rgb, a);
    }
  `
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
  composer.setSize(w, h)
  bloomPass.resolution.set(w, h)
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (document.hidden || !isVisible) return
  const t = clock.getElapsedTime()

  if (!reducedMotion) {
    starField.rotation.y += 0.0002
  }

  starField.material.uniforms.uTime.value = t
  composer.render()
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

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2))
  renderer.setSize(w, h)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  el.appendChild(renderer.domElement)

  // 星场
  starField = createStarfield(isMobile ? 4200 : 8000)
  scene.add(starField)

  // 后处理：辉光
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    samples: isMobile ? 0 : 4
  })
  composer = new EffectComposer(renderer, rt)
  composer.addPass(new RenderPass(scene, camera))
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), isMobile ? 0.3 : 0.5, 0.5, 0.6)
  composer.addPass(bloomPass)
  composer.addPass(new OutputPass())
  composer.addPass(new ShaderPass(AlphaFromLuminanceShader))

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
    composer.render()
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
  composer?.dispose()
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
  height: 100vh; /* 只覆盖首屏 Hero 区域（插槽实际挂载在 .VPHome 下而非 .VPHero 内） */
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.neural-stars :deep(canvas) {
  display: block;
}
</style>
