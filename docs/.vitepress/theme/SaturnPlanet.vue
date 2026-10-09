<template>
  <div ref="container" class="saturn-bg space-layer" aria-hidden="true"></div>
</template>

<script setup>
// 参考 CodePen: https://codepen.io/Yakudoo/pen/qbygaJ
// 低多边形「土星」：随机岩石行星 + 彩色碎石环绕轨道
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'

const container = ref(null)

let renderer, scene, camera
const saturns = []
let rafId = 0
let resizeObs = null
let isVisible = true
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const Colors = {
  green: 0x8fc999,
  blue: 0x5fc4d0,
  orange: 0xee5624,
  yellow: 0xfaff70
}
const colorKeys = Object.keys(Colors)
const getRandomColor = () => Colors[colorKeys[Math.floor(Math.random() * colorKeys.length)]]

// 三个天体的配置：不同颜色 / 大小 / 位置（fx/fy 为画布内百分比坐标）
const saturnConfigs = [
  { color: Colors.orange, scale: 0.65, fx: 0.25, fy: 0.30, particles: 180, rotSpeed: 0.018, tilt: [0.60, -0.50] },
  { color: Colors.yellow, scale: 0.45, fx: 0.80, fy: 0.15, particles: 160, rotSpeed: 0.014, tilt: [0.8, -0.10] },
  { color: Colors.green,  scale: 0.35, fx: 0.65, fy: 0.60, particles: 120, rotSpeed: 0.018, tilt: [0.35, -0.20] }
]

// 行星参数（对应原 pen 的 GUI 默认值）
const parameters = {
  minRadius: 30,
  maxRadius: 50,
  minSpeed: 0.015,
  maxSpeed: 0.025,
  particles: 300,
  minSize: 0.1,
  maxSize: 2
}

function getMat(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    emissive: 0x270000,
    flatShading: true
  })
}

// 碎石粒子：随机 4 种几何体 + 随机颜色
function createParticle() {
  const s = 1
  const random = Math.random()
  let geom
  if (random < 0.25) {
    geom = new THREE.BoxGeometry(s, s, s) // 立方体
  } else if (random < 0.5) {
    geom = new THREE.CylinderGeometry(0, s, s * 2, 4, 1) // 四棱锥
  } else if (random < 0.75) {
    geom = new THREE.TetrahedronGeometry(s, 2) // 土豆块
  } else {
    geom = new THREE.BoxGeometry(s / 6, s, s) // 薄片
  }
  return new THREE.Mesh(geom, getMat(getRandomColor()))
}

function createSaturn(cfg) {
  // 行星：四面体细分后随机扰动顶点，做成岩石感
  const geomPlanet = new THREE.TetrahedronGeometry(20, 2)
  const noise = 5
  const pos = geomPlanet.attributes.position
  // BufferGeometry 中每个面的顶点是独立拷贝（非共享），
  // 必须对相同坐标的顶点应用同一随机偏移，否则面片会裂开、不成封闭实体
  const offsetMap = new Map()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`
    let off = offsetMap.get(key)
    if (!off) {
      off = [
        -noise / 2 + Math.random() * noise,
        -noise / 2 + Math.random() * noise,
        -noise / 2 + Math.random() * noise
      ]
      offsetMap.set(key, off)
    }
    pos.setXYZ(i, x + off[0], y + off[1], z + off[2])
  }
  geomPlanet.computeVertexNormals()

  const planet = new THREE.Mesh(geomPlanet, getMat(cfg.color))
  const ring = new THREE.Mesh()

  // 环绕粒子
  const n = cfg.particles
  const angleStep = (Math.PI * 2) / n
  for (let i = 0; i < n; i++) {
    const p = createParticle()
    p.rotation.x = Math.random() * Math.PI
    p.rotation.y = Math.random() * Math.PI
    p.position.y = -2 + Math.random() * 4
    const size = parameters.minSize + Math.random() * (parameters.maxSize - parameters.minSize)
    p.scale.set(size, size, size)
    p.userData.distance = parameters.minRadius + Math.random() * (parameters.maxRadius - parameters.minRadius)
    p.userData.angle = angleStep * i
    // 速度随距离线性插值：内快外慢
    const dv = parameters.maxRadius - parameters.minRadius
    const pc = (p.userData.distance - parameters.minRadius) / dv
    p.userData.angularSpeed = parameters.minSpeed + pc * (parameters.maxSpeed - parameters.minSpeed)
    ring.add(p)
  }

  const mesh = new THREE.Object3D()
  mesh.add(planet)
  mesh.add(ring)
  mesh.rotation.x = cfg.tilt[0]
  mesh.rotation.z = cfg.tilt[1]
  mesh.scale.setScalar(cfg.scale)
  return { mesh, planet, ring, rotSpeed: cfg.rotSpeed, fx: cfg.fx, fy: cfg.fy }
}

// 按画布可视范围把百分比坐标换算成世界坐标（相机看向 z=0 平面）
function layoutPlanets() {
  if (!camera || !saturns.length) return
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
  const halfW = halfH * camera.aspect
  for (const s of saturns) {
    s.mesh.position.x = (s.fx - 0.5) * 2 * halfW
    s.mesh.position.y = (0.5 - s.fy) * 2 * halfH
  }
}

function updateParticlesRotation(saturn) {
  const children = saturn.ring.children
  for (let i = 0; i < children.length; i++) {
    const m = children[i]
    m.userData.angle += m.userData.angularSpeed
    m.position.x = Math.cos(m.userData.angle) * m.userData.distance
    m.position.z = Math.sin(m.userData.angle) * m.userData.distance
    // 自转
    m.rotation.x += Math.random() * 0.05
    m.rotation.y += Math.random() * 0.05
    m.rotation.z += Math.random() * 0.05
  }
}

function loop() {
  rafId = requestAnimationFrame(loop)
  if (document.hidden || !isVisible) return
  for (const s of saturns) {
    s.planet.rotation.y -= s.rotSpeed
    updateParticlesRotation(s)
  }
  renderer.render(scene, camera)
}

function handleResize() {
  if (!container.value || !renderer) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  layoutPlanets()
}

onMounted(() => {
  const el = container.value
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 2000)
  camera.position.z = 100

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  el.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x663344, 2))
  const light = new THREE.DirectionalLight(0xffffff, 1.5)
  light.position.set(200, 100, 200)
  scene.add(light)

  for (const cfg of saturnConfigs) {
    const s = createSaturn(cfg)
    saturns.push(s)
    scene.add(s.mesh)
  }
  layoutPlanets()

  resizeObs = new ResizeObserver(handleResize)
  resizeObs.observe(el)

  // 滚出视口暂停渲染
  const io = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting })
  io.observe(el)
  onBeforeUnmount(() => io.disconnect())

  if (reducedMotion) {
    // 减少动态：只渲染一帧静态画面
    renderer.render(scene, camera)
  } else {
    loop()
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObs?.disconnect()
  scene?.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose()
      obj.material?.dispose()
    }
  })
  renderer?.dispose()
  renderer?.domElement?.remove()
})
</script>

<style scoped>
.saturn-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh; /* 只覆盖首屏 Hero 区域（插槽实际挂载在 .VPHome 下而非 .VPHero 内） */
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.saturn-bg :deep(canvas) {
  display: block;
}
</style>
