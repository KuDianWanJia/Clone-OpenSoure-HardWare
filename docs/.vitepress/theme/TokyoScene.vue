<script setup>
// 沉浸式 3D 街景页（参考 haru-ni.net 首页形式）：
// 全幅 three.js 场景 + 叠加文字，播放小东京内置动画，樱花粒子氛围，自动旋转 + 拖拽交互
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

const container = ref(null)
const progress = ref(0)
const ready = ref(false)
const failed = ref(false)

let renderer, scene, camera, controls, mixer, petals, petalSeeds
let rafId = 0
let disposed = false
const clock = new THREE.Clock()

// 程序化樱花花瓣（canvas 画花瓣形柔边贴图，Points 飘落 + 水平摇摆）
function initPetals() {
  const count = 320
  const positions = new Float32Array(count * 3)
  petalSeeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1500
    positions[i * 3 + 1] = Math.random() * 900 - 60
    positions[i * 3 + 2] = (Math.random() - 0.5) * 1500
    petalSeeds[i] = Math.random() * Math.PI * 2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, 'rgba(255,196,210,1)')
  grad.addColorStop(0.55, 'rgba(255,168,190,0.9)')
  grad.addColorStop(1, 'rgba(255,168,190,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(32, 32, 15, 23, Math.PI / 5, 0, Math.PI * 2)
  ctx.fill()

  const mat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(c),
    size: 26,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    sizeAttenuation: true
  })
  petals = new THREE.Points(geo, mat)
  scene.add(petals)
}

function updatePetals(dt, t) {
  const pos = petals.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) - (60 + 70 * Math.sin(petalSeeds[i])) * dt
    if (y < -80) y = 820
    pos.setY(i, y)
    pos.setX(i, pos.getX(i) + Math.sin(t * 1.3 + petalSeeds[i]) * 0.7)
  }
  pos.needsUpdate = true
}

function animate() {
  if (disposed) return
  rafId = requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime
  if (mixer) mixer.update(dt)
  if (petals) updatePetals(dt, t)
  controls.update()
  renderer.render(scene, camera)
}

async function init() {
  const el = container.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 8000)
  camera.position.set(520, 380, 520)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.7
  controls.enablePan = false
  controls.minPolarAngle = Math.PI * 0.2
  controls.maxPolarAngle = Math.PI * 0.52
  controls.minDistance = 380
  controls.maxDistance = 2400
  controls.target.set(0, -10, 0)

  // 光照量级对齐 three.js 官方 keyframes 示例（物理光照单位）
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6688aa, 2.6)
  hemi.position.set(0, 400, 0)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffffff, 2.6)
  dir.position.set(0, 500, 260)
  scene.add(dir)

  initPetals()

  // Draco 解码器自托管在 /draco/（与 3D 预览页共用）
  const draco = new DRACOLoader()
  draco.setDecoderPath(withBase('/draco/'))
  draco.setDecoderConfig({ type: 'wasm' })
  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  try {
    const gltf = await loader.loadAsync(withBase('/models/LittlestTokyo.glb'), (e) => {
      if (e.lengthComputable) progress.value = Math.min(100, (e.loaded / e.total) * 100)
    })
    if (disposed) return
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 700 / maxDim
    model.scale.setScalar(scale)
    model.position.sub(center.multiplyScalar(scale))
    scene.add(model)

    // 播放模型内置动画（电车行驶、招财猫招手等）
    if (gltf.animations && gltf.animations.length) {
      mixer = new THREE.AnimationMixer(model)
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play())
    }

    ready.value = true
    clock.start()
    animate()
  } catch (err) {
    console.error('东京街景加载失败:', err)
    failed.value = true
  }
}

function onResize() {
  if (!container.value || !renderer) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  init()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
  if (mixer) mixer.stopAllAction()
  if (controls) controls.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })
    scene.clear()
  }
  scene = camera = controls = renderer = mixer = petals = null
})
</script>

<template>
  <section class="tokyo-scene">
    <div ref="container" class="stage">
      <!-- 加载中 -->
      <div v-if="!ready && !failed" class="loading" :class="{ faded: progress >= 100 }">
        <span class="lantern">🏮</span>
        <div class="bar"><div class="fill" :style="{ width: progress + '%' }"></div></div>
        <span class="pct">小东京准备中… {{ Math.floor(progress) }}%</span>
      </div>
      <!-- 失败 -->
      <div v-if="failed" class="error">
        <p>😢 街景加载失败，请刷新重试</p>
      </div>

      <!-- 叠加文字层（不拦截画布拖拽） -->
      <div class="overlay">
        <span class="badge">🏮 沉浸式 3D 场景</span>
        <h1 class="title-grad">东京街景</h1>
        <p class="sub">像素风小东京 · 拖拽旋转视角，电车与招财猫正在营业</p>
        <div class="btns">
          <a :href="withBase('/')" class="btn ghost">← 返回首页</a>
        </div>
      </div>

      <!-- 操作提示 -->
      <ul class="hints">
        <li>🖱️ 拖拽 · 旋转</li>
        <li>⚙️ 滚轮 · 缩放</li>
        <li>🌸 自动巡游中</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.tokyo-scene {
  max-width: 1280px;
  margin: 24px auto 48px;
  padding: 0 24px;
}

.stage {
  position: relative;
  height: min(78vh, 760px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: linear-gradient(160deg, #fdf3f4, #eef3fa 55%, #e7ecf5);
  box-shadow: 0 24px 60px -28px rgba(0, 0, 0, .3);
}

/* 画布铺满 */
.stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* 暗色主题：夜色街景氛围 */
.dark .stage {
  background: radial-gradient(1200px 520px at 50% 0%, #232741, #12141d 70%);
  border-color: #2b2f3d;
}

/* ---- 叠加文字 ---- */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
  padding: 0 24px;
}
.badge {
  font-size: 12.5px;
  font-weight: 600;
  padding: 4px 13px;
  border-radius: 999px;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  box-shadow: 0 6px 18px -10px rgba(0, 0, 0, .35);
}
.title-grad {
  font-size: clamp(40px, 7vw, 74px);
  line-height: 1.1;
  margin: 16px 0 12px;
  background: linear-gradient(315deg, #41d1ff 25%, #bd34fe);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 4px 18px rgba(189, 52, 254, .18));
}
.sub {
  max-width: 560px;
  color: var(--vp-c-text-1);
  font-size: 15px;
  text-shadow: 0 1px 8px rgba(255, 255, 255, .5);
}
.dark .sub { text-shadow: 0 1px 8px rgba(0, 0, 0, .6); }

.btns {
  display: flex;
  gap: 12px;
  margin-top: 22px;
  pointer-events: auto;
}
.btn {
  display: inline-block;
  padding: 9px 20px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
}
.btn.primary {
  color: #fff;
  background: var(--vp-c-brand-1);
  box-shadow: 0 10px 26px -12px color-mix(in srgb, var(--vp-c-brand-1) 70%, transparent);
}
.btn.primary:hover { transform: translateY(-2px); }
.btn.ghost {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}
.btn.ghost:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

/* ---- 操作提示 ---- */
.hints {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
  pointer-events: none;
  flex-wrap: wrap;
  justify-content: center;
}
.hints li {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  color: var(--vp-c-text-2);
  background: color-mix(in srgb, var(--vp-c-bg) 72%, transparent);
  border: 1px solid var(--vp-c-divider);
  backdrop-filter: blur(6px);
}

/* ---- 加载 / 失败 ---- */
.loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(4px);
  transition: opacity .5s ease;
  z-index: 2;
}
.loading.faded { opacity: 0; pointer-events: none; }
.lantern { font-size: 44px; animation: bob 1.6s ease-in-out infinite; }
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.bar {
  width: min(300px, 60%);
  height: 6px;
  border-radius: 999px;
  background: var(--vp-c-divider);
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #41d1ff, #bd34fe);
  transition: width .2s ease;
}
.pct { font-size: 13px; color: var(--vp-c-text-2); }

.error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  z-index: 2;
}
.error p { color: var(--vp-c-text-1); font-weight: 600; }
.link { color: var(--vp-c-brand-1); font-size: 13.5px; text-decoration: none; }
.link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .stage { height: 64vh; }
  .hints li:nth-child(3) { display: none; }
}
</style>
