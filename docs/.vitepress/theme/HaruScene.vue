<script setup>
// 沉浸式 3D 场景页：
// 全幅 three.js 场景 + 叠加文字，组合本地 world/sakura/balloon/main_chara 等模型，自动旋转 + 拖拽交互
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
const failMsg = ref('')

let renderer, scene, camera, controls
let rafId = 0
let disposed = false
const clock = new THREE.Clock()
const mixers = []       // 多个模型的动画混合器
const sakuraPetals = [] // 樱花实例列表（{ mesh, vy, vx, rotSpeed }）
const balloons = []     // 气球实例列表
const floaters = []     // 所有漂浮物（气球等）统一更新

// 只把粉色地面 mesh 染成指定颜色，不动地面上的任何物体
function paintGround(root, colorHex) {
  let target = null
  root.traverse(o => {
    if (o.isMesh && o.name === 'floor_10th') target = o
  })
  // 兜底：找不到指定名称时，取面积最大且厚度≈0 的平板
  if (!target) {
    root.updateMatrixWorld(true)
    let best = null
    let bestArea = 0
    root.traverse(o => {
      if (!o.isMesh) return
      const box = new THREE.Box3().setFromObject(o)
      const size = box.getSize(new THREE.Vector3())
      const flatness = size.y / Math.max(size.x, size.z)
      if (flatness > 0.02) return
      const area = size.x * size.z
      if (area > bestArea) { bestArea = area; best = o }
    })
    target = best
  }
  if (!target) return
  const mats = Array.isArray(target.material) ? target.material : [target.material]
  target.material = mats.map(m => {
    const nm = m.clone()
    nm.color = new THREE.Color(colorHex)
    nm.map = null // 原色在调色板贴图里，纯色替换才能得到准确的黄
    return nm
  })
}

// 缩放并居中模型到目标最大尺寸
function fitModel(model, targetSize) {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = targetSize / maxDim
  model.scale.setScalar(scale)
  model.position.sub(center.multiplyScalar(scale))
  // 居中后模型底部的 y 坐标（负值），供其他物体对齐地面
  const bottomY = -(size.y * scale) / 2
  return { scale, center, size, maxDim, bottomY }
}

// 樱花飘落粒子：用 sakura.glb 克隆 N 个
let sakuraModel = null
function spawnSakura(count, sceneScale, worldBottomY) {
  if (!sakuraModel) return
  for (let i = 0; i < count; i++) {
    const petal = sakuraModel.clone(true)
    petal.scale.setScalar((0.6 + Math.random() * 0.8) * sceneScale)
    petal.position.set(
      (Math.random() - 0.5) * 1400,
      worldBottomY + 200 + Math.random() * 700,
      (Math.random() - 0.5) * 1400
    )
    petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    scene.add(petal)
    sakuraPetals.push({
      mesh: petal,
      baseY: petal.position.y,
      vy: -(40 + 60 * Math.random()),
      vx: (Math.random() - 0.5) * 30,
      rotSpeed: (Math.random() - 0.5) * 1.5,
      phase: Math.random() * Math.PI * 2,
      worldBottomY
    })
  }
}

function updateSakura(dt, t) {
  for (const p of sakuraPetals) {
    p.mesh.position.y += p.vy * dt
    p.mesh.position.x += Math.sin(t * 1.2 + p.phase) * 0.6 + p.vx * dt * 0.1
    p.mesh.rotation.y += p.rotSpeed * dt
    p.mesh.rotation.z = Math.sin(t + p.phase) * 0.3
    if (p.mesh.position.y < p.worldBottomY - 40) {
      p.mesh.position.y = p.worldBottomY + 880
      p.mesh.position.x = (Math.random() - 0.5) * 1400
    }
  }
}

// 气球漂浮
function updateBalloons(dt, t) {
  for (const b of balloons) {
    b.mesh.position.y = b.baseY + Math.sin(t * b.bobSpeed + b.phase) * 30
    b.mesh.rotation.z = Math.sin(t * 0.5 + b.phase) * 0.08
  }
}

function animate() {
  if (disposed) return
  rafId = requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const t = clock.elapsedTime
  for (const m of mixers) m.update(dt)
  updateSakura(dt, t)
  updateBalloons(dt, t)
  controls.update()
  renderer.render(scene, camera)
}

async function loadModel(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}

async function init() {
  const el = container.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, w / h, 1, 8000)
  // 整体视图大小(相机位置)
  camera.position.set(200, 150, 200)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.6
  controls.enablePan = false
  controls.minPolarAngle = Math.PI * 0.18
  controls.maxPolarAngle = Math.PI * 0.55
  // 整体视图缩放范围
  controls.minDistance = 160
  controls.maxDistance = 1200
  // 整体视图位置修改
  controls.target.set(0, -60, 0)

  // 光照（物理光照单位，量级对齐官方示例）
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 2.8))
  const dir = new THREE.DirectionalLight(0xffffff, 2.8)
  dir.position.set(200, 500, 300)
  scene.add(dir)
  const fill = new THREE.DirectionalLight(0xffeecc, 1.0)
  fill.position.set(-300, 200, -200)
  scene.add(fill)

  // Draco 解码器自托管在 /draco/
  const draco = new DRACOLoader()
  draco.setDecoderPath(withBase('/draco/'))
  draco.setDecoderConfig({ type: 'wasm' })
  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  try {
    // 预定义模型列表（与 haru-ni 同名）
    const MODEL_URLS = {
      world: withBase('/models/world.glb'),
      sakura: withBase('/models/sakura.glb'),
      balloon: withBase('/models/balloon.glb'),
      chara: withBase('/models/main_chara_default.glb')
    }

    // 1. 主场景 world（必须先加载，确定场景尺度）
    const worldGltf = await loadModel(loader, MODEL_URLS.world)
    progress.value = 50
    const world = worldGltf.scene
    const fit = fitModel(world, 600)
    const sceneScale = fit.scale
    const worldBottomY = fit.bottomY // 主场景地面 y 坐标
    // 仅把粉色地面 floor_10th 染成 haru-ni 同款鹅黄色
    paintGround(world, 0xe0c67b)
    scene.add(world)
    if (worldGltf.animations?.length) {
      const mixer = new THREE.AnimationMixer(world)
      worldGltf.animations.forEach(c => mixer.clipAction(c).play())
      mixers.push(mixer)
    }

    // 2. 樱花粒子（克隆 sakura 模型）
    try {
      const sakuraGltf = await loadModel(loader, MODEL_URLS.sakura)
      sakuraModel = sakuraGltf.scene
      if (sakuraGltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(sakuraModel)
        sakuraGltf.animations.forEach(c => mixer.clipAction(c).play())
        mixers.push(mixer)
      }
      spawnSakura(80, sceneScale * 1.2, worldBottomY)
    } catch (e) {
      console.warn('樱花模型加载失败，跳过：', e)
    }
    progress.value = 75

    // 3. 气球漂浮（克隆 balloon 模型）
    try {
      const balloonGltf = await loadModel(loader, MODEL_URLS.balloon)
      const balloonBase = balloonGltf.scene
      if (balloonGltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(balloonBase)
        balloonGltf.animations.forEach(c => mixer.clipAction(c).play())
        mixers.push(mixer)
      }
      const balloonCount = 4
      for (let i = 0; i < balloonCount; i++) {
        const b = balloonBase.clone(true)
        b.scale.setScalar(sceneScale * (0.8 + Math.random() * 0.6))
        const baseY = worldBottomY + 180 + Math.random() * 200
        b.position.set(
          (Math.random() - 0.5) * 800,
          baseY,
          (Math.random() - 0.5) * 800
        )
        scene.add(b)
        balloons.push({
          mesh: b,
          baseY,
          bobSpeed: 0.6 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2
        })
      }
    } catch (e) {
      console.warn('气球模型加载失败，跳过：', e)
    }

    // 4. 主角色（放在场景前方地面）
    try {
      const charaGltf = await loadModel(loader, MODEL_URLS.chara)
      const chara = charaGltf.scene
      const charaBox0 = new THREE.Box3().setFromObject(chara)
      const charaMax = Math.max(charaBox0.getSize(new THREE.Vector3()).x, charaBox0.getSize(new THREE.Vector3()).y, charaBox0.getSize(new THREE.Vector3()).z)
      const charaScale = (440 / 6) / charaMax * sceneScale
      chara.scale.setScalar(charaScale)
      // 缩放后重置位置，重新计算包围盒，精确对齐底部
      chara.position.set(0, 0, 0)
      const box = new THREE.Box3().setFromObject(chara)
      chara.position.y = worldBottomY - box.min.y
      chara.rotation.set(0, 0, 0)
      scene.add(chara)
      if (charaGltf.animations?.length) {
        const mixer = new THREE.AnimationMixer(chara)
        charaGltf.animations.forEach(a => mixer.clipAction(a).play())
        mixers.push(mixer)
      }
    } catch (e) {
      console.warn('角色模型加载失败，跳过：', e)
    }

    progress.value = 100
    ready.value = true
    clock.start()
    animate()
  } catch (err) {
    console.error('haru 场景加载失败:', err)
    failMsg.value = err?.message || String(err)
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
  mixers.forEach(m => m.stopAllAction())
  mixers.length = 0
  if (controls) controls.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  if (scene) {
    scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })
    scene.clear()
  }
  sakuraPetals.length = 0
  balloons.length = 0
  sakuraModel = null
  scene = camera = controls = renderer = null
})
</script>

<template>
  <section class="haru-scene">
    <div ref="container" class="stage">
      <!-- 加载中 -->
      <div v-if="!ready && !failed" class="loading" :class="{ faded: progress >= 100 }">
        <span class="spinner">🌸</span>
        <div class="bar"><div class="fill" :style="{ width: progress + '%' }"></div></div>
        <span class="pct">场景准备中… {{ Math.floor(progress) }}%</span>
      </div>
      <!-- 失败 -->
      <div v-if="failed" class="error">
        <p>😢 场景加载失败</p>
        <p class="msg">{{ failMsg }}</p>
      </div>

      <!-- 叠加文字层（不拦截画布拖拽） -->
      <div class="overlay">
        <span class="badge">✨ 沉浸式 3D 场景</span>
        <div class="titles">
          <h1 class="title-grad">像素乐园</h1>
          <p class="sub">游乐园 · 樱花 · 气球 · 街角的伙伴</p>
        </div>
        <div class="btns">
          <a :href="withBase('/')" class="btn ghost">← 返回首页</a>
        </div>
      </div>

      <!-- 操作提示 -->
      <ul class="hints">
        <li>🖱️ 拖拽 · 旋转</li>
        <li>⚙️ 滚轮 · 缩放</li>
        <li>🌸 樱花飞舞中</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.haru-scene {
  max-width: 1280px;
  margin: 24px auto 48px;
  padding: 0 24px;
}

.stage {
  position: relative;
  height: min(78vh, 760px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #c9ab5e;
  background: #e0c67b;
  box-shadow: 0 24px 60px -28px rgba(120, 90, 20, .35);
}

.stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* haru-ni 同款鹅黄色背景，暗色模式下保持一致 */
.dark .stage {
  background: #e0c67b;
  border-color: #c9ab5e;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  text-align: center;
  pointer-events: none;
  padding: 20px 24px 0;
  gap: 12px;
}
.titles {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.badge {
  justify-self: start;
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
  font-size: clamp(26px, 4vw, 44px);
  line-height: 1.1;
  margin: 0 0 4px;
  background: linear-gradient(315deg, #ff9ec7 25%, #bd34fe);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  filter: drop-shadow(0 4px 18px rgba(255, 100, 180, .18));
}
.sub {
  max-width: 340px;
  color: var(--vp-c-text-1);
  font-size: 14px;
  margin: 0;
  text-shadow: 0 1px 8px rgba(255, 255, 255, .5);
}
.dark .sub { text-shadow: 0 1px 8px rgba(0, 0, 0, .6); }

.btns {
  display: flex;
  justify-self: end;
  gap: 12px;
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
.spinner { font-size: 44px; animation: spin 2s linear infinite; display: inline-block; }
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
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
  background: linear-gradient(90deg, #ff9ec7, #bd34fe);
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
.error p { color: var(--vp-c-text-1); font-weight: 600; margin: 0; }
.error .msg { font-size: 12px; color: var(--vp-c-text-2); font-weight: 400; max-width: 80%; word-break: break-all; }
.link { color: var(--vp-c-brand-1); font-size: 13.5px; text-decoration: none; }
.link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .stage { height: 64vh; }
  .hints li:nth-child(3) { display: none; }
  .overlay { padding: 12px 12px 0; gap: 8px; }
  .title-grad { font-size: 22px; }
  .sub { font-size: 12px; max-width: 170px; }
  .badge { font-size: 11px; padding: 3px 9px; }
  .btn { padding: 7px 13px; font-size: 12.5px; }
}
</style>
